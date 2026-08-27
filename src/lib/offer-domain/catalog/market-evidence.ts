import { OFFER_PROVENANCE } from "../provenance";

export const DATED_MARKET_AND_TEACHER_COST_EVIDENCE = Object.freeze({
  provenance: OFFER_PROVENANCE.publicEvidenceAugust2026,
  customerPriceAuthority: false,
  reviewedQuarterly: true,
  toolAcquisitionCosts: Object.freeze({
    basicApproximateRubles: 2_626,
    standardApproximateRubles: 28_038,
    premiumApproximateRubles: 28_038,
  }),
});
