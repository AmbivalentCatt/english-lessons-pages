export const OFFER_DOMAIN_CONSUMERS = [
  "legacy-tariffs",
  "candidate03-selection",
  "v7-presentation",
  "metadata",
  "admin",
  "sales-facts",
] as const;

export type OfferDomainConsumer = (typeof OFFER_DOMAIN_CONSUMERS)[number];

export const OFFER_DOMAIN_RELEASE_MODE = "public-only" as const;

export const OFFER_DOMAIN_ROLLOUT = Object.freeze({
  productionAuthority: true,
  productionShadow: false,
  consumers: Object.freeze({
    "legacy-tariffs": true,
    "candidate03-selection": true,
    "v7-presentation": true,
    metadata: false,
    admin: false,
    "sales-facts": true,
  }),
  publicAvailabilityReads: true,
  privateAdminSurface: false,
  applicationSnapshotWrites: true,
  paidPurchaseWrites: false,
  availabilityWrites: false,
  refundWrites: false,
  privateOperations: Object.freeze({
    availabilityEnrollment: false,
    availabilityRelease: false,
    availabilityCorrection: false,
    availabilityVerification: false,
    paidPurchaseSnapshots: false,
    refundCalculation: false,
    refundStatus: false,
    availabilityAuditHistory: false,
    ownerSessionProbe: false,
  }),
  legacyFallbacksCompiled: true,
} as const);

export type OfferDomainRolloutEnvironment = Readonly<{
  localQaRequested: boolean;
  localQaConsumers: readonly OfferDomainConsumer[];
  siteUrl: string;
}>;

export function isLocalOfferDomainQaEnvironment(environment: OfferDomainRolloutEnvironment): boolean {
  if (!environment.localQaRequested) return false;
  try {
    const hostname = new URL(environment.siteUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export function resolveOfferDomainConsumer(
  consumer: OfferDomainConsumer,
  environment: OfferDomainRolloutEnvironment = {
    localQaRequested: false,
    localQaConsumers: [],
    siteUrl: "",
  },
): boolean {
  const productionEnabled = OFFER_DOMAIN_ROLLOUT.productionAuthority
    && OFFER_DOMAIN_ROLLOUT.consumers[consumer];
  const localEnabled = consumer !== "admin"
    && isLocalOfferDomainQaEnvironment(environment)
    && environment.localQaConsumers.includes(consumer);
  return productionEnabled || localEnabled;
}
