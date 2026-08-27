# Security design

## Public application boundary

The static bundle contains no credential and cannot write to D1 directly. The Worker accepts only JSON at `POST /api/applications` from the exact configured `ALLOWED_ORIGIN`.

Controls implemented server-side:

- exact field allowlist; unknown fields are rejected;
- 16 KiB request limit using both declared and actual body size;
- normalized strings, per-field length bounds, enum validation, package/tariff validation, and mandatory consent fields;
- an invisible honeypot field with a generic failure;
- mandatory Turnstile token verification through Cloudflare Siteverify;
- expected Turnstile action and hostname checks;
- Turnstile verification before any D1-backed rate-limit mutation, so failed challenges cannot consume another applicant's allowance or create durable rate rows;
- random UUID idempotency key, stored only as a keyed HMAC;
- idempotent replay of an identical saved request and rejection of mismatched key reuse;
- per-IP and per-contact fixed-window limits, with only keyed HMACs stored in D1;
- counters that stop writing after the fixed-window threshold is reached;
- safe public error bodies that contain no applicant payload, stack, credential, or database detail;
- no applicant-value logging in application code;
- D1 unique constraints for public references and idempotency hashes.

Cloudflare documents that Turnstile tokens must be validated server-side, expire after five minutes, and are single-use: [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

`TURNSTILE_SECRET_KEY` and `RATE_LIMIT_SALT` must be set as encrypted Worker secrets. `VITE_TURNSTILE_SITE_KEY` is public by design. No D1 password or credential is embedded; the Worker receives D1 through its Cloudflare binding.

## Data stored in D1

The migration stores only explicitly allowed applicant fields plus:

- a unique public reference;
- submission timestamp;
- status (`new`, `contacted`, `lesson_booked`, or `closed`);
- status-updated timestamp;
- private internal notes;
- keyed request/idempotency hashes.

Raw IP addresses and rate-limit contact values are not stored in rate-limit rows. Application contact data is necessarily stored because it is required to follow up with an applicant; it is never returned by the public API.

## Protected administration

The admin UI and admin JSON API live under `/admin` on a dedicated admin Worker. There is no client-side password, shared secret in JavaScript, or local-storage credential. The public application API and the admin surface use distinct Worker hostnames so that Access can protect the entire admin hostname without blocking public form submissions.

Production requires a Cloudflare Access self-hosted application covering the dedicated admin Worker hostname and an identity policy restricted to the approved operator identity. Access is the outer gate. The Worker is the second gate: it validates `Cf-Access-Jwt-Assertion` against the configured Access team issuer and public JWKS, and requires the configured application audience. `ADMIN_SURFACE_ENABLED` is `true` only on the dedicated admin Worker; the public API Worker returns a protected-access denial before attempting JWT validation. Cloudflare’s documented JWT validation requirements are here: [Validate Access tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Deployment acceptance requires direct readback of the exact Cloudflare account, Access team domain, Access application audience, allowed operator identity, unauthenticated redirect, authenticated access, and Worker-side JWT validation. Merely creating the Access application is not protected-admin acceptance.

## Browser and response hardening

- strict CORS on public endpoints;
- no CORS on admin endpoints;
- CSP on the static site and a nonce-based, self-only CSP on admin;
- no-store caching for application/admin responses;
- frame denial, MIME sniffing denial, restrictive permissions policy, and no-referrer policy;
- DOM rendering via `textContent` in admin; applicant strings are not inserted as HTML.

## Secrets and privacy scans

`pnpm verify:artifact` examines the final `dist` tree, rejects symlinks, checks route/media completeness and Pages size limits, scans for credential signatures and private data indicators, and verifies that the static bundle has no admin/private API implementation. The repository intentionally ignores:

- `.env` and `.env.*` except `.env.example`;
- `.dev.vars` and `.dev.vars.*` except the example;
- `worker/wrangler.production.jsonc`;
- `worker/wrangler.admin.production.jsonc`;
- local Wrangler/D1 state, test artifacts, and browser traces.

Never paste or commit a secret to “test” the scanner. Rotate immediately through the provider if a secret is ever exposed.
