import type { TariffId } from "../identifiers";

export const V7_VISUAL_TIER_BY_TARIFF = Object.freeze({
  basic: Object.freeze({ tierIndex: 0, visualTierId: "basic" }),
  standard: Object.freeze({ tierIndex: 1, visualTierId: "standard" }),
  premium: Object.freeze({ tierIndex: 2, visualTierId: "pro" }),
} as const satisfies Record<TariffId, Readonly<{ tierIndex: number; visualTierId: string }>>);

export function visualTierForTariff(tariffId: TariffId) {
  return V7_VISUAL_TIER_BY_TARIFF[tariffId];
}
