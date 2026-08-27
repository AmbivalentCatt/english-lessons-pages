export const V7_SEQUENCE_CONTRACT_ROLLOUT = Object.freeze({
  // Shadow comparison is test-only and must never execute in production.
  productionShadowEvaluation: false,

  // Runtime consumer groups. Every group retains a source-level legacy branch.
  referenceTimeAuthority: true,
  dataAttributeAuthority: true,
  reactPresentationAuthority: true,
  debugAuthority: true,

  mediaHeadlineIntent: true,
  mediaPhoneIntent: true,
  mediaAtmosphereIntent: true,
  mediaMascotIntent: true,
  mediaPackedAlphaIntent: true,
  mediaApplicationIntent: true,
  mediaFooterIntent: true,

  gsapOpeningHeadline: true,
  gsapBasicSequence: true,
  gsapStandardSequence: true,
  gsapPhoneMaterial: true,
  gsapProEntryAtmosphere: true,
  gsapProProofApplication: true,
  gsapFooterClosing: true,
  gsapMascotSafariLifecycle: true,
} as const);

export const V7_SEQUENCE_CONTRACT_CONSUMER_KEYS = Object.freeze([
  "referenceTimeAuthority",
  "dataAttributeAuthority",
  "reactPresentationAuthority",
  "debugAuthority",
  "mediaHeadlineIntent",
  "mediaPhoneIntent",
  "mediaAtmosphereIntent",
  "mediaMascotIntent",
  "mediaPackedAlphaIntent",
  "mediaApplicationIntent",
  "mediaFooterIntent",
  "gsapOpeningHeadline",
  "gsapBasicSequence",
  "gsapStandardSequence",
  "gsapPhoneMaterial",
  "gsapProEntryAtmosphere",
  "gsapProProofApplication",
  "gsapFooterClosing",
  "gsapMascotSafariLifecycle",
] as const);

export type V7SequenceContractRolloutKey = keyof typeof V7_SEQUENCE_CONTRACT_ROLLOUT;
export type V7SequenceContractConsumerKey = (typeof V7_SEQUENCE_CONTRACT_CONSUMER_KEYS)[number];

export function enabledV7SequenceContractRollouts(): readonly V7SequenceContractRolloutKey[] {
  return (Object.keys(V7_SEQUENCE_CONTRACT_ROLLOUT) as V7SequenceContractRolloutKey[])
    .filter((key) => V7_SEQUENCE_CONTRACT_ROLLOUT[key]);
}

export function disabledV7SequenceContractConsumers(): readonly V7SequenceContractConsumerKey[] {
  return V7_SEQUENCE_CONTRACT_CONSUMER_KEYS.filter((key) => !V7_SEQUENCE_CONTRACT_ROLLOUT[key]);
}

export function areAllV7SequenceContractConsumersEnabled() {
  return disabledV7SequenceContractConsumers().length === 0;
}

export function isV7SequenceContractProductionShadowDisabled() {
  return V7_SEQUENCE_CONTRACT_ROLLOUT.productionShadowEvaluation === false;
}
