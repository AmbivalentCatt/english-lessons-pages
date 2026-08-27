import { CURRENT_OFFER } from "../catalog/current-offer";
import type { PackageLessons, TariffId } from "../identifiers";

export function packageChoices(tariffId: TariffId): readonly PackageLessons[] {
  return ([1, 4, 8] as const).filter((lessons) => Boolean(CURRENT_OFFER.tariffs[tariffId].packages[lessons]));
}

export function selectPackage(tariffId: TariffId, lessons: PackageLessons) {
  return CURRENT_OFFER.tariffs[tariffId].packages[lessons] ?? null;
}
