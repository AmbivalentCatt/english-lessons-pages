# Rollback

## GitHub Pages

1. Stop new Pages runs if an incident is active.
2. Identify the last accepted source commit and its successful Pages deployment; do not infer acceptance from a build alone.
3. Re-run the manual Pages workflow from that exact accepted commit, or use GitHub’s Pages deployment controls if the exact artifact is retained and identifiable.
4. Re-verify the public URL, deep links, assets, Worker origin/CORS, and form behavior.

Do not point traffic back by modifying the existing Sites deployment. The live Sites project remains independent and unchanged.

## Workers and Access

Cloudflare supports rolling back to a previous deployed Worker version: [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/). Record accepted version IDs separately for the public API Worker and dedicated admin Worker; never assume that one version identifies both surfaces.

Before rollback, check whether both target Workers expect the currently applied D1 schema. Worker rollback does not undo D1 migrations or application data. Keep the admin Worker behind the existing Access application throughout rollback. If Access itself is the incident source, deny the Access policy or remove the admin destination before changing application logic; do not expose the admin Worker as a troubleshooting shortcut.

## D1

Migrations are forward-versioned. Before any schema migration, inspect the migration list and export/backup data according to the account’s available D1 recovery controls. This initial migration is additive. Future migrations must provide an explicit data-preserving reversal/recovery procedure; never delete application data as an improvised rollback.

## Incident containment

If applicant confidentiality may be affected, disable the public application route or Worker deployment first, preserve evidence without copying applicant values into tickets/logs, rotate affected secrets, and restore only after CORS, Access, JWT validation, and public-response tests pass.
