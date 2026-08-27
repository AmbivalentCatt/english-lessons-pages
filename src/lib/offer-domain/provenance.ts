export type EvidenceClassification =
  | "approved-current-public"
  | "approved-current-private"
  | "dated-public-evidence"
  | "historical"
  | "forecast"
  | "proposal"
  | "rejected";

export type OfferProvenance = Readonly<{
  id: string;
  classification: EvidenceClassification;
  verifiedMonth?: `${number}-${number}`;
  reviewCadenceMonths?: number;
  nextReviewMonth?: `${number}-${number}`;
  customerPriceAuthority: boolean;
  publicSafe: boolean;
}>;

export const OFFER_PROVENANCE = Object.freeze({
  version21: Object.freeze({
    id: "sites-version-21-accepted-public",
    classification: "approved-current-public",
    verifiedMonth: "2026-08",
    customerPriceAuthority: true,
    publicSafe: true,
  }),
  selectedB: Object.freeze({
    id: "selected-b-standard-led-price-ledger",
    classification: "approved-current-private",
    verifiedMonth: "2026-07",
    customerPriceAuthority: true,
    publicSafe: false,
  }),
  publicEvidenceAugust2026: Object.freeze({
    id: "dated-market-and-teacher-cost-evidence-2026-08",
    classification: "dated-public-evidence",
    verifiedMonth: "2026-08",
    reviewCadenceMonths: 3,
    nextReviewMonth: "2026-11",
    customerPriceAuthority: false,
    publicSafe: true,
  }),
} as const satisfies Record<string, OfferProvenance>);
