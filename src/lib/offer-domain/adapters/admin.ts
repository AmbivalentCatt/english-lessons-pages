import { CURRENT_OFFER } from "../catalog/current-offer";
import type { TariffId } from "../identifiers";

export function adminTariffLabel(tariffId: TariffId): string {
  return CURRENT_OFFER.tariffs[tariffId].publicLabel;
}

export const ADMIN_OFFER_SNAPSHOT_FIELDS = Object.freeze([
  "offerVersion",
  "offerEffectiveFrom",
  "quotedPriceMinorUnits",
  "quotedCurrency",
  "quotedAt",
] as const);
