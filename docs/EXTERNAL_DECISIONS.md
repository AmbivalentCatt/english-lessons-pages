# External decision gate

No external resource may be created or changed until all three decisions are explicit.

## GitHub destination

Provide the exact repository owner/name and visibility.

- Zero-cost GitHub Free option: a separate **public** repository. This publishes all static source and media; the artifact scan must pass first.
- Private repository: use only if the exact account already has an eligible paid GitHub plan. Pages availability and Actions allowance must be checked before dispatch.

Do not make the existing project repository public and do not create a new repository without explicit approval.

## Cloudflare destination and protected operator

Provide the exact Cloudflare account plus approval for the exact Worker, D1, Turnstile, and Access resource names. Also identify the operator identity or identity group that Cloudflare Access must allow. Do not send an API token, Turnstile secret, Access token, or other credential in chat; use authenticated CLI/browser flows after approval.

## Domain

- Zero-purchase option: GitHub Pages hostname for the site and the approved `workers.dev` hostname for the Worker.
- Custom domain: provide an exact already-owned domain and separately authorize DNS changes.

The final site origin determines Worker CORS, Turnstile hostname restrictions, CSP, GitHub Pages metadata, and the Access application hostname. These must be configured as one consistent deployment set.
