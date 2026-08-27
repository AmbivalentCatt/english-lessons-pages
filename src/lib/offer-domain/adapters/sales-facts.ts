import { DATED_MARKET_AND_TEACHER_COST_EVIDENCE } from "../catalog/market-evidence";
import { CURRENT_OFFER } from "../catalog/current-offer";

export function salesFactsAdapter() {
  return Object.freeze({
    offerVersion: CURRENT_OFFER.offerVersion,
    tariffs: Object.freeze(Object.values(CURRENT_OFFER.tariffs).map((tariff) => Object.freeze({
      id: tariff.id,
      label: tariff.publicLabel,
      packages: tariff.packages,
      duration: tariff.duration,
      audiences: tariff.audiences,
      formats: tariff.formats,
    }))),
    datedEvidence: DATED_MARKET_AND_TEACHER_COST_EVIDENCE,
  });
}
