import { CURRENT_CAPACITY_TOTAL, CURRENT_OFFER } from "../catalog/current-offer";
import { TARIFF_IDS } from "../identifiers";

export function assertCatalogInvariant(): true {
  if (CURRENT_OFFER.schemaVersion !== 1) throw new Error("Offer schema version changed unexpectedly.");
  if (CURRENT_OFFER.authority !== "candidate04-production-approved") {
    throw new Error("Candidate 04 must use the approved production authority.");
  }
  if (CURRENT_OFFER.effectiveFrom.status !== "resolved"
    || CURRENT_OFFER.effectiveFrom.at !== "2026-08-26T04:50:21+03:00") {
    throw new Error("Candidate 04 release effective instant changed unexpectedly.");
  }
  if (CURRENT_CAPACITY_TOTAL !== 16) throw new Error("Approved capacity total must remain 16.");
  if (Object.keys(CURRENT_OFFER.tariffs).join(",") !== TARIFF_IDS.join(",")) {
    throw new Error("Stable tariff IDs changed.");
  }
  if (CURRENT_OFFER.tariffs.premium.legacyName !== "Premium" || CURRENT_OFFER.tariffs.premium.publicLabel !== "PRO") {
    throw new Error("Stable premium storage ID and PRO public label must remain separate.");
  }
  return true;
}
