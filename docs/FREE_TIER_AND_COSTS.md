# Free-tier and cost boundaries

Expected operation is zero infrastructure cost only while all selected services and usage stay inside their free eligibility and limits.

## GitHub Pages

GitHub Pages is available on GitHub Free for public repositories. A private repository requires an eligible paid plan. GitHub’s documented operational limits include a recommended 1 GB source repository, a published site no larger than 1 GB, a soft 100 GB/month bandwidth limit, and a 10-minute deployment limit: [GitHub Pages limits](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/github-pages-limits).

This package’s large media assets count toward repository and Pages artifact size. Git LFS does not make LFS objects available to a standard Pages artifact automatically and can itself introduce bandwidth/storage billing, so it is not assumed here.

## Cloudflare Workers

Cloudflare’s current Workers Free limits include 100,000 requests per day, 10 ms CPU time per HTTP request, 128 MB memory per isolate, and 50 subrequests per invocation: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). The public API and dedicated admin surface are separate Workers. They are designed for short validation, HMAC, Turnstile verification, JWT verification, and D1 queries within those limits; requests to both Workers count toward the account's applicable allowance.

On Free, hitting a service limit can cause rejected/failed requests. Cost is introduced if the account is explicitly upgraded to a paid Workers plan or another paid product is enabled; do not upgrade without separate approval.

## D1

Cloudflare’s D1 Free allowance currently includes 5 million rows read per day, 100,000 rows written per day, and 5 GB total storage. Free-plan queries stop once daily read/write limits are reached rather than generating automatic D1 overage charges: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

The application endpoint writes one application plus two small rate-limit counters per attempt, with additional writes on repeated rate-limit activity and admin updates. Tests and monitoring must not create unnecessary production writes.

## Turnstile and Access

Turnstile has a free plan suitable for the public form: [Turnstile overview](https://developers.cloudflare.com/turnstile/get-started/). The admin Worker uses the activated Zero Trust Free plan, one operator-only Access policy, and a 30-minute application session. Zero-cost operation assumes the account remains within the current Free user and request allowances. Do not accept a checkout, upgrade, add paid seats, or enable a paid Zero Trust add-on without separate approval.

## Conditions that can introduce cost

- choosing a private GitHub repository without an already eligible paid plan;
- buying or renewing a custom domain;
- upgrading Workers, D1, Access/Zero Trust, or enabling a paid Cloudflare add-on;
- exceeding limits after explicitly moving to a paid plan;
- adding paid observability/log retention, external email/SMS, storage, analytics, or media delivery;
- using Git LFS or another paid large-file/bandwidth service;
- organizational GitHub Actions usage or retention outside the selected account’s included allowance.

Before deployment, re-check the linked provider pages in the exact chosen accounts because plans and limits can change.
