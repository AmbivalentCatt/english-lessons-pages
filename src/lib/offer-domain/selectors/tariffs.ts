import { CURRENT_OFFER } from "../catalog/current-offer";
import type { AudienceId, TariffId } from "../identifiers";

export function selectTariff(tariffId: TariffId) {
  return CURRENT_OFFER.tariffs[tariffId];
}

export function tariffsForAudience(audience: AudienceId) {
  return Object.values(CURRENT_OFFER.tariffs).filter((tariff) => tariff.audiences.includes(audience));
}
