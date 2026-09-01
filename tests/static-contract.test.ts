import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { applicationStatuses, packagesByTariff } from "../src/lib/application-contract";
import { CURRENT_AVAILABILITY_SNAPSHOT } from "../src/lib/offer-domain/catalog/current-offer";

const root = path.resolve(import.meta.dirname, "..");

describe("static migration contract", () => {
  it("preserves the accepted package choices and requested status lifecycle", () => {
    expect(packagesByTariff).toEqual({ basic: [1, 4, 8], standard: [1, 4, 8], premium: [4, 8] });
    expect(applicationStatuses).toEqual(["new", "contacted", "lesson_booked", "closed"]);
  });

  it("publishes the user-approved remaining-place ledger without changing capacity", () => {
    expect(CURRENT_AVAILABILITY_SNAPSHOT.capacities).toEqual({ basic: 5, standard: 7, premium: 4 });
    expect(CURRENT_AVAILABILITY_SNAPSHOT.remaining).toEqual({ basic: 3, standard: 1, premium: 2 });
  });

  it("uses the separate Worker API and mandatory Turnstile flow", async () => {
    const component = await readFile(path.join(root, "src/components/LiquidReferenceHeroV7.tsx"), "utf8");
    expect(component).toContain('applicationApiUrl("/api/applications")');
    expect(component).toContain('applicationApiUrl("/api/availability")');
    expect(component).toContain("TURNSTILE_SITE_KEY");
    expect(component).toContain("turnstileToken");
    expect(component).not.toContain("/api/applications/token");
    expect(component).not.toContain("/api/offer/availability");
  });

  it("keeps Sites hosting and private administration out of the static package", async () => {
    const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
    expect(gitignore).toContain("worker/wrangler.production.jsonc");
    await expect(readFile(path.join(root, ".openai/hosting.json"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(root, "src/components/AdminApplicationsDashboard.tsx"), "utf8")).rejects.toThrow();
  });
});
