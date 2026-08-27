import {
  V7_SCROLL_TIME_SEGMENTS,
  createV7SequenceInput,
  resolveV7SequenceOrThrow,
} from "@/lib/v7-sequence-contract/contract";
import {
  V7_LEGACY_V18_BOUNDARIES,
  resolveLegacyV18SequenceSnapshot,
} from "@/lib/v7-sequence-contract/legacy-shadow-adapter";
import { V7_LEGACY_V18_GSAP_SECTION_CUES } from "@/lib/v7-sequence-contract/legacy-gsap-cue-adapter";
import { V7_GSAP_SECTION_CUE_PLANS } from "@/lib/v7-sequence-contract/gsap-cues";
import type {
  V7DeterministicObservations,
  V7SequenceInput,
  V7ShadowComparable,
  V7ShadowMismatch,
  V7ShadowReport,
} from "@/lib/v7-sequence-contract/types";

export const V7_SHADOW_EPSILON = 0.000001;

const viewportWidths = [
  559.999999, 560, 560.000001,
  720.999999, 721, 721.000001,
  899.999999, 900, 900.000001,
  1099.999999, 1100, 1100.000001,
] as const;

const lifecycleModes = [
  { motion: "normal", document: "visible" },
  { motion: "normal", document: "hidden" },
  { motion: "reduced", document: "visible" },
  { motion: "reduced", document: "hidden" },
] as const;

const browserProfiles = ["standard", "desktop-safari", "ios-webkit"] as const;

const observationCases: readonly V7DeterministicObservations[] = [
  {
    currentPhoneVisualTier: "basic",
    phoneStateOpacities: [1, 0, 0],
    headlineVisible: true,
    phoneVisible: true,
    atmosphereVisible: true,
    mascotVisible: true,
    footerVisible: true,
    application: { kind: "closed" },
    proPhoneTrack: "intro",
  },
  {
    currentPhoneVisualTier: "basic",
    phoneStateOpacities: [0, 0.8, 0],
    headlineVisible: true,
    phoneVisible: true,
    atmosphereVisible: true,
    mascotVisible: true,
    footerVisible: true,
    application: { kind: "open", tier: "pro" },
    proPhoneTrack: "loop",
  },
  {
    currentPhoneVisualTier: "standard",
    phoneStateOpacities: [0, 0, 0.9],
    headlineVisible: false,
    phoneVisible: false,
    atmosphereVisible: false,
    mascotVisible: false,
    footerVisible: false,
    application: { kind: "open", tier: "standard" },
    proPhoneTrack: "intro",
  },
  {
    currentPhoneVisualTier: "pro",
    phoneStateOpacities: [0.5, 0.5, 0.5],
    headlineVisible: true,
    phoneVisible: false,
    atmosphereVisible: true,
    mascotVisible: true,
    footerVisible: false,
    application: { kind: "open", tier: "basic" },
    proPhoneTrack: "loop",
  },
  {
    currentPhoneVisualTier: "pro",
    phoneStateOpacities: [0.8, 0.8, 0],
    headlineVisible: false,
    phoneVisible: true,
    atmosphereVisible: false,
    mascotVisible: true,
    footerVisible: true,
    application: { kind: "closed" },
    proPhoneTrack: "intro",
  },
] as const;

function comparableContract(input: V7SequenceInput): V7ShadowComparable {
  const state = resolveV7SequenceOrThrow(input);
  return {
    time: state.time,
    phases: state.phases,
    tiers: state.tiers,
    material: state.material,
    presentation: state.presentation,
    responsive: state.responsive,
    lifecycle: state.lifecycle,
    media: state.media,
  };
}

function uniqueSorted(values: readonly number[]) {
  return Array.from(new Set(values.map((value) => Number(value.toFixed(9))))).sort((left, right) => left - right);
}

export function createV7ShadowReferenceTimes() {
  return uniqueSorted(V7_LEGACY_V18_BOUNDARIES.flatMap((boundary) => [
    boundary - V7_SHADOW_EPSILON,
    boundary,
    boundary + V7_SHADOW_EPSILON,
  ]));
}

export function createV7ShadowComparisonMatrix(): readonly V7SequenceInput[] {
  const cases: V7SequenceInput[] = [];
  for (const referenceTime of createV7ShadowReferenceTimes()) {
    for (const width of viewportWidths) {
      for (const lifecycle of lifecycleModes) {
        for (const browserProfile of browserProfiles) {
          for (const observations of observationCases) {
            cases.push(createV7SequenceInput(
              { kind: "reference-time", seconds: referenceTime },
              {
                viewport: { width, height: 844, pixelRatio: 3 },
                motion: lifecycle.motion,
                document: lifecycle.document,
                browserProfile,
                observations,
              },
            ));
          }
        }
      }
    }
  }

  for (const segment of V7_SCROLL_TIME_SEGMENTS) {
    const acceptedProgresses = [
      segment.start,
      segment.end,
    ].map((referenceTime) => {
      const weightedBefore = V7_SCROLL_TIME_SEGMENTS.reduce((total, candidate) => {
        if (referenceTime >= candidate.end) {
          return total + (candidate.end - candidate.start) * candidate.weight;
        }
        if (referenceTime > candidate.start) {
          return total + (referenceTime - candidate.start) * candidate.weight;
        }
        return total;
      }, 0);
      const weightedTotal = V7_SCROLL_TIME_SEGMENTS.reduce(
        (total, candidate) => total + (candidate.end - candidate.start) * candidate.weight,
        0,
      );
      return weightedBefore / weightedTotal;
    });
    acceptedProgresses.forEach((progress) => {
      cases.push(createV7SequenceInput({ kind: "scroll-progress", progress }));
    });
  }
  return cases;
}

export function runV7ShadowComparison(cases: readonly V7SequenceInput[]): V7ShadowReport {
  const mismatches: V7ShadowMismatch[] = [];
  for (const input of cases) {
    const legacy = resolveLegacyV18SequenceSnapshot(input);
    const contract = comparableContract(input);
    if (JSON.stringify(legacy) !== JSON.stringify(contract)) {
      mismatches.push({
        phase: contract.phases.primary,
        referenceTime: contract.time.referenceTime,
        input,
        legacy,
        contract,
      });
    }
  }
  return { checked: cases.length, mismatches, passed: mismatches.length === 0 };
}

export type V7GsapCueShadowMismatch = Readonly<{
  section: string;
  cue: string;
  legacy: number | undefined;
  contract: number | undefined;
}>;

export function runV7GsapCueShadowComparison() {
  const mismatches: V7GsapCueShadowMismatch[] = [];
  let checked = 0;
  for (const [section, legacyCues] of Object.entries(V7_LEGACY_V18_GSAP_SECTION_CUES)) {
    const contractCues = V7_GSAP_SECTION_CUE_PLANS[
      section as keyof typeof V7_GSAP_SECTION_CUE_PLANS
    ] as Readonly<Record<string, number>>;
    const cueNames = new Set([...Object.keys(legacyCues), ...Object.keys(contractCues)]);
    for (const cue of cueNames) {
      checked += 1;
      const legacy = (legacyCues as Readonly<Record<string, number>>)[cue];
      const contract = contractCues[cue];
      if (legacy !== contract) mismatches.push({ section, cue, legacy, contract });
    }
  }
  return { checked, mismatches, passed: mismatches.length === 0 } as const;
}
