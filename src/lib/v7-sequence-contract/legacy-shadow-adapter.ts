import type {
  V7CandidateOneMediaIntent,
  V7LifecycleOverlay,
  V7MaterialPresentation,
  V7MicroWindowId,
  V7PhaseInterval,
  V7PhaseName,
  V7ReferenceTime,
  V7ResponsiveState,
  V7ScrollProgress,
  V7SequenceInput,
  V7ShadowComparable,
  V7Tier,
  V7WeightedReferenceTime,
} from "@/lib/v7-sequence-contract/types";

// Temporary, test-only oracle for accepted public version 18. This deliberately
// does not import contract values so shadow comparisons can detect drift. It is
// never imported by the V7 React component or production sequence execution.

const LEGACY_PINNED_END = 33.5;
const LEGACY_FULL_END = 39.49;
const LEGACY_TIERS = ["basic", "standard", "pro"] as const;

const legacySegments = [
  [0, 4.5, 2.3], [4.5, 11.9, 1.45], [11.9, 14.25, 1.8], [14.25, 14.91, 5],
  [14.91, 15.6, 4.8], [15.6, 19.6, 1.05], [19.6, 23, 5.2], [23, 24.87, 1],
  [24.87, 25.55, 3], [25.55, 26.31, 2.2], [26.31, 27.75, 5.4], [27.75, 28.47, 1],
  [28.47, 29.15, 4.8], [29.15, 29.45, 1], [29.45, 29.91, 2], [29.91, 30.5, 3.2],
  [30.5, 31.38, 2.5], [31.38, 32.25, 6.5], [32.25, 33.22, 1], [33.22, 33.5, 7.9],
] as const;

const LEGACY_WEIGHTED_DURATION = legacySegments.reduce(
  (total, [start, end, weight]) => total + (end - start) * weight,
  0,
);

const legacyPhases = [
  ["openingGeometry", 0, 0.55], ["openingHeadline", 0.55, 2.5], ["mascotRise", 2.5, 4.25],
  ["mascotSettle", 4.25, 5], ["headlineMedallions", 5, 9.25], ["headlineArchitecture", 9.25, 10.2],
  ["headlineFlood", 10.2, 11.9], ["phoneEmergence", 11.9, 12.35], ["phoneHold", 12.35, 15.6],
  ["phoneMaterialTakeover", 15.6, 16.85], ["outlineTrace", 16.85, 17.1], ["blockHeadline", 17.1, 18.725],
  ["readableHeadline", 18.725, 19.6], ["phoneReturn", 19.6, 19.85], ["sideCardsRise", 19.85, 20.6],
  ["firstCluster", 20.6, 23], ["violetRise", 23, 24.25], ["turnEnglishOn", 24.25, 25.75],
  ["secondCardSystem", 25.75, 27.75], ["coralRise", 27.75, 28.47],
  ["learnWithConfidence", 28.47, 29.45], ["lessonObject", 29.45, 30.5],
  ["proofWall", 30.5, 32.25], ["darkCampaign", 32.25, 33.5],
] as const satisfies readonly (readonly [V7PhaseName, number, number])[];

export const V7_LEGACY_V18_BOUNDARIES = Object.freeze([
  0, 0.55, 1.2, 1.63, 2.06, 2.5, 3.05, 3.47, 3.89, 4.25, 5, 9.25, 10.2,
  11.9, 12.35, 14.12, 14.37, 15.03, 15.25, 15.6, 16.85, 17.05, 17.1, 18.1,
  18.725, 19.5, 19.6, 19.85, 20.1, 20.6, 23, 24.25, 25.05, 25.54, 25.55,
  25.75, 27.75, 28.05, 28.25, 28.47, 29.32, 29.45, 29.91, 30.5, 31.38,
  32.25, 32.49, 33.22, 33.5, 39.49,
] as const);

const clamp = (minimum: number, maximum: number, value: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

function legacyReferenceAtProgress(progress: number) {
  let weighted = clamp(0, 1, progress) * LEGACY_WEIGHTED_DURATION;
  for (const [start, end, weight] of legacySegments) {
    const duration = (end - start) * weight;
    if (weighted <= duration) return start + weighted / weight;
    weighted -= duration;
  }
  return LEGACY_PINNED_END;
}

function legacyProgressAtReference(referenceTime: number) {
  const time = clamp(0, LEGACY_PINNED_END, referenceTime);
  let weighted = 0;
  for (const [start, end, weight] of legacySegments) {
    if (time >= end) {
      weighted += (end - start) * weight;
      continue;
    }
    if (time > start) weighted += (time - start) * weight;
    break;
  }
  return weighted / LEGACY_WEIGHTED_DURATION;
}

function legacyPhase(referenceTime: number): V7PhaseInterval {
  let current: (typeof legacyPhases)[number] = legacyPhases[0];
  for (const phase of legacyPhases) {
    if (referenceTime >= phase[1]) current = phase;
  }
  return {
    id: current[0],
    start: current[1],
    end: current[2],
    startBoundary: "closed",
    endBoundary: current[0] === "darkCampaign" ? "closed" : "open",
  };
}

function legacyWindows(time: number): readonly V7MicroWindowId[] {
  const windows: V7MicroWindowId[] = [];
  if (time > 1.2 && time < 2.06) windows.push("opening-basic-to-standard");
  if (time > 3.05 && time < 3.89) windows.push("opening-standard-to-pro");
  if (time >= 14.12 && time < 15.25) windows.push("standard-phone-preroll-one");
  if (time >= 25.05 && time < 28.25) windows.push("standard-phone-preroll-two");
  if (time >= 25.55 && time < 32.25) windows.push("pro-atmosphere-warm");
  if (time >= 27.75 && time < 32.25) windows.push("pro-atmosphere-visible");
  if (time >= 29.32 && time < 29.91) windows.push("mascot-lesson-handoff");
  if (time >= 29.32 && time < 29.45) windows.push("mascot-lesson-handoff-before-seam");
  if (time >= 29.45 && time < 29.91) windows.push("mascot-lesson-handoff-after-seam");
  if (time >= 30.5 && time < 32.49) windows.push("pro-proof-wall-visible");
  if (time >= 32.25 && time < 32.49) windows.push("proof-wall-dark-campaign-overlap");
  return windows;
}

function legacyClipPair(progress: number) {
  const bounded = clamp(0, 1, progress);
  const front = -6 + bounded * 112;
  const p1 = front - 1.8;
  const p2 = front + 1.4;
  const p3 = front - 0.8;
  const p4 = front + 1.9;
  const p5 = front - 1.2;
  const percent = (value: number) => `${Number(value.toFixed(4))}%`;
  return {
    outgoingClip: `polygon(${percent(p1)} 0%, 100% 0%, 100% 100%, ${percent(p5)} 100%, ${percent(p4)} 76%, ${percent(p3)} 52%, ${percent(p2)} 27%)`,
    incomingClip: `polygon(0% 0%, ${percent(p1)} 0%, ${percent(p2)} 27%, ${percent(p3)} 52%, ${percent(p4)} 76%, ${percent(p5)} 100%, 0% 100%)`,
    edgeOpacity: bounded > 0.02 && bounded < 0.98 ? 0.72 : 0,
    edgeXPercent: front * 11.1 - 50,
  };
}

function legacyMaterial(time: number): V7MaterialPresentation {
  if (time > 1.2 && time < 2.06) {
    const progress = (time - 1.2) / (2.06 - 1.2);
    return {
      kind: "handoff", outgoing: "basic", incoming: "standard", progress,
      playingTiers: ["basic", "standard"], phaseAttribute: "basic-to-standard", clip: legacyClipPair(progress),
    };
  }
  if (time > 3.05 && time < 3.89) {
    const progress = (time - 3.05) / (3.89 - 3.05);
    return {
      kind: "handoff", outgoing: "standard", incoming: "pro", progress,
      playingTiers: ["standard", "pro"], phaseAttribute: "standard-to-pro", clip: legacyClipPair(progress),
    };
  }
  const tier: V7Tier = time <= 1.2 ? "basic" : time <= 3.05 ? "standard" : "pro";
  return { kind: "hold", tier, playingTiers: [tier], phaseAttribute: `hold-${tier}` };
}

function legacyReactTier(time: number): V7Tier {
  if (time < 14.37) return "basic";
  if (time < 15.03) return "standard";
  if (time < 19.5) return "pro";
  if (time < 25.54) return "basic";
  if (time < 28.05) return "standard";
  return "pro";
}

function legacyPhoneTier(opacities: readonly [number, number, number], current: V7Tier): V7Tier {
  let tier = current;
  let strongest = 0.5;
  opacities.forEach((opacity, index) => {
    if (opacity > strongest) {
      strongest = opacity;
      tier = LEGACY_TIERS[index];
    }
  });
  return tier;
}

function legacyPhoneIdentity(time: number) {
  if (time < 15.6) return "visible-black" as const;
  if (time < 17.05) return "dissolving" as const;
  if (time < 18.1) return "trace-only" as const;
  if (time < 19.6) return "offscreen-prepared" as const;
  if (time < 20.1) return "returning" as const;
  return "restored" as const;
}

function legacyResponsive(input: V7SequenceInput): V7ResponsiveState {
  return {
    ...input.viewport,
    narrowCardLayout: input.viewport.width < 560,
    headlineVideoAllowed: input.viewport.width >= 721,
    compactSequenceLayout: input.viewport.width < 900,
    compactOpeningLayout: input.viewport.width < 1100,
  };
}

function legacyLifecycle(input: V7SequenceInput): V7LifecycleOverlay {
  if (input.motion === "reduced") {
    return { kind: "reduced-motion-static", timelineMayAdvance: false, mediaMayPlay: false };
  }
  if (input.document === "hidden") {
    return { kind: "document-hidden", timelineMayAdvance: true, mediaMayPlay: false };
  }
  return { kind: "active-normal", timelineMayAdvance: true, mediaMayPlay: true };
}

function legacyMedia(
  input: V7SequenceInput,
  lifecycle: V7LifecycleOverlay,
  responsive: V7ResponsiveState,
  material: V7MaterialPresentation,
  phoneTier: V7Tier,
  standardPreroll: boolean,
  atmosphereWarm: boolean,
  atmosphereActive: boolean,
): V7CandidateOneMediaIntent {
  const mayPlay = lifecycle.mediaMayPlay;
  const mascot = mayPlay && input.observations.mascotVisible ? "play" as const : "cold" as const;
  const safari = input.browserProfile !== "standard";
  const atmosphere = !mayPlay || !atmosphereWarm
    ? "cold" as const
    : atmosphereActive && input.observations.atmosphereVisible
      ? "play" as const
      : "warm" as const;
  return {
    headline: {
      role: "headline",
      demand: mayPlay && responsive.headlineVideoAllowed && input.observations.headlineVisible ? "play" : "cold",
      playingTiers: material.playingTiers,
    },
    phone: {
      role: "phone",
      demand: mayPlay && (input.observations.phoneVisible || standardPreroll) ? "play" : "cold",
      visualTier: phoneTier,
      standardPreroll,
      proTrack: input.observations.proPhoneTrack,
    },
    atmosphere: { role: "pro-atmosphere", demand: atmosphere },
    mascot: { role: "mascot", demand: mascot, gazeScheduling: "candidate-one-runtime-owned" },
    packedAlpha: {
      role: "packed-alpha",
      demand: safari ? mascot : "cold",
      renderer: safari ? "packed-alpha-webgl" : "native-alpha",
    },
    applicationPro: {
      role: "application-pro",
      demand: mayPlay && input.observations.application.kind === "open"
        && input.observations.application.tier === "pro" ? "play" : "cold",
    },
    footerMaterial: {
      role: "footer-material",
      demand: mayPlay && input.observations.footerVisible ? "play" : "cold",
    },
  };
}

export function resolveLegacyV18SequenceSnapshot(input: V7SequenceInput): V7ShadowComparable {
  const rawTime = input.timeline.kind === "reference-time"
    ? input.timeline.seconds
    : legacyReferenceAtProgress(input.timeline.progress);
  const time = clamp(0, LEGACY_PINNED_END, rawTime);
  const progress = legacyProgressAtReference(time);
  const interval = legacyPhase(time);
  const windows = legacyWindows(time);
  const material = legacyMaterial(time);
  const phoneTier = legacyPhoneTier(
    input.observations.phoneStateOpacities,
    input.observations.currentPhoneVisualTier,
  );
  const responsive = legacyResponsive(input);
  const lifecycle = legacyLifecycle(input);
  const standardPreroll = windows.includes("standard-phone-preroll-one")
    || windows.includes("standard-phone-preroll-two");
  const atmosphereWarm = windows.includes("pro-atmosphere-warm");
  const atmosphereActive = windows.includes("pro-atmosphere-visible");
  const activePhases: readonly V7PhaseName[] = time >= 32.25 && time < 32.49
    ? ["proofWall", "darkCampaign"]
    : [interval.id];
  return {
    time: {
      requested: input.timeline,
      referenceTime: time as V7ReferenceTime,
      weightedReferenceTime: (progress * LEGACY_WEIGHTED_DURATION) as V7WeightedReferenceTime,
      scrollProgress: progress as V7ScrollProgress,
      firstSequenceEnd: 21.6,
      pinnedSequenceEnd: LEGACY_PINNED_END,
      fullReferenceMetadataEnd: LEGACY_FULL_END,
    },
    phases: { primary: interval.id, active: activePhases, interval, windows },
    tiers: {
      reactTariffTier: legacyReactTier(time),
      phoneVisualTier: phoneTier,
      openingHeadline: time < 1.63
        ? { activeTier: "basic", activeWord: "pace." }
        : time < 3.47
          ? { activeTier: "standard", activeWord: "format." }
          : { activeTier: "pro", activeWord: "plan." },
    },
    material,
    presentation: {
      proofWallActive: time >= 30.5 && time < 32.49,
      standardPhonePreroll: standardPreroll,
      atmosphere: {
        warm: atmosphereWarm,
        active: atmosphereActive,
        demand: atmosphereActive ? "play" : atmosphereWarm ? "warm" : "cold",
      },
      phoneIdentity: legacyPhoneIdentity(time),
      thresholds: {
        controlOpacity: 0.12, controlScale: 0.68, phoneTierOpacity: 0.5,
        headlineVideoMinWidth: 721, sequenceCompactWidth: 900,
        openingCompactWidth: 1100, narrowCardWidth: 560,
      },
    },
    responsive,
    lifecycle,
    media: legacyMedia(
      input,
      lifecycle,
      responsive,
      material,
      phoneTier,
      standardPreroll,
      atmosphereWarm,
      atmosphereActive,
    ),
  };
}
