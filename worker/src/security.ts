import { createRemoteJWKSet, jwtVerify } from "jose";

import type { Env, TurnstileVerification } from "./types";

const encoder = new TextEncoder();
const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(input: {
  env: Env;
  idempotencyKey: string;
  ip: string;
  token: string;
}): Promise<TurnstileVerification> {
  if (!input.env.TURNSTILE_SECRET_KEY || !input.env.TURNSTILE_EXPECTED_HOSTNAME) {
    return { success: false };
  }
  const body = new FormData();
  body.set("secret", input.env.TURNSTILE_SECRET_KEY);
  body.set("response", input.token);
  body.set("remoteip", input.ip);
  body.set("idempotency_key", input.idempotencyKey);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!response.ok) return { success: false };
    const result = await response.json<TurnstileVerification>();
    return result.success
      && result.hostname === input.env.TURNSTILE_EXPECTED_HOSTNAME
      && result.action === "lesson_application"
      ? result
      : { success: false };
  } catch {
    return { success: false };
  }
}

export async function verifyAccess(request: Request, env: Env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) return false;
  let domain: URL;
  try {
    domain = new URL(env.ACCESS_TEAM_DOMAIN);
  } catch {
    return false;
  }
  if (domain.protocol !== "https:" || !domain.hostname.endsWith(".cloudflareaccess.com")) return false;
  let jwks = jwksByDomain.get(domain.origin);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", domain.origin));
    jwksByDomain.set(domain.origin, jwks);
  }
  try {
    await jwtVerify(token, jwks, {
      audience: env.ACCESS_AUD,
      issuer: domain.origin,
    });
    return true;
  } catch {
    return false;
  }
}
