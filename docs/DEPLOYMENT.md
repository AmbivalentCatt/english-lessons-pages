# Deployment and acceptance

Local completion, workflow dispatch, deployment acceptance, public availability, synthetic persistence, and protected admin access are separate stages. Do not describe the migration as deployed until every applicable stage has direct evidence.

## Stage 1: local package

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm verify:artifact
pnpm test:e2e
```

Inspect desktop, mobile, and reduced-motion views. Confirm poster fallbacks and that every local media request resolves below the configured repository subpath.

## Stage 2: approved Cloudflare destination

After the external decision gate is explicitly approved:

1. Authenticate Wrangler through the approved browser/CLI flow; never paste tokens into chat.
2. Create the approved D1 database name in the approved account.
3. Copy `worker/wrangler.production.example.jsonc` to the ignored `worker/wrangler.production.jsonc` for the public API Worker, replacing only approved non-secret resource identifiers and the final site origin/hostname. Keep `ADMIN_SURFACE_ENABLED` set to `false`.
4. Copy `worker/wrangler.admin.production.example.jsonc` to the ignored `worker/wrangler.admin.production.jsonc` for the dedicated admin Worker. Bind the same D1 database, keep `ADMIN_SURFACE_ENABLED` set to `true`, and configure the approved Access team domain and application audience.
5. Set encrypted public-API Worker secrets with interactive Wrangler commands:

   ```bash
   wrangler secret put TURNSTILE_SECRET_KEY --config worker/wrangler.production.jsonc
   wrangler secret put RATE_LIMIT_SALT --config worker/wrangler.production.jsonc
   ```

6. Apply migrations deliberately:

   ```bash
   wrangler d1 migrations list <approved-d1-name> --remote --config worker/wrangler.production.jsonc
   wrangler d1 migrations apply <approved-d1-name> --remote --config worker/wrangler.production.jsonc
   ```

7. Deploy the public API Worker and record its immutable version identifier.
8. Deploy the dedicated admin Worker with `worker/wrangler.admin.production.jsonc` and record its immutable version identifier.
9. Create a Turnstile widget restricted to the final Pages hostname. Configure its public site key as the GitHub repository variable `TURNSTILE_SITE_KEY`; keep the secret only in the public API Worker secrets.
10. Create a Cloudflare Access self-hosted application that protects the dedicated admin Worker production and preview hostnames in full. Restrict the policy to the approved identity and use a short session. Never put Access in front of the public application API hostname.
11. Verify the public API Worker's `/admin` denial, the admin Worker's unauthenticated Access redirect, authenticated UI load, JWT second-gate validation, and status/internal-note update using only a clearly marked synthetic record.

Cloudflare’s local D1/migration guidance: [D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/) and [Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/).

## Stage 3: approved GitHub repository

The package is designed to become the root of a separate repository. Confirm the exact repository and its visibility first. For GitHub Free Pages, the repository must be public; private Pages requires an eligible paid plan. GitHub documents custom Pages workflows here: [GitHub Pages custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Set non-secret repository variables:

- `APPLICATION_API_BASE`: final `https://` Worker API base, without a trailing slash;
- `TURNSTILE_SITE_KEY`: public Turnstile site key;
- optional `PUBLIC_SITE_URL`: exact final site URL when the derived GitHub Pages URL is not correct;
- optional `PAGES_BASE`: `/` for a user/organization site or `/repository-name/` for a project site.

Select GitHub Actions as the Pages source, manually dispatch `Verify and deploy GitHub Pages`, and wait for both jobs. The workflow verifies type safety, lint, tests, Worker/D1 behavior, static build, asset paths, and artifact privacy before upload.

## Stage 4: public acceptance

Verify directly after deployment:

- exact public URL and TLS;
- home and legacy deep-link refresh behavior;
- custom 404 shell;
- no 404/blocked images, posters, videos, modules, or fonts;
- desktop, narrow mobile, Safari/iOS fallback where available, keyboard navigation, focus return, and reduced motion;
- exact CORS behavior from the final origin and rejection from another origin;
- Turnstile success plus a failed/expired token path;
- one synthetic application is saved once, returns a public reference, appears in authenticated admin, and can move through a lifecycle update;
- no applicant data or private notes appear in browser source, static artifacts, public API responses, GitHub logs, or Worker logs.

Remove the synthetic record immediately under [TEST_DATA_POLICY.md](TEST_DATA_POLICY.md). Record every stage separately; a green Pages job alone is not application persistence or protected-admin evidence.

## Custom domain

No custom domain is required. The zero-purchase path uses the GitHub Pages hostname and the Worker’s approved `workers.dev` hostname. If an already-owned domain is selected, DNS and domain verification are separate authorized changes; update Pages, Turnstile hostname restrictions, Worker `ALLOWED_ORIGIN`, `TURNSTILE_EXPECTED_HOSTNAME`, CSP/API origin, Access application hostname, and public acceptance together.
