import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handleRequest } from "../src/index";
import type { Env as WorkerEnv, RequestDependencies } from "../src/types";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const origin = "http://127.0.0.1:4173";
const now = new Date("2026-08-26T18:00:00.000Z");
const dependencies: RequestDependencies = {
  now: () => now,
  verifyAccess: async (request) => request.headers.get("X-Synthetic-Admin") === "allowed",
  verifyTurnstile: async ({ token }) => ({
    action: "lesson_application",
    hostname: "127.0.0.1",
    success: token === "synthetic-valid-turnstile-token",
  }),
};

function syntheticPayload(overrides: Record<string, unknown> = {}) {
  return {
    turnstileToken: "synthetic-valid-turnstile-token",
    idempotencyKey: crypto.randomUUID(),
    website: "",
    parentName: "Synthetic Parent",
    learnerName: "Synthetic Learner",
    learnerAgeOrGrade: "Synthetic grade 8",
    englishLevel: "elementary",
    goals: "Synthetic goal used only in the isolated local Worker test.",
    tariffId: "standard",
    packageLessons: 4,
    lessonFormat: "online",
    preferredSchedule: "Synthetic Tuesday after 18:00",
    contactMethod: "email",
    contactValue: "synthetic@example.invalid",
    notes: "SYNTHETIC TEST DATA — delete after verification.",
    policyAcknowledged: true,
    privacyAcknowledged: true,
    ...overrides,
  };
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://applications.example.invalid${path}`, {
    ...init,
    headers: {
      Origin: origin,
      "CF-Connecting-IP": "192.0.2.44",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function submit(payload = syntheticPayload(), headers: Record<string, string> = {}) {
  return handleRequest(request("/api/applications", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }), env, dependencies);
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM applications"),
    env.DB.prepare("DELETE FROM application_rate_limits"),
  ]);
});

afterAll(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM applications"),
    env.DB.prepare("DELETE FROM application_rate_limits"),
  ]);
});

describe("public API security and persistence", () => {
  it("restricts CORS to the exact configured site origin", async () => {
    const rejected = await handleRequest(new Request("https://applications.example.invalid/api/applications", {
      method: "OPTIONS",
      headers: { Origin: "https://wrong.example.invalid" },
    }), env, dependencies);
    expect(rejected.status).toBe(403);

    const accepted = await handleRequest(request("/api/applications", { method: "OPTIONS" }), env, dependencies);
    expect(accepted.status).toBe(204);
    expect(accepted.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  it("rejects unknown fields, invalid content, and honeypot spam without persistence", async () => {
    expect((await submit(syntheticPayload({ unexpectedPrivateField: "no" }))).status).toBe(422);
    expect((await submit(syntheticPayload({ goals: "short" }))).status).toBe(422);
    expect((await submit(syntheticPayload({ website: "bot.example" }))).status).toBe(422);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM applications").first<{ count: number }>();
    expect(count?.count).toBe(0);
  });

  it("requires a successful server-side Turnstile decision", async () => {
    const response = await submit(syntheticPayload({ turnstileToken: "synthetic-invalid-token" }));
    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain("Synthetic Parent");
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM applications").first<{ count: number }>();
    expect(count?.count).toBe(0);
    const rateCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM application_rate_limits").first<{ count: number }>();
    expect(rateCount?.count).toBe(0);
  });

  it("stores an allowlisted application and returns only a public reference", async () => {
    const response = await submit();
    expect(response.status).toBe(201);
    const body = await response.json<{ ok: true; reference: string; duplicate: boolean }>();
    expect(body.reference).toMatch(/^HEL-20260826-[A-Z2-9]{8}$/);
    expect(body.duplicate).toBe(false);
    expect(JSON.stringify(body)).not.toContain("Synthetic Parent");

    const stored = await env.DB.prepare("SELECT status, internal_notes, parent_name FROM applications").first<{
      status: string; internal_notes: string; parent_name: string;
    }>();
    expect(stored).toEqual({ status: "new", internal_notes: "", parent_name: "Synthetic Parent" });
  });

  it("replays an exact idempotent request and rejects key reuse with different content", async () => {
    const idempotencyKey = crypto.randomUUID();
    const payload = syntheticPayload({ idempotencyKey });
    const first = await submit(payload);
    const firstBody = await first.json<{ reference: string }>();
    const replay = await submit({ ...payload, turnstileToken: "already-used-token" });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ duplicate: true, reference: firstBody.reference });
    const conflict = await submit({ ...payload, goals: "Different synthetic request with the same idempotency key." });
    expect(conflict.status).toBe(409);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM applications").first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("rate-limits challenge-verified attempts without post-limit counter growth", async () => {
    for (let index = 0; index < 5; index += 1) {
      const response = await submit(syntheticPayload({
        idempotencyKey: crypto.randomUUID(),
        contactValue: `synthetic-${index}@example.invalid`,
      }));
      expect(response.status).toBe(201);
    }
    const limited = await submit(syntheticPayload({
      idempotencyKey: crypto.randomUUID(),
      contactValue: "synthetic-limited@example.invalid",
    }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    const rateRow = await env.DB.prepare("SELECT key_hash, request_count FROM application_rate_limits ORDER BY request_count DESC LIMIT 1")
      .first<{ key_hash: string; request_count: number }>();
    expect(rateRow?.key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rateRow?.key_hash).not.toContain("192.0.2.44");
    expect(rateRow?.request_count).toBe(5);
    const rowsAtLimit = await env.DB.prepare("SELECT COUNT(*) AS count FROM application_rate_limits")
      .first<{ count: number }>();

    const limitedAgain = await submit(syntheticPayload({
      idempotencyKey: crypto.randomUUID(),
      contactValue: "synthetic-limited-again@example.invalid",
    }));
    expect(limitedAgain.status).toBe(429);
    const saturated = await env.DB.prepare("SELECT MAX(request_count) AS count FROM application_rate_limits")
      .first<{ count: number }>();
    expect(saturated?.count).toBe(5);
    const rowsAfterLimit = await env.DB.prepare("SELECT COUNT(*) AS count FROM application_rate_limits")
      .first<{ count: number }>();
    expect(rowsAfterLimit?.count).toBe(rowsAtLimit?.count);
  });
});

describe("protected administration", () => {
  it("requires authenticated Access and permits lifecycle/internal-note updates only after authorization", async () => {
    const created = await submit();
    const { reference } = await created.json<{ reference: string }>();

    const denied = await handleRequest(request("/admin/api/applications?limit=100"), env, dependencies);
    expect(denied.status).toBe(403);
    expect(await denied.text()).not.toContain("Synthetic Parent");

    const allowedHeaders = { "X-Synthetic-Admin": "allowed" };
    const publicWorkerEnv = { ...env, ADMIN_SURFACE_ENABLED: "false" } as WorkerEnv;
    const deniedOnPublicWorker = await handleRequest(
      request("/admin/api/applications?limit=100", { headers: allowedHeaders }),
      publicWorkerEnv,
      dependencies,
    );
    expect(deniedOnPublicWorker.status).toBe(403);
    expect(await deniedOnPublicWorker.text()).not.toContain("Synthetic Parent");

    const listed = await handleRequest(request("/admin/api/applications?limit=100", { headers: allowedHeaders }), env, dependencies);
    expect(listed.status).toBe(200);
    const listBody = await listed.json<{ applications: Array<{ publicReference: string }> }>();
    expect(listBody.applications[0].publicReference).toBe(reference);

    const updated = await handleRequest(request(`/admin/api/applications/${reference}`, {
      method: "PATCH",
      headers: allowedHeaders,
      body: JSON.stringify({ status: "lesson_booked", internalNotes: "SYNTHETIC INTERNAL NOTE — local test only." }),
    }), env, dependencies);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      ok: true,
      application: { status: "lesson_booked", internalNotes: "SYNTHETIC INTERNAL NOTE — local test only." },
    });
  });
});
