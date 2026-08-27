# English lessons: GitHub Pages + Cloudflare Worker/D1

This directory is a publication-independent migration of the exact latest accepted English-lessons Sites deployment. It preserves the existing visual site and moves only the application persistence boundary to a separately deployed Cloudflare Worker with D1.

Nothing in this package deploys automatically. The Pages workflow is manual-only (`workflow_dispatch`). Production Wrangler files and all secrets remain ignored. The approved zero-purchase deployment uses a public GitHub Pages project site and two free `workers.dev` Workers: one public application API and one Cloudflare Access-protected admin surface.

## Architecture

- `src/`, `public/`: static React/Vite site, including the accepted responsive layout, animation sequence, images, video assets, poster fallbacks, application dialog, and contact/booking flow.
- `worker/src/`: shared application API and private admin implementation, deployed as separate public-API and Access-protected admin Workers.
- `worker/migrations/`: versioned D1 schema.
- `.github/workflows/deploy-pages.yml`: manual GitHub Pages build, verification, artifact upload, and deployment.
- `tests/`, `worker/test/`: static contracts, Worker/D1 integration tests, and desktop/mobile browser checks.
- `docs/`: provenance, security, deployment, rollback, cost, and synthetic-data policy.

The public frontend calls only:

- `GET /api/availability`
- `POST /api/applications`

The dedicated admin Worker serves the authenticated admin UI and JSON API under `/admin`. Cloudflare Access protects its complete hostname, and the Worker independently validates the Access JWT issuer, audience, signature, and expiration before disclosing data. The public API Worker is not an admin entry point: `ADMIN_SURFACE_ENABLED=false` denies its `/admin` routes before JWT evaluation.

## Local verification

Node.js 22.13 or newer and pnpm 10.17.1 are required.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm verify:artifact
pnpm test:e2e
```

For a repository-subpath build:

```bash
GITHUB_PAGES_BASE=/repository-name/ \
VITE_PUBLIC_SITE_URL=https://owner.github.io/repository-name \
VITE_APPLICATION_API_BASE=https://applications.example.invalid \
VITE_TURNSTILE_SITE_KEY=public-site-key \
pnpm build
```

Turnstile site keys are designed to be public. The corresponding secret key is never a Vite variable and belongs only in encrypted Worker secrets.

## Local Worker and D1

Copy `worker/.dev.vars.example` to `worker/.dev.vars`, fill it only with local test values, and keep that ignored file private. Then apply the migration and start the Worker:

```bash
pnpm verify:migrations
pnpm worker:dev
```

The automated Worker suite uses an isolated local D1 database and clearly marked synthetic `.invalid` applicant data. It does not call Turnstile, Access, production Workers, or production D1.

## Before any external action

Complete the decision gate in [docs/EXTERNAL_DECISIONS.md](docs/EXTERNAL_DECISIONS.md). Do not add a real production Wrangler file, dispatch Pages, create Cloudflare resources, change DNS, or submit a production application until the exact destinations are approved. Never put secrets in chat, GitHub variables, Vite variables, source files, test fixtures, or documentation.

Detailed operating instructions:

- [Source provenance](docs/SOURCE_PROVENANCE.md)
- [Security design](docs/SECURITY.md)
- [Deployment and acceptance](docs/DEPLOYMENT.md)
- [Rollback](docs/ROLLBACK.md)
- [Free-tier and cost boundaries](docs/FREE_TIER_AND_COSTS.md)
- [Synthetic test-data policy](docs/TEST_DATA_POLICY.md)

The existing ChatGPT Sites project is outside this deployment path and must remain unchanged.
