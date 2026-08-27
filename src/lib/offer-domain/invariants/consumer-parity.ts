import type { PackageLessons, TariffId } from "../identifiers";
import { formatRubles } from "../money";
import { packageChoices } from "../selectors/packages";
import { CURRENT_OFFER } from "../catalog/current-offer";

export type LegacyConsumerTariff = Readonly<{
  id: TariffId;
  v7Name: string;
  duration: string;
  prices: readonly Readonly<{ lessons: PackageLessons; price: string }>[];
}>;

export function compareLegacyTariffFacts(legacy: readonly LegacyConsumerTariff[]) {
  const mismatches: string[] = [];
  for (const tariffId of ["basic", "standard", "premium"] as const) {
    const consumer = legacy.find((tariff) => tariff.id === tariffId);
    const authority = CURRENT_OFFER.tariffs[tariffId];
    if (!consumer) {
      mismatches.push(`${tariffId}:missing`);
      continue;
    }
    if (consumer.v7Name !== authority.publicLabel) mismatches.push(`${tariffId}:label`);
    const duration = authority.duration.minimumMinutes === authority.duration.maximumMinutes
      ? `${authority.duration.minimumMinutes} минут`
      : `${authority.duration.minimumMinutes}–${authority.duration.maximumMinutes} минут`;
    if (consumer.duration !== duration) mismatches.push(`${tariffId}:duration`);
    for (const lessons of packageChoices(tariffId)) {
      const expected = formatRubles(authority.packages[lessons]!.total);
      if (consumer.prices.find((price) => price.lessons === lessons)?.price !== expected) {
        mismatches.push(`${tariffId}:${lessons}:price`);
      }
    }
  }
  return Object.freeze(mismatches);
}

export function compareCandidate03Packages(
  packages: Readonly<Record<TariffId, readonly PackageLessons[]>>,
) {
  const mismatches = (["basic", "standard", "premium"] as const)
    .filter((tariffId) => packages[tariffId].join(",") !== packageChoices(tariffId).join(","))
    .map((tariffId) => `${tariffId}:packages`);
  return Object.freeze(mismatches);
}
