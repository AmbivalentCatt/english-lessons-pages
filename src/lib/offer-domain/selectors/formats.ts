import { CURRENT_OFFER } from "../catalog/current-offer";
import type { LessonFormatId, TariffId } from "../identifiers";

export function formatChoices(tariffId: TariffId): readonly LessonFormatId[] {
  return CURRENT_OFFER.tariffs[tariffId].formats;
}

export function isFormatAvailableAtSamePrice(tariffId: TariffId, format: LessonFormatId): boolean {
  return CURRENT_OFFER.tariffs[tariffId].formats.includes(format);
}
