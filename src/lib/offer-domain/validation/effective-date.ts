import { isPaidUnderOffer, type EffectiveFrom } from "../effective-window";

export function validateEffectiveDateSelection(
  paidAt: string,
  effectiveFrom: EffectiveFrom,
): Readonly<{ applies: boolean; reason: "pending-publication" | "paid-before-effective" | "paid-at-or-after-effective" }> {
  if (effectiveFrom.status === "pending-publication") {
    return Object.freeze({ applies: false, reason: "pending-publication" });
  }
  const applies = isPaidUnderOffer(paidAt, effectiveFrom);
  return Object.freeze({ applies, reason: applies ? "paid-at-or-after-effective" : "paid-before-effective" });
}
