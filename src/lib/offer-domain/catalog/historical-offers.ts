import { resolvedEffectiveFrom, type MoscowIsoInstant } from "../effective-window";
import type { OfferCatalog, OfferSnapshot } from "../types";

export function createImmutableOfferSnapshot(
  catalog: OfferCatalog,
  effectiveFrom: MoscowIsoInstant,
  catalogFingerprint: string,
): OfferSnapshot {
  const historicalCatalog = Object.freeze({
    ...catalog,
    authority: "historical" as const,
    effectiveFrom: resolvedEffectiveFrom(effectiveFrom),
  });
  return Object.freeze({
    offerVersion: historicalCatalog.offerVersion,
    effectiveFrom,
    catalogFingerprint,
    catalog: historicalCatalog,
  });
}

export function selectOfferSnapshot(
  paidAt: string,
  snapshots: readonly OfferSnapshot[],
): OfferSnapshot | null {
  const paidAtMs = Date.parse(paidAt);
  if (!Number.isFinite(paidAtMs)) throw new TypeError("Payment timestamp is invalid.");
  return [...snapshots]
    .sort((left, right) => Date.parse(right.effectiveFrom) - Date.parse(left.effectiveFrom))
    .find((snapshot) => paidAtMs >= Date.parse(snapshot.effectiveFrom)) ?? null;
}

export const HISTORICAL_OFFERS = Object.freeze([]) as readonly OfferSnapshot[];
