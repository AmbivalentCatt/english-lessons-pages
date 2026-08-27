import type { OfferSnapshot } from "../types";

export function assertHistoricalSnapshotsInvariant(snapshots: readonly OfferSnapshot[]): true {
  const versions = new Set<string>();
  let previousEffective = Number.NEGATIVE_INFINITY;
  for (const snapshot of [...snapshots].sort((left, right) => Date.parse(left.effectiveFrom) - Date.parse(right.effectiveFrom))) {
    if (versions.has(snapshot.offerVersion)) throw new Error("Historical offer versions must be unique and immutable.");
    versions.add(snapshot.offerVersion);
    const effective = Date.parse(snapshot.effectiveFrom);
    if (!Number.isFinite(effective) || effective <= previousEffective) {
      throw new Error("Historical effective windows must be strictly ordered without overlap.");
    }
    previousEffective = effective;
    if (snapshot.catalog.authority !== "historical") throw new Error("Snapshot catalog must be historical.");
  }
  return true;
}
