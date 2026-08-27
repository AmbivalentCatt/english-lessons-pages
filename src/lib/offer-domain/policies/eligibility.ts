import type { PackageLessons } from "../identifiers";
import { PRIVATE_LOYALTY_POLICY } from "./discounts";

export type SyntheticLoyaltyEligibility = Readonly<{
  syntheticRecordId: `synthetic-${string}`;
  completedLessons: number;
  packageLessons: PackageLessons;
  isRenewalOrNewAgreement: boolean;
  loyaltyAlreadyUsed: boolean;
}>;

export function evaluateSyntheticLoyalty(input: SyntheticLoyaltyEligibility): Readonly<{
  eligible: boolean;
  discountMinorUnits: number;
  reason: string;
}> {
  if (!input.syntheticRecordId.startsWith("synthetic-")) {
    throw new TypeError("Only synthetic eligibility records are accepted in the public repository.");
  }
  if (!input.isRenewalOrNewAgreement || input.loyaltyAlreadyUsed || input.packageLessons === 1) {
    return Object.freeze({ eligible: false, discountMinorUnits: 0, reason: "not-eligible" });
  }
  const threshold = [...PRIVATE_LOYALTY_POLICY.thresholds]
    .reverse()
    .find((entry) => input.completedLessons >= entry.minimumCompletedLessons);
  const discountMinorUnits = threshold?.discountMinorUnits ?? 0;
  return Object.freeze({
    eligible: discountMinorUnits > 0,
    discountMinorUnits,
    reason: discountMinorUnits > 0 ? "synthetic-threshold-met" : "below-threshold",
  });
}
