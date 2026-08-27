import { CURRENT_OFFER } from "../catalog/current-offer";
import { packageSavings } from "../policies/discounts";

const APPROVED_PRICE_MINOR_UNITS = Object.freeze({
  basic: Object.freeze({ 1: 130_000, 4: 460_000, 8: 874_000 }),
  standard: Object.freeze({ 1: 145_000, 4: 520_000, 8: 988_000 }),
  premium: Object.freeze({ 4: 600_000, 8: 1_140_000 }),
});

export function assertPricingInvariant(): true {
  for (const [tariffId, packages] of Object.entries(APPROVED_PRICE_MINOR_UNITS)) {
    for (const [lessons, expected] of Object.entries(packages)) {
      const actual = CURRENT_OFFER.tariffs[tariffId as keyof typeof CURRENT_OFFER.tariffs]
        .packages[Number(lessons) as 1 | 4 | 8]?.total.minorUnits;
      if (actual !== expected) throw new Error(`Approved price mismatch for ${tariffId}/${lessons}.`);
    }
  }
  if (CURRENT_OFFER.tariffs.premium.packages[1]) throw new Error("PRO must not invent a single price.");
  if (packageSavings("premium", 8).comparator !== "two-four-lesson-packages") {
    throw new Error("PRO eight-pack comparator must be two real four-packs.");
  }
  for (const tariffId of ["basic", "standard"] as const) {
    for (const lessons of [4, 8] as const) {
      if (packageSavings(tariffId, lessons).comparator !== "same-number-of-singles") {
        throw new Error(`${tariffId}/${lessons} comparator must use real singles.`);
      }
    }
  }
  return true;
}
