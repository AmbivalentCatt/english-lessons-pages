import {
  V7_PHASE_NAMES,
  V7_TIER_IDS,
  type V7AnimatedControlAvailability,
  type V7AnimatedControlObservation,
  type V7CandidateOneMediaIntent,
  type V7ContractError,
  type V7GsapCuePlan,
  type V7LifecycleOverlay,
  type V7MaterialClipState,
  type V7MaterialPresentation,
  type V7MicroWindow,
  type V7MicroWindowId,
  type V7PhaseInterval,
  type V7PhaseName,
  type V7PhoneIdentity,
  type V7ReferenceTime,
  type V7ResolveResult,
  type V7ResponsiveState,
  type V7ScrollProgress,
  type V7SequenceInput,
  type V7SequenceState,
  type V7Tier,
  type V7TransitionChange,
  type V7TransitionDiff,
  type V7WeightedReferenceTime,
} from "@/lib/v7-sequence-contract/types";

export const V7_REFERENCE_PINNED_END = 33.5 as const;
export const V7_REFERENCE_FULL_METADATA_END = 39.49 as const;
export const V7_PHONE_SEQUENCE_DELAY = 0.85 as const;
export const V7_REFERENCE_FIRST_SEQUENCE_END = 21.6 as const;

export const V7_PRESENTATION_THRESHOLDS = Object.freeze({
  controlOpacity: 0.12,
  controlScale: 0.68,
  phoneTierOpacity: 0.5,
  headlineVideoMinWidth: 721,
  sequenceCompactWidth: 900,
  openingCompactWidth: 1100,
  narrowCardWidth: 560,
} as const);

export const V7_PHASE_INTERVALS = Object.freeze([
  phase("openingGeometry", 0, 0.55),
  phase("openingHeadline", 0.55, 2.5),
  phase("mascotRise", 2.5, 4.25),
  phase("mascotSettle", 4.25, 5),
  phase("headlineMedallions", 5, 9.25),
  phase("headlineArchitecture", 9.25, 10.2),
  phase("headlineFlood", 10.2, 11.9),
  phase("phoneEmergence", 11.9, 12.35),
  phase("phoneHold", 12.35, 15.6),
  phase("phoneMaterialTakeover", 15.6, 16.85),
  phase("outlineTrace", 16.85, 17.1),
  phase("blockHeadline", 17.1, 18.725),
  phase("readableHeadline", 18.725, 19.6),
  phase("phoneReturn", 19.6, 19.85),
  phase("sideCardsRise", 19.85, 20.6),
  phase("firstCluster", 20.6, 23),
  phase("violetRise", 23, 24.25),
  phase("turnEnglishOn", 24.25, 25.75),
  phase("secondCardSystem", 25.75, 27.75),
  phase("coralRise", 27.75, 28.47),
  phase("learnWithConfidence", 28.47, 29.45),
  phase("lessonObject", 29.45, 30.5),
  phase("proofWall", 30.5, 32.25),
  phase("darkCampaign", 32.25, V7_REFERENCE_PINNED_END, "closed"),
] satisfies readonly V7PhaseInterval[]);

export const V7_MICRO_WINDOWS = Object.freeze([
  windowInterval("opening-basic-to-standard", 1.2, 2.06, "open", "open"),
  windowInterval("opening-standard-to-pro", 3.05, 3.89, "open", "open"),
  windowInterval("standard-phone-preroll-one", 14.12, 15.25),
  windowInterval("standard-phone-preroll-two", 25.05, 28.25),
  windowInterval("pro-atmosphere-warm", 25.55, 32.25),
  windowInterval("pro-atmosphere-visible", 27.75, 32.25),
  windowInterval("mascot-lesson-handoff", 29.32, 29.91),
  windowInterval("mascot-lesson-handoff-before-seam", 29.32, 29.45),
  windowInterval("mascot-lesson-handoff-after-seam", 29.45, 29.91),
  windowInterval("pro-proof-wall-visible", 30.5, 32.49, "closed", "open", ["proofWall", "darkCampaign"]),
  windowInterval("proof-wall-dark-campaign-overlap", 32.25, 32.49, "closed", "open", ["proofWall", "darkCampaign"]),
] satisfies readonly V7MicroWindow[]);

export const V7_SCROLL_TIME_SEGMENTS = Object.freeze([
  { start: 0, end: 4.5, weight: 2.3 },
  { start: 4.5, end: 11.9, weight: 1.45 },
  { start: 11.9, end: 14.25, weight: 1.8 },
  { start: 14.25, end: 14.91, weight: 5 },
  { start: 14.91, end: 15.6, weight: 4.8 },
  { start: 15.6, end: 19.6, weight: 1.05 },
  { start: 19.6, end: 23, weight: 5.2 },
  { start: 23, end: 24.87, weight: 1 },
  { start: 24.87, end: 25.55, weight: 3 },
  { start: 25.55, end: 26.31, weight: 2.2 },
  { start: 26.31, end: 27.75, weight: 5.4 },
  { start: 27.75, end: 28.47, weight: 1 },
  { start: 28.47, end: 29.15, weight: 4.8 },
  { start: 29.15, end: 29.45, weight: 1 },
  { start: 29.45, end: 29.91, weight: 2 },
  { start: 29.91, end: 30.5, weight: 3.2 },
  { start: 30.5, end: 31.38, weight: 2.5 },
  { start: 31.38, end: 32.25, weight: 6.5 },
  { start: 32.25, end: 33.22, weight: 1 },
  { start: 33.22, end: V7_REFERENCE_PINNED_END, weight: 7.9 },
] as const);

export const V7_WEIGHTED_SCROLL_DURATION = V7_SCROLL_TIME_SEGMENTS.reduce(
  (total, segment) => total + (segment.end - segment.start) * segment.weight,
  0,
);

export const V7_GSAP_CUE_PLAN: V7GsapCuePlan = Object.freeze({
  authority: "contract-cues-legacy-adapters",
  referenceEnd: V7_REFERENCE_PINNED_END,
  cues: Object.freeze([
    ...V7_PHASE_INTERVALS.map(({ id, start }) => ({ kind: "phase-label" as const, phase: id, at: start })),
    ...V7_MICRO_WINDOWS.map(({ id, start }) => ({ kind: "window-entry" as const, window: id, at: start })),
  ]),
});

function phase(
  id: V7PhaseName,
  start: number,
  end: number,
  endBoundary: "open" | "closed" = "open",
): V7PhaseInterval {
  return { id, start, end, startBoundary: "closed", endBoundary };
}

function windowInterval(
  id: V7MicroWindowId,
  start: number,
  end: number,
  startBoundary: "open" | "closed" = "closed",
  endBoundary: "open" | "closed" = "open",
  overlaps?: readonly V7PhaseName[],
): V7MicroWindow {
  return { id, start, end, startBoundary, endBoundary, overlaps };
}

function clamp(minimum: number, maximum: number, value: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function within(
  value: number,
  interval: Pick<V7MicroWindow, "start" | "end" | "startBoundary" | "endBoundary">,
) {
  const afterStart = interval.startBoundary === "closed" ? value >= interval.start : value > interval.start;
  const beforeEnd = interval.endBoundary === "closed" ? value <= interval.end : value < interval.end;
  return afterStart && beforeEnd;
}

export function referenceTimeAtScrollProgress(progress: number): V7ReferenceTime {
  let weightedTime = clamp(0, 1, progress) * V7_WEIGHTED_SCROLL_DURATION;
  for (const segment of V7_SCROLL_TIME_SEGMENTS) {
    const segmentDuration = (segment.end - segment.start) * segment.weight;
    if (weightedTime <= segmentDuration) {
      return (segment.start + weightedTime / segment.weight) as V7ReferenceTime;
    }
    weightedTime -= segmentDuration;
  }
  return V7_REFERENCE_PINNED_END as V7ReferenceTime;
}

export function scrollProgressAtReferenceTime(referenceTime: number): V7ScrollProgress {
  const clampedTime = clamp(0, V7_REFERENCE_PINNED_END, referenceTime);
  let weightedTime = 0;
  for (const segment of V7_SCROLL_TIME_SEGMENTS) {
    if (clampedTime >= segment.end) {
      weightedTime += (segment.end - segment.start) * segment.weight;
      continue;
    }
    if (clampedTime > segment.start) {
      weightedTime += (clampedTime - segment.start) * segment.weight;
    }
    break;
  }
  return (weightedTime / V7_WEIGHTED_SCROLL_DURATION) as V7ScrollProgress;
}

export function phaseAtReferenceTime(referenceTime: number): V7PhaseInterval {
  const time = clamp(0, V7_REFERENCE_PINNED_END, referenceTime);
  let current = V7_PHASE_INTERVALS[0];
  for (const interval of V7_PHASE_INTERVALS) {
    if (time >= interval.start) current = interval;
    else break;
  }
  return current;
}

export function activeWindowsAtReferenceTime(referenceTime: number): readonly V7MicroWindowId[] {
  const time = clamp(0, V7_REFERENCE_PINNED_END, referenceTime);
  return V7_MICRO_WINDOWS.filter((interval) => within(time, interval)).map(({ id }) => id);
}

export function activePhasesAtReferenceTime(referenceTime: number): readonly V7PhaseName[] {
  const primary = phaseAtReferenceTime(referenceTime).id;
  const proofWallActive = referenceTime >= 30.5 && referenceTime < 32.49;
  if (proofWallActive && primary === "darkCampaign") return ["proofWall", "darkCampaign"];
  return [primary];
}

export function materialClipPair(progress: number): V7MaterialClipState {
  const clampedProgress = clamp(0, 1, progress);
  const front = -6 + clampedProgress * 112;
  const p1 = front - 1.8;
  const p2 = front + 1.4;
  const p3 = front - 0.8;
  const p4 = front + 1.9;
  const p5 = front - 1.2;
  const percent = (value: number) => `${Number(value.toFixed(4))}%`;
  return {
    outgoingClip: `polygon(${percent(p1)} 0%, 100% 0%, 100% 100%, ${percent(p5)} 100%, ${percent(p4)} 76%, ${percent(p3)} 52%, ${percent(p2)} 27%)`,
    incomingClip: `polygon(0% 0%, ${percent(p1)} 0%, ${percent(p2)} 27%, ${percent(p3)} 52%, ${percent(p4)} 76%, ${percent(p5)} 100%, 0% 100%)`,
    edgeOpacity: clampedProgress > 0.02 && clampedProgress < 0.98 ? 0.72 : 0,
    edgeXPercent: front * 11.1 - 50,
  };
}

export function materialPresentationAtReferenceTime(referenceTime: number): V7MaterialPresentation {
  if (referenceTime > 1.2 && referenceTime < 2.06) {
    const progress = (referenceTime - 1.2) / (2.06 - 1.2);
    return {
      kind: "handoff",
      outgoing: "basic",
      incoming: "standard",
      progress,
      playingTiers: ["basic", "standard"],
      phaseAttribute: "basic-to-standard",
      clip: materialClipPair(progress),
    };
  }
  if (referenceTime > 3.05 && referenceTime < 3.89) {
    const progress = (referenceTime - 3.05) / (3.89 - 3.05);
    return {
      kind: "handoff",
      outgoing: "standard",
      incoming: "pro",
      progress,
      playingTiers: ["standard", "pro"],
      phaseAttribute: "standard-to-pro",
      clip: materialClipPair(progress),
    };
  }
  const tier: V7Tier = referenceTime <= 1.2 ? "basic" : referenceTime <= 3.05 ? "standard" : "pro";
  return {
    kind: "hold",
    tier,
    playingTiers: [tier],
    phaseAttribute: `hold-${tier}`,
  };
}

export function openingHeadlineAtReferenceTime(referenceTime: number) {
  if (referenceTime < 1.63) return { activeTier: "basic", activeWord: "pace." } as const;
  if (referenceTime < 3.47) return { activeTier: "standard", activeWord: "format." } as const;
  return { activeTier: "pro", activeWord: "plan." } as const;
}

export function reactTariffTierAtReferenceTime(referenceTime: number): V7Tier {
  if (referenceTime < 14.37) return "basic";
  if (referenceTime < 15.03) return "standard";
  if (referenceTime < 19.5) return "pro";
  if (referenceTime < 25.54) return "basic";
  if (referenceTime < 28.05) return "standard";
  return "pro";
}

export function phoneVisualTierFromComputedOpacity(
  opacities: readonly [number, number, number],
  currentTier: V7Tier,
): V7Tier {
  let nextTier = currentTier;
  let strongestOpacity: number = V7_PRESENTATION_THRESHOLDS.phoneTierOpacity;
  opacities.forEach((opacity, index) => {
    if (opacity > strongestOpacity) {
      strongestOpacity = opacity;
      nextTier = V7_TIER_IDS[index];
    }
  });
  return nextTier;
}

export function phoneIdentityAtReferenceTime(referenceTime: number): V7PhoneIdentity {
  if (referenceTime < 15.6) return "visible-black";
  if (referenceTime < 17.05) return "dissolving";
  if (referenceTime < 18.1) return "trace-only";
  if (referenceTime < 19.6) return "offscreen-prepared";
  if (referenceTime < 20.1) return "returning";
  return "restored";
}

export function responsiveState(viewport: V7SequenceInput["viewport"]): V7ResponsiveState {
  return {
    width: viewport.width,
    height: viewport.height,
    pixelRatio: viewport.pixelRatio,
    narrowCardLayout: viewport.width < V7_PRESENTATION_THRESHOLDS.narrowCardWidth,
    headlineVideoAllowed: viewport.width >= V7_PRESENTATION_THRESHOLDS.headlineVideoMinWidth,
    compactSequenceLayout: viewport.width < V7_PRESENTATION_THRESHOLDS.sequenceCompactWidth,
    compactOpeningLayout: viewport.width < V7_PRESENTATION_THRESHOLDS.openingCompactWidth,
  };
}

export function animatedControlAvailability(
  observation: V7AnimatedControlObservation,
): V7AnimatedControlAvailability {
  const interactive = observation.sceneActive
    && Number.isFinite(observation.computedOpacity)
    && observation.computedOpacity >= V7_PRESENTATION_THRESHOLDS.controlOpacity
    && (
      !Number.isFinite(observation.computedScale)
      || observation.computedScale >= V7_PRESENTATION_THRESHOLDS.controlScale
    );
  return { interactive, inert: !interactive, tabIndex: interactive ? 0 : -1 };
}

export function lifecycleOverlay(input: Pick<V7SequenceInput, "motion" | "document">): V7LifecycleOverlay {
  if (input.motion === "reduced") {
    return { kind: "reduced-motion-static", timelineMayAdvance: false, mediaMayPlay: false };
  }
  if (input.document === "hidden") {
    return { kind: "document-hidden", timelineMayAdvance: true, mediaMayPlay: false };
  }
  return { kind: "active-normal", timelineMayAdvance: true, mediaMayPlay: true };
}

function mediaIntents(
  input: V7SequenceInput,
  responsive: V7ResponsiveState,
  lifecycle: V7LifecycleOverlay,
  material: V7MaterialPresentation,
  phoneVisualTier: V7Tier,
  standardPhonePreroll: boolean,
  atmosphere: { warm: boolean; active: boolean },
): V7CandidateOneMediaIntent {
  const mayPlay = lifecycle.mediaMayPlay;
  const headlinePlay = mayPlay && responsive.headlineVideoAllowed && input.observations.headlineVisible;
  const phonePlay = mayPlay && (input.observations.phoneVisible || standardPhonePreroll);
  const atmosphereDemand = !mayPlay || !atmosphere.warm
    ? "cold"
    : atmosphere.active && input.observations.atmosphereVisible
      ? "play"
      : "warm";
  const mascotDemand = mayPlay && input.observations.mascotVisible ? "play" : "cold";
  const applicationDemand = mayPlay
    && input.observations.application.kind === "open"
    && input.observations.application.tier === "pro"
    ? "play"
    : "cold";
  const footerDemand = mayPlay && input.observations.footerVisible ? "play" : "cold";
  const safariPackedAlpha = input.browserProfile !== "standard";
  return {
    headline: {
      role: "headline",
      demand: headlinePlay ? "play" : "cold",
      playingTiers: material.playingTiers,
    },
    phone: {
      role: "phone",
      demand: phonePlay ? "play" : "cold",
      visualTier: phoneVisualTier,
      standardPreroll: standardPhonePreroll,
      proTrack: input.observations.proPhoneTrack,
    },
    atmosphere: { role: "pro-atmosphere", demand: atmosphereDemand },
    mascot: {
      role: "mascot",
      demand: mascotDemand,
      gazeScheduling: "candidate-one-runtime-owned",
    },
    packedAlpha: {
      role: "packed-alpha",
      demand: safariPackedAlpha ? mascotDemand : "cold",
      renderer: safariPackedAlpha ? "packed-alpha-webgl" : "native-alpha",
    },
    applicationPro: { role: "application-pro", demand: applicationDemand },
    footerMaterial: { role: "footer-material", demand: footerDemand },
  };
}

function validateInput(input: V7SequenceInput): readonly V7ContractError[] {
  const errors: V7ContractError[] = [];
  const timelineValue = input.timeline.kind === "reference-time"
    ? input.timeline.seconds
    : input.timeline.progress;
  if (!Number.isFinite(timelineValue)) {
    errors.push({
      code: "non-finite-timeline",
      path: `timeline.${input.timeline.kind === "reference-time" ? "seconds" : "progress"}`,
      message: "The timeline coordinate must be finite.",
    });
  }
  if (
    !Number.isFinite(input.viewport.width)
    || !Number.isFinite(input.viewport.height)
    || !Number.isFinite(input.viewport.pixelRatio)
    || input.viewport.width <= 0
    || input.viewport.height <= 0
    || input.viewport.pixelRatio <= 0
  ) {
    errors.push({ code: "invalid-viewport", path: "viewport", message: "Viewport dimensions and pixel ratio must be positive finite numbers." });
  }
  input.observations.phoneStateOpacities.forEach((opacity, index) => {
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      errors.push({
        code: "invalid-phone-opacity",
        path: `observations.phoneStateOpacities.${index}`,
        message: "Computed phone opacity must be within 0 and 1.",
      });
    }
  });
  if (!V7_TIER_IDS.includes(input.observations.currentPhoneVisualTier)) {
    errors.push({ code: "invalid-phone-tier", path: "observations.currentPhoneVisualTier", message: "Current phone tier must be basic, standard, or pro." });
  }
  if (
    input.observations.application.kind !== "closed"
    && (
      input.observations.application.kind !== "open"
      || !V7_TIER_IDS.includes(input.observations.application.tier)
    )
  ) {
    errors.push({ code: "invalid-application-observation", path: "observations.application", message: "Application state must be closed or open with a valid tier." });
  }
  return errors;
}

export function resolveV7Sequence(input: V7SequenceInput): V7ResolveResult {
  const errors = validateInput(input);
  if (errors.length > 0) return { ok: false, errors };

  const referenceTime = input.timeline.kind === "reference-time"
    ? clamp(0, V7_REFERENCE_PINNED_END, input.timeline.seconds)
    : referenceTimeAtScrollProgress(input.timeline.progress);
  const scrollProgress = scrollProgressAtReferenceTime(referenceTime);
  const interval = phaseAtReferenceTime(referenceTime);
  const activeWindows = activeWindowsAtReferenceTime(referenceTime);
  const material = materialPresentationAtReferenceTime(referenceTime);
  const phoneVisualTier = phoneVisualTierFromComputedOpacity(
    input.observations.phoneStateOpacities,
    input.observations.currentPhoneVisualTier,
  );
  const responsive = responsiveState(input.viewport);
  const lifecycle = lifecycleOverlay(input);
  const standardPhonePreroll = activeWindows.includes("standard-phone-preroll-one")
    || activeWindows.includes("standard-phone-preroll-two");
  const atmosphereWarm = activeWindows.includes("pro-atmosphere-warm");
  const atmosphereActive = activeWindows.includes("pro-atmosphere-visible");
  const presentation = {
    proofWallActive: activeWindows.includes("pro-proof-wall-visible"),
    standardPhonePreroll,
    atmosphere: {
      warm: atmosphereWarm,
      active: atmosphereActive,
      demand: atmosphereActive ? "play" as const : atmosphereWarm ? "warm" as const : "cold" as const,
    },
    phoneIdentity: phoneIdentityAtReferenceTime(referenceTime),
    thresholds: V7_PRESENTATION_THRESHOLDS,
  };
  const state: V7SequenceState = {
    time: {
      requested: input.timeline,
      referenceTime: referenceTime as V7ReferenceTime,
      weightedReferenceTime: (scrollProgress * V7_WEIGHTED_SCROLL_DURATION) as V7WeightedReferenceTime,
      scrollProgress,
      firstSequenceEnd: V7_REFERENCE_FIRST_SEQUENCE_END,
      pinnedSequenceEnd: V7_REFERENCE_PINNED_END,
      fullReferenceMetadataEnd: V7_REFERENCE_FULL_METADATA_END,
    },
    phases: {
      primary: interval.id,
      active: activePhasesAtReferenceTime(referenceTime),
      interval,
      windows: activeWindows,
    },
    tiers: {
      reactTariffTier: reactTariffTierAtReferenceTime(referenceTime),
      phoneVisualTier,
      openingHeadline: openingHeadlineAtReferenceTime(referenceTime),
    },
    material,
    presentation,
    responsive,
    lifecycle,
    media: mediaIntents(
      input,
      responsive,
      lifecycle,
      material,
      phoneVisualTier,
      standardPhonePreroll,
      presentation.atmosphere,
    ),
    gsapCuePlan: V7_GSAP_CUE_PLAN,
    productionAuthority: "v7-sequence-contract",
  };
  return { ok: true, state };
}

export function resolveV7SequenceOrThrow(input: V7SequenceInput): V7SequenceState {
  const result = resolveV7Sequence(input);
  if (result.ok) return result.state;
  throw new Error(result.errors.map(({ path, message }) => `${path}: ${message}`).join("; "));
}

function changed<Value>(left: Value, right: Value) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

export function diffV7Sequence(from: V7SequenceState, to: V7SequenceState): V7TransitionDiff {
  const changes: V7TransitionChange[] = [];
  if (changed(from.phases.active, to.phases.active)) {
    changes.push({ kind: "phase", from: from.phases.active, to: to.phases.active });
  }
  if (from.tiers.reactTariffTier !== to.tiers.reactTariffTier) {
    changes.push({ kind: "react-tier", from: from.tiers.reactTariffTier, to: to.tiers.reactTariffTier });
  }
  if (from.tiers.phoneVisualTier !== to.tiers.phoneVisualTier) {
    changes.push({ kind: "phone-visual-tier", from: from.tiers.phoneVisualTier, to: to.tiers.phoneVisualTier });
  }
  if (changed(from.material, to.material)) {
    changes.push({ kind: "material", from: from.material, to: to.material });
  }
  if (changed(from.lifecycle, to.lifecycle)) {
    changes.push({ kind: "lifecycle", from: from.lifecycle, to: to.lifecycle });
  }
  if (changed(from.media, to.media)) {
    changes.push({ kind: "media", from: from.media, to: to.media });
  }
  return {
    fromReferenceTime: from.time.referenceTime,
    toReferenceTime: to.time.referenceTime,
    changes,
  };
}

export function createV7SequenceInput(
  timeline: V7SequenceInput["timeline"],
  overrides: Partial<Omit<V7SequenceInput, "timeline" | "observations">> & {
    observations?: Partial<V7SequenceInput["observations"]>;
  } = {},
): V7SequenceInput {
  const observations: V7SequenceInput["observations"] = {
    currentPhoneVisualTier: "basic",
    phoneStateOpacities: [1, 0, 0],
    headlineVisible: true,
    phoneVisible: true,
    atmosphereVisible: true,
    mascotVisible: true,
    footerVisible: true,
    application: { kind: "closed" },
    proPhoneTrack: "intro",
    ...overrides.observations,
  };
  return {
    timeline,
    viewport: overrides.viewport ?? { width: 1440, height: 900, pixelRatio: 1 },
    motion: overrides.motion ?? "normal",
    document: overrides.document ?? "visible",
    browserProfile: overrides.browserProfile ?? "standard",
    observations,
  };
}

export function isV7PhaseName(value: string): value is V7PhaseName {
  return V7_PHASE_NAMES.includes(value as V7PhaseName);
}
