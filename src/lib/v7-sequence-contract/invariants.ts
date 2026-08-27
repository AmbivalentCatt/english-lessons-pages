import {
  V7_GSAP_CUE_PLAN,
  V7_MICRO_WINDOWS,
  V7_PHASE_INTERVALS,
  V7_REFERENCE_FULL_METADATA_END,
  V7_REFERENCE_FIRST_SEQUENCE_END,
  V7_REFERENCE_PINNED_END,
  V7_SCROLL_TIME_SEGMENTS,
  V7_WEIGHTED_SCROLL_DURATION,
  activePhasesAtReferenceTime,
  createV7SequenceInput,
  materialPresentationAtReferenceTime,
  referenceTimeAtScrollProgress,
  resolveV7SequenceOrThrow,
  scrollProgressAtReferenceTime,
} from "@/lib/v7-sequence-contract/contract";
import { V7_GSAP_SECTION_CUE_PLANS } from "@/lib/v7-sequence-contract/gsap-cues";
import {
  areAllV7SequenceContractConsumersEnabled,
  isV7SequenceContractProductionShadowDisabled,
} from "@/lib/v7-sequence-contract/rollout";
import { V7_PHASE_NAMES, type V7InvariantResult, type V7SequenceInvariant } from "@/lib/v7-sequence-contract/types";

function result(id: string, passed: boolean, message: string): V7InvariantResult {
  return { id, passed, message };
}

export const V7_SEQUENCE_INVARIANTS: readonly V7SequenceInvariant[] = [
  {
    id: "24-accepted-phases",
    evaluate: () => {
      const namesMatch = V7_PHASE_INTERVALS.every(({ id }, index) => id === V7_PHASE_NAMES[index]);
      return result(
        "24-accepted-phases",
        V7_PHASE_INTERVALS.length === 24 && namesMatch,
        "The contract must expose the accepted 24 phases in source order.",
      );
    },
  },
  {
    id: "phase-coverage-is-contiguous",
    evaluate: () => {
      const contiguous = V7_PHASE_INTERVALS.every((interval, index) => (
        index === 0
          ? interval.start === 0
          : interval.start === V7_PHASE_INTERVALS[index - 1].end
      ));
      const final = V7_PHASE_INTERVALS.at(-1);
      return result(
        "phase-coverage-is-contiguous",
        contiguous && final?.end === V7_REFERENCE_PINNED_END && final.endBoundary === "closed",
        "Phase coverage must be gap-free from 0 through the inclusive pinned ending.",
      );
    },
  },
  {
    id: "pinned-and-full-reference-ends-remain-distinct",
    evaluate: () => result(
      "pinned-and-full-reference-ends-remain-distinct",
      V7_REFERENCE_PINNED_END === 33.5
        && V7_REFERENCE_FIRST_SEQUENCE_END === 21.6
        && V7_REFERENCE_FULL_METADATA_END === 39.49
        && V7_REFERENCE_PINNED_END < V7_REFERENCE_FULL_METADATA_END,
      "The executable sequence ends at 33.5 while 39.49 remains metadata only.",
    ),
  },
  {
    id: "proof-wall-dark-campaign-overlap",
    evaluate: () => result(
      "proof-wall-dark-campaign-overlap",
      JSON.stringify(activePhasesAtReferenceTime(32.25)) === JSON.stringify(["proofWall", "darkCampaign"])
        && JSON.stringify(activePhasesAtReferenceTime(32.49)) === JSON.stringify(["darkCampaign"]),
      "Proof wall remains active through 32.49 while dark campaign begins at 32.25.",
    ),
  },
  {
    id: "weighted-reference-map-round-trips",
    evaluate: () => {
      const boundaries = [0, ...V7_SCROLL_TIME_SEGMENTS.map(({ end }) => end)];
      const roundTrips = boundaries.every((time) => {
        const progress = scrollProgressAtReferenceTime(time);
        return Math.abs(referenceTimeAtScrollProgress(progress) - time) < 1e-10;
      });
      return result(
        "weighted-reference-map-round-trips",
        roundTrips && Math.abs(V7_WEIGHTED_SCROLL_DURATION - 85.289) < 1e-10,
        "Weighted reference mapping must preserve every accepted scroll-segment boundary.",
      );
    },
  },
  {
    id: "material-handoff-boundaries-are-strict",
    evaluate: () => result(
      "material-handoff-boundaries-are-strict",
      materialPresentationAtReferenceTime(1.2).kind === "hold"
        && materialPresentationAtReferenceTime(1.2 + 1e-7).kind === "handoff"
        && materialPresentationAtReferenceTime(2.06).kind === "hold"
        && materialPresentationAtReferenceTime(3.05).kind === "hold"
        && materialPresentationAtReferenceTime(3.05 + 1e-7).kind === "handoff"
        && materialPresentationAtReferenceTime(3.89).kind === "hold",
      "Opening material handoffs must remain open at both endpoints.",
    ),
  },
  {
    id: "tier-axes-remain-independent",
    evaluate: () => {
      const state = resolveV7SequenceOrThrow(createV7SequenceInput(
        { kind: "reference-time", seconds: 15.1 },
        { observations: { currentPhoneVisualTier: "basic", phoneStateOpacities: [0, 0.8, 0] } },
      ));
      return result(
        "tier-axes-remain-independent",
        state.tiers.reactTariffTier === "pro" && state.tiers.phoneVisualTier === "standard",
        "React tariff state and computed-opacity phone state must be separately resolved.",
      );
    },
  },
  {
    id: "responsive-thresholds-are-exact",
    evaluate: () => {
      const at721 = resolveV7SequenceOrThrow(createV7SequenceInput(
        { kind: "reference-time", seconds: 0 },
        { viewport: { width: 721, height: 900, pixelRatio: 1 } },
      )).responsive;
      const at900 = resolveV7SequenceOrThrow(createV7SequenceInput(
        { kind: "reference-time", seconds: 0 },
        { viewport: { width: 900, height: 900, pixelRatio: 1 } },
      )).responsive;
      const at1100 = resolveV7SequenceOrThrow(createV7SequenceInput(
        { kind: "reference-time", seconds: 0 },
        { viewport: { width: 1100, height: 900, pixelRatio: 1 } },
      )).responsive;
      return result(
        "responsive-thresholds-are-exact",
        at721.headlineVideoAllowed
          && !at900.compactSequenceLayout
          && !at1100.compactOpeningLayout,
        "Width 721 allows headline video; widths 900 and 1100 exit their compact modes.",
      );
    },
  },
  {
    id: "lifecycle-overlays-do-not-change-phase",
    evaluate: () => {
      const normal = resolveV7SequenceOrThrow(createV7SequenceInput({ kind: "reference-time", seconds: 27.8 }));
      const hidden = resolveV7SequenceOrThrow(createV7SequenceInput(
        { kind: "reference-time", seconds: 27.8 },
        { document: "hidden" },
      ));
      const reduced = resolveV7SequenceOrThrow(createV7SequenceInput(
        { kind: "reference-time", seconds: 27.8 },
        { motion: "reduced" },
      ));
      return result(
        "lifecycle-overlays-do-not-change-phase",
        normal.phases.primary === hidden.phases.primary
          && hidden.phases.primary === reduced.phases.primary
          && hidden.lifecycle.kind === "document-hidden"
          && reduced.lifecycle.kind === "reduced-motion-static",
        "Lifecycle and motion are overlays; they do not rewrite reference-time phase identity.",
      );
    },
  },
  {
    id: "media-intent-is-declarative-and-lifecycle-gated",
    evaluate: () => {
      const hidden = resolveV7SequenceOrThrow(createV7SequenceInput(
        { kind: "reference-time", seconds: 28 },
        { document: "hidden", browserProfile: "ios-webkit", observations: { application: { kind: "open", tier: "pro" } } },
      ));
      const demands = Object.values(hidden.media).map(({ demand }) => demand);
      return result(
        "media-intent-is-declarative-and-lifecycle-gated",
        demands.every((demand) => demand === "cold"),
        "A hidden document may describe media intent but may not request playback.",
      );
    },
  },
  {
    id: "gsap-sections-own-executable-cues",
    evaluate: () => result(
      "gsap-sections-own-executable-cues",
      V7_GSAP_CUE_PLAN.authority === "contract-cues-legacy-adapters"
        && V7_GSAP_CUE_PLAN.referenceEnd === V7_REFERENCE_PINNED_END
        && V7_GSAP_CUE_PLAN.cues.filter(({ kind }) => kind === "phase-label").length === 24
        && Object.keys(V7_GSAP_SECTION_CUE_PLANS).length === 8
        && Object.values(V7_GSAP_SECTION_CUE_PLANS)
          .every((section) => Object.values(section).every(Number.isFinite)),
      "The contract must expose the 24 phase labels and eight finite executable cue sections.",
    ),
  },
  {
    id: "micro-windows-are-valid-and-unique",
    evaluate: () => {
      const ids = new Set(V7_MICRO_WINDOWS.map(({ id }) => id));
      return result(
        "micro-windows-are-valid-and-unique",
        ids.size === V7_MICRO_WINDOWS.length
          && V7_MICRO_WINDOWS.every(({ start, end }) => start < end),
        "Each overlapping or handoff window must have a unique ID and positive duration.",
      );
    },
  },
  {
    id: "local-consumers-enabled-production-shadow-disabled",
    evaluate: () => result(
      "local-consumers-enabled-production-shadow-disabled",
      areAllV7SequenceContractConsumersEnabled()
        && isV7SequenceContractProductionShadowDisabled(),
      "All local consumers must use the contract while production shadow evaluation stays disabled.",
    ),
  },
];

export function evaluateV7SequenceInvariants(): readonly V7InvariantResult[] {
  return V7_SEQUENCE_INVARIANTS.map(({ evaluate }) => evaluate());
}

export function assertV7SequenceInvariants() {
  const failed = evaluateV7SequenceInvariants().filter(({ passed }) => !passed);
  if (failed.length > 0) {
    throw new Error(failed.map(({ id, message }) => `${id}: ${message}`).join("\n"));
  }
}
