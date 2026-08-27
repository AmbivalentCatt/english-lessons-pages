import {
  createV7SequenceInput,
  resolveV7SequenceOrThrow,
} from "@/lib/v7-sequence-contract/contract";
import { V7_SEQUENCE_CONTRACT_ROLLOUT } from "@/lib/v7-sequence-contract/rollout";
import type {
  V7BrowserProfile,
  V7CandidateOneMediaIntent,
  V7MediaDemand,
  V7Tier,
} from "@/lib/v7-sequence-contract/types";

export type V7MediaIntentFacts = Readonly<{
  referenceTime: number;
  viewport: Readonly<{ width: number; height: number; pixelRatio: number }>;
  browserProfile: V7BrowserProfile;
  reducedMotion: boolean;
  documentVisible: boolean;
  currentPhoneVisualTier?: V7Tier;
  phoneStateOpacities?: readonly [number, number, number];
  headlineVisible?: boolean;
  phoneVisible?: boolean;
  atmosphereVisible?: boolean;
  mascotVisible?: boolean;
  footerVisible?: boolean;
  applicationTier?: V7Tier | null;
  proPhoneTrack?: "intro" | "loop";
}>;

export function resolveV7MediaIntentSnapshot(
  facts: V7MediaIntentFacts,
): V7CandidateOneMediaIntent {
  return resolveV7SequenceOrThrow(createV7SequenceInput(
    { kind: "reference-time", seconds: facts.referenceTime },
    {
      viewport: facts.viewport,
      motion: facts.reducedMotion ? "reduced" : "normal",
      document: facts.documentVisible ? "visible" : "hidden",
      browserProfile: facts.browserProfile,
      observations: {
        currentPhoneVisualTier: facts.currentPhoneVisualTier ?? "basic",
        phoneStateOpacities: facts.phoneStateOpacities ?? [1, 0, 0],
        headlineVisible: facts.headlineVisible ?? false,
        phoneVisible: facts.phoneVisible ?? false,
        atmosphereVisible: facts.atmosphereVisible ?? false,
        mascotVisible: facts.mascotVisible ?? false,
        footerVisible: facts.footerVisible ?? false,
        application: facts.applicationTier
          ? { kind: "open", tier: facts.applicationTier }
          : { kind: "closed" },
        proPhoneTrack: facts.proPhoneTrack ?? "intro",
      },
    },
  )).media;
}

type V7MediaIntentRole = keyof V7CandidateOneMediaIntent;

const rolloutForRole: Readonly<Record<V7MediaIntentRole, boolean>> = {
  headline: V7_SEQUENCE_CONTRACT_ROLLOUT.mediaHeadlineIntent,
  phone: V7_SEQUENCE_CONTRACT_ROLLOUT.mediaPhoneIntent,
  atmosphere: V7_SEQUENCE_CONTRACT_ROLLOUT.mediaAtmosphereIntent,
  mascot: V7_SEQUENCE_CONTRACT_ROLLOUT.mediaMascotIntent,
  packedAlpha: V7_SEQUENCE_CONTRACT_ROLLOUT.mediaPackedAlphaIntent,
  applicationPro: V7_SEQUENCE_CONTRACT_ROLLOUT.mediaApplicationIntent,
  footerMaterial: V7_SEQUENCE_CONTRACT_ROLLOUT.mediaFooterIntent,
};

export function selectV7MediaDemand<Role extends V7MediaIntentRole>(
  role: Role,
  facts: V7MediaIntentFacts,
  legacyDemand: V7MediaDemand,
): V7MediaDemand {
  return selectV7MediaDemandForAuthority(
    role,
    facts,
    legacyDemand,
    rolloutForRole[role],
  );
}

export function selectV7MediaDemandForAuthority<Role extends V7MediaIntentRole>(
  role: Role,
  facts: V7MediaIntentFacts,
  legacyDemand: V7MediaDemand,
  contractEnabled: boolean,
): V7MediaDemand {
  return contractEnabled
    ? resolveV7MediaIntentSnapshot(facts)[role].demand
    : legacyDemand;
}

export function selectV7PhoneVisualTier(
  facts: V7MediaIntentFacts,
  legacyTier: V7Tier,
): V7Tier {
  return V7_SEQUENCE_CONTRACT_ROLLOUT.mediaPhoneIntent
    ? resolveV7MediaIntentSnapshot(facts).phone.visualTier
    : legacyTier;
}

export function selectV7HeadlinePlayingTiers(
  facts: V7MediaIntentFacts,
  legacyTiers: readonly V7Tier[],
): readonly V7Tier[] {
  return V7_SEQUENCE_CONTRACT_ROLLOUT.mediaHeadlineIntent
    ? resolveV7MediaIntentSnapshot(facts).headline.playingTiers
    : legacyTiers;
}
