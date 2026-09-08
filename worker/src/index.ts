import { CURRENT_AVAILABILITY_SNAPSHOT, CURRENT_AVAILABILITY_VERIFIED_AT_BY_TARIFF } from "../../src/lib/offer-domain/catalog/current-offer";
import { isAvailabilityFresh } from "../../src/lib/offer-domain/policies/availability";
import { CURRENT_PUBLIC_CLAIMS } from "../../src/lib/offer-domain/catalog/current-public-claims";
import { adminHtml } from "./admin-html";
import {
  consumeRateLimit,
  findByIdempotencyHash,
  hasRequiredRuntimeSecrets,
  insertApplication,
  listApplications,
  updateApplication,
} from "./database";
import { hmacHex, verifyAccess, verifyTurnstile } from "./security";
import type { ApplicationStatus, Env, RequestDependencies, ValidatedApplication } from "./types";
import { validateApplicationPayload } from "./validation";

const MAX_BODY_BYTES = 16_384;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_ATTEMPTS = 5;
const publicReferencePattern = /^HEL-[0-9]{8}-[A-Z2-9]{8}$/;
const statuses = new Set<ApplicationStatus>(["new", "contacted", "lesson_booked", "closed"]);

const defaultDependencies: RequestDependencies = {
  now: () => new Date(),
  verifyAccess,
  verifyTurnstile,
};

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...securityHeaders(), ...extraHeaders },
  });
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function corsHeaders(env: Env, request: Request) {
  const allowed = normalizeOrigin(env.ALLOWED_ORIGIN);
  const origin = request.headers.get("Origin") ?? "";
  if (!allowed || origin !== allowed) return null;
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function safePublicFailure(
  request: Request,
  env: Env,
  status: number,
  message: string,
  type: "validation" | "rate-limit" | "server",
  errors?: Record<string, string>,
  extraHeaders: Record<string, string> = {},
) {
  const cors = corsHeaders(env, request) ?? {};
  return json({ ok: false, type, message, ...(errors ? { errors } : {}) }, status, { ...cors, ...extraHeaders });
}

function canonicalApplicantData(payload: ValidatedApplication) {
  return JSON.stringify({
    contactMethod: payload.contactMethod,
    contactValue: payload.contactValue,
    englishLevel: payload.englishLevel,
    goals: payload.goals,
    learnerAgeOrGrade: payload.learnerAgeOrGrade,
    learnerName: payload.learnerName,
    lessonFormat: payload.lessonFormat,
    notes: payload.notes,
    packageLessons: payload.packageLessons,
    parentName: payload.parentName,
    policyAcknowledged: payload.policyAcknowledged,
    preferredSchedule: payload.preferredSchedule,
    privacyAcknowledged: payload.privacyAcknowledged,
    tariffId: payload.tariffId,
  });
}

function publicReference(now: Date) {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `HEL-${date}-${suffix}`;
}

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return { tooLarge: true as const };
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) return { tooLarge: true as const };
  try {
    return { tooLarge: false as const, value: JSON.parse(new TextDecoder().decode(buffer)) as unknown };
  } catch {
    return { tooLarge: false as const, invalid: true as const };
  }
}

async function handleAvailability(request: Request, env: Env, now: Date) {
  const cors = corsHeaders(env, request);
  if (!cors) return json({ ok: false, message: "Origin is not allowed." }, 403);
  const availability = Object.fromEntries(
    (["basic", "standard", "premium"] as const).map((tariffId) => {
      const verifiedAt = CURRENT_AVAILABILITY_VERIFIED_AT_BY_TARIFF[tariffId];
      const fresh = isAvailabilityFresh({ ...CURRENT_AVAILABILITY_SNAPSHOT, verifiedAt }, now.toISOString());
      return [tariffId, {
        verifiedAt,
        label: fresh ? "Осталось мест" : CURRENT_PUBLIC_CLAIMS.staleAvailability,
        ...(fresh ? { remaining: CURRENT_AVAILABILITY_SNAPSHOT.remaining[tariffId] } : {}),
        status: fresh ? "fresh" : "confirmation-required",
      }];
    }),
  );
  return json({
    ok: true,
    availability: {
      fresh: Object.values(availability).every(value => value.status === "fresh"),
      tariffs: availability,
      verifiedAt: CURRENT_AVAILABILITY_SNAPSHOT.verifiedAt,
    },
  }, 200, {
    ...cors,
    "Cache-Control": "public, max-age=300",
  });
}

async function handleApplication(request: Request, env: Env, dependencies: RequestDependencies) {
  const cors = corsHeaders(env, request);
  if (!cors) return json({ ok: false, message: "Origin is not allowed." }, 403);
  if (!hasRequiredRuntimeSecrets(env)) {
    return safePublicFailure(request, env, 503, "Форма временно недоступна.", "server");
  }
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return safePublicFailure(request, env, 415, "Ожидается JSON-запрос.", "validation");
  }
  const parsed = await readJsonBody(request);
  if (parsed.tooLarge) return safePublicFailure(request, env, 413, "Запрос слишком большой.", "validation");
  if ("invalid" in parsed) return safePublicFailure(request, env, 400, "Не удалось прочитать заявку.", "validation");
  const validated = validateApplicationPayload(parsed.value);
  if (!validated.ok) {
    return safePublicFailure(
      request,
      env,
      422,
      validated.spam ? "Не удалось отправить заявку." : "Проверьте поля заявки.",
      "validation",
      validated.spam ? undefined : validated.errors as Record<string, string>,
    );
  }

  const idempotencyHash = await hmacHex(env.RATE_LIMIT_SALT, `idempotency:${validated.value.idempotencyKey}`);
  const requestHash = await hmacHex(env.RATE_LIMIT_SALT, `request:${canonicalApplicantData(validated.value)}`);
  const existing = await findByIdempotencyHash(env.DB, idempotencyHash);
  if (existing) {
    if (existing.request_hash !== requestHash) {
      return safePublicFailure(request, env, 409, "Эта попытка уже использована для другой заявки. Обновите форму.", "validation");
    }
    return json({ ok: true, reference: existing.public_reference, createdAt: existing.submitted_at, duplicate: true }, 200, cors);
  }

  const now = dependencies.now();
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const turnstile = await dependencies.verifyTurnstile({
    env,
    idempotencyKey: validated.value.idempotencyKey,
    ip,
    token: validated.value.turnstileToken,
  });
  if (!turnstile.success) {
    return safePublicFailure(request, env, 422, "Защитная проверка не пройдена. Обновите её и повторите отправку.", "validation", {
      turnstileToken: "Пройдите защитную проверку ещё раз.",
    });
  }

  const ipHash = await hmacHex(env.RATE_LIMIT_SALT, `ip:${ip}`);
  const contactHash = await hmacHex(env.RATE_LIMIT_SALT, `contact:${validated.value.contactMethod}:${validated.value.contactValue.toLowerCase()}`);
  const ipLimit = await consumeRateLimit({
    db: env.DB,
    keyHash: ipHash,
    limit: RATE_LIMIT_ATTEMPTS,
    now,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!ipLimit.allowed) {
    return safePublicFailure(request, env, 429, "Слишком много попыток. Попробуйте позже.", "rate-limit", undefined, {
      "Retry-After": String(ipLimit.retryAfterSeconds),
    });
  }
  const contactLimit = await consumeRateLimit({
    db: env.DB,
    keyHash: contactHash,
    limit: RATE_LIMIT_ATTEMPTS,
    now,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!contactLimit.allowed) {
    return safePublicFailure(request, env, 429, "Слишком много попыток. Попробуйте позже.", "rate-limit", undefined, {
      "Retry-After": String(contactLimit.retryAfterSeconds),
    });
  }

  const reference = publicReference(now);
  try {
    await insertApplication({
      db: env.DB,
      idempotencyHash,
      now,
      payload: validated.value,
      publicReference: reference,
      requestHash,
    });
  } catch {
    const raced = await findByIdempotencyHash(env.DB, idempotencyHash);
    if (raced && raced.request_hash === requestHash) {
      return json({ ok: true, reference: raced.public_reference, createdAt: raced.submitted_at, duplicate: true }, 200, cors);
    }
    return safePublicFailure(request, env, 503, "Заявка не была сохранена. Повторите отправку позже.", "server");
  }

  return json({ ok: true, reference, createdAt: now.toISOString(), duplicate: false }, 201, cors);
}

async function requireAdmin(request: Request, env: Env, dependencies: RequestDependencies) {
  return dependencies.verifyAccess(request, env);
}

function adminHeaders(nonce?: string) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Security-Policy": nonce
      ? `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
      : "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

async function handleAdmin(request: Request, env: Env, dependencies: RequestDependencies, url: URL) {
  if (!await requireAdmin(request, env, dependencies)) {
    return json({ ok: false, message: "Protected access required." }, 403, adminHeaders());
  }
  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    const nonce = crypto.randomUUID().replaceAll("-", "");
    return new Response(adminHtml(nonce), {
      headers: { ...adminHeaders(nonce), "Content-Type": "text/html; charset=utf-8" },
    });
  }
  if (url.pathname === "/admin/api/applications" && request.method === "GET") {
    const requestedLimit = Number(url.searchParams.get("limit") ?? "100");
    const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;
    const applications = await listApplications(env.DB, limit);
    return json({ ok: true, applications }, 200, adminHeaders());
  }
  const match = url.pathname.match(/^\/admin\/api\/applications\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    const reference = decodeURIComponent(match[1]);
    if (!publicReferencePattern.test(reference)) return json({ ok: false, message: "Invalid reference." }, 400, adminHeaders());
    if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      return json({ ok: false, message: "Expected JSON." }, 415, adminHeaders());
    }
    const parsed = await readJsonBody(request);
    if (parsed.tooLarge) return json({ ok: false, message: "Request too large." }, 413, adminHeaders());
    if ("invalid" in parsed || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
      return json({ ok: false, message: "Invalid request." }, 400, adminHeaders());
    }
    const input = parsed.value as Record<string, unknown>;
    if (Object.keys(input).some((key) => key !== "status" && key !== "internalNotes")) {
      return json({ ok: false, message: "Unknown field." }, 400, adminHeaders());
    }
    if (typeof input.status !== "string" || !statuses.has(input.status as ApplicationStatus)
      || typeof input.internalNotes !== "string" || input.internalNotes.length > 4000) {
      return json({ ok: false, message: "Invalid update." }, 422, adminHeaders());
    }
    const application = await updateApplication({
      db: env.DB,
      internalNotes: input.internalNotes.normalize("NFC").trim(),
      now: dependencies.now(),
      publicReference: reference,
      status: input.status as ApplicationStatus,
    });
    return application
      ? json({ ok: true, application }, 200, adminHeaders())
      : json({ ok: false, message: "Application not found." }, 404, adminHeaders());
  }
  return json({ ok: false, message: "Not found." }, 404, adminHeaders());
}

export async function handleRequest(
  request: Request,
  env: Env,
  dependencies: RequestDependencies = defaultDependencies,
) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/admin")) {
    if (env.ADMIN_SURFACE_ENABLED !== "true") {
      return json({ ok: false, message: "Protected access required." }, 403, adminHeaders());
    }
    return handleAdmin(request, env, dependencies, url);
  }

  if (url.pathname === "/api/applications" || url.pathname === "/api/availability") {
    if (request.method === "OPTIONS") {
      const cors = corsHeaders(env, request);
      return cors ? new Response(null, { status: 204, headers: cors }) : json({ ok: false, message: "Origin is not allowed." }, 403);
    }
  }
  if (url.pathname === "/api/availability" && request.method === "GET") {
    return handleAvailability(request, env, dependencies.now());
  }
  if (url.pathname === "/api/applications" && request.method === "POST") {
    return handleApplication(request, env, dependencies);
  }
  return json({ ok: false, message: "Not found." }, 404);
}

export default {
  fetch(request: Request, env: Env) {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
