export type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type V7ReferenceTime = Brand<number, "V7ReferenceTime">;
export type V7WeightedReferenceTime = Brand<number, "V7WeightedReferenceTime">;
export type V7ScrollProgress = Brand<number, "V7ScrollProgress">;

export const V7_TIER_IDS = ["basic", "standard", "pro"] as const;
export type V7Tier = (typeof V7_TIER_IDS)[number];

export const V7_PHASE_NAMES = [
  "openingGeometry",
  "openingHeadline",
  "mascotRise",
  "mascotSettle",
  "headlineMedallions",
  "headlineArchitecture",
  "headlineFlood",
  "phoneEmergence",
  "phoneHold",
  "phoneMaterialTakeover",
  "outlineTrace",
  "blockHeadline",
  "readableHeadline",
  "phoneReturn",
  "sideCardsRise",
  "firstCluster",
  "violetRise",
  "turnEnglishOn",
  "secondCardSystem",
  "coralRise",
  "learnWithConfidence",
  "lessonObject",
  "proofWall",
  "darkCampaign",
] as const;
export type V7PhaseName = (typeof V7_PHASE_NAMES)[number];

export type V7BoundaryPolicy = "open" | "closed";

export type V7PhaseInterval = Readonly<{
  id: V7PhaseName;
  start: number;
  end: number;
  startBoundary: "closed";
  endBoundary: V7BoundaryPolicy;
}>;

export const V7_MICRO_WINDOW_IDS = [
  "opening-basic-to-standard",
  "opening-standard-to-pro",
  "standard-phone-preroll-one",
  "standard-phone-preroll-two",
  "pro-atmosphere-warm",
  "pro-atmosphere-visible",
  "mascot-lesson-handoff",
  "mascot-lesson-handoff-before-seam",
  "mascot-lesson-handoff-after-seam",
  "pro-proof-wall-visible",
  "proof-wall-dark-campaign-overlap",
] as const;
export type V7MicroWindowId = (typeof V7_MICRO_WINDOW_IDS)[number];

export type V7MicroWindow = Readonly<{
  id: V7MicroWindowId;
  start: number;
  end: number;
  startBoundary: V7BoundaryPolicy;
  endBoundary: V7BoundaryPolicy;
  overlaps?: readonly V7PhaseName[];
}>;

export type V7TimelineInput =
  | Readonly<{ kind: "reference-time"; seconds: number }>
  | Readonly<{ kind: "scroll-progress"; progress: number }>;

export type V7ViewportInput = Readonly<{
  width: number;
  height: number;
  pixelRatio: number;
}>;

export type V7ResponsiveState = Readonly<{
  width: number;
  height: number;
  pixelRatio: number;
  narrowCardLayout: boolean;
  headlineVideoAllowed: boolean;
  compactSequenceLayout: boolean;
  compactOpeningLayout: boolean;
}>;

export type V7MotionPreference = "normal" | "reduced";
export type V7DocumentLifecycle = "visible" | "hidden";
export type V7BrowserProfile = "standard" | "desktop-safari" | "ios-webkit";

export type V7LifecycleOverlay =
  | Readonly<{
      kind: "active-normal";
      timelineMayAdvance: true;
      mediaMayPlay: true;
    }>
  | Readonly<{
      kind: "document-hidden";
      timelineMayAdvance: true;
      mediaMayPlay: false;
    }>
  | Readonly<{
      kind: "reduced-motion-static";
      timelineMayAdvance: false;
      mediaMayPlay: false;
    }>;

export type V7PhoneOpacityObservations = readonly [number, number, number];

export type V7ApplicationObservation =
  | Readonly<{ kind: "closed" }>
  | Readonly<{ kind: "open"; tier: V7Tier }>;

export type V7DeterministicObservations = Readonly<{
  currentPhoneVisualTier: V7Tier;
  phoneStateOpacities: V7PhoneOpacityObservations;
  headlineVisible: boolean;
  phoneVisible: boolean;
  atmosphereVisible: boolean;
  mascotVisible: boolean;
  footerVisible: boolean;
  application: V7ApplicationObservation;
  proPhoneTrack: "intro" | "loop";
}>;

export type V7SequenceInput = Readonly<{
  timeline: V7TimelineInput;
  viewport: V7ViewportInput;
  motion: V7MotionPreference;
  document: V7DocumentLifecycle;
  browserProfile: V7BrowserProfile;
  observations: V7DeterministicObservations;
}>;

export type V7OpeningHeadlineState = Readonly<{
  activeTier: V7Tier;
  activeWord: "pace." | "format." | "plan.";
}>;

export type V7MaterialClipState = Readonly<{
  outgoingClip: string;
  incomingClip: string;
  edgeOpacity: number;
  edgeXPercent: number;
}>;

export type V7MaterialPresentation =
  | Readonly<{
      kind: "hold";
      tier: V7Tier;
      playingTiers: readonly [V7Tier];
      phaseAttribute: `hold-${V7Tier}`;
    }>
  | Readonly<{
      kind: "handoff";
      outgoing: V7Tier;
      incoming: V7Tier;
      progress: number;
      playingTiers: readonly [V7Tier, V7Tier];
      phaseAttribute: `${V7Tier}-to-${V7Tier}`;
      clip: V7MaterialClipState;
    }>;

export type V7PhoneIdentity =
  | "visible-black"
  | "dissolving"
  | "trace-only"
  | "offscreen-prepared"
  | "returning"
  | "restored";

export type V7PresentationThresholds = Readonly<{
  controlOpacity: 0.12;
  controlScale: 0.68;
  phoneTierOpacity: 0.5;
  headlineVideoMinWidth: 721;
  sequenceCompactWidth: 900;
  openingCompactWidth: 1100;
  narrowCardWidth: 560;
}>;

export type V7AnimatedControlObservation = Readonly<{
  sceneActive: boolean;
  computedOpacity: number;
  computedScale: number;
}>;

export type V7AnimatedControlAvailability = Readonly<{
  interactive: boolean;
  inert: boolean;
  tabIndex: 0 | -1;
}>;

export type V7AtmospherePresentation = Readonly<{
  warm: boolean;
  active: boolean;
  demand: "cold" | "warm" | "play";
}>;

export type V7PresentationState = Readonly<{
  proofWallActive: boolean;
  standardPhonePreroll: boolean;
  atmosphere: V7AtmospherePresentation;
  phoneIdentity: V7PhoneIdentity;
  thresholds: V7PresentationThresholds;
}>;

export type V7MediaDemand = "cold" | "warm" | "play";

export type V7CandidateOneMediaIntent = Readonly<{
  headline: Readonly<{
    role: "headline";
    demand: V7MediaDemand;
    playingTiers: readonly V7Tier[];
  }>;
  phone: Readonly<{
    role: "phone";
    demand: V7MediaDemand;
    visualTier: V7Tier;
    standardPreroll: boolean;
    proTrack: "intro" | "loop";
  }>;
  atmosphere: Readonly<{
    role: "pro-atmosphere";
    demand: V7MediaDemand;
  }>;
  mascot: Readonly<{
    role: "mascot";
    demand: V7MediaDemand;
    gazeScheduling: "candidate-one-runtime-owned";
  }>;
  packedAlpha: Readonly<{
    role: "packed-alpha";
    demand: V7MediaDemand;
    renderer: "native-alpha" | "packed-alpha-webgl";
  }>;
  applicationPro: Readonly<{
    role: "application-pro";
    demand: V7MediaDemand;
  }>;
  footerMaterial: Readonly<{
    role: "footer-material";
    demand: V7MediaDemand;
  }>;
}>;

export type V7GsapCue =
  | Readonly<{ kind: "phase-label"; phase: V7PhaseName; at: number }>
  | Readonly<{ kind: "window-entry"; window: V7MicroWindowId; at: number }>;

export type V7GsapCuePlan = Readonly<{
  authority: "contract-cues-legacy-adapters";
  referenceEnd: number;
  cues: readonly V7GsapCue[];
}>;

export type V7ResolvedTime = Readonly<{
  requested: V7TimelineInput;
  referenceTime: V7ReferenceTime;
  weightedReferenceTime: V7WeightedReferenceTime;
  scrollProgress: V7ScrollProgress;
  firstSequenceEnd: 21.6;
  pinnedSequenceEnd: 33.5;
  fullReferenceMetadataEnd: 39.49;
}>;

export type V7ResolvedPhases = Readonly<{
  primary: V7PhaseName;
  active: readonly V7PhaseName[];
  interval: V7PhaseInterval;
  windows: readonly V7MicroWindowId[];
}>;

export type V7TierAxes = Readonly<{
  reactTariffTier: V7Tier;
  phoneVisualTier: V7Tier;
  openingHeadline: V7OpeningHeadlineState;
}>;

export type V7SequenceState = Readonly<{
  time: V7ResolvedTime;
  phases: V7ResolvedPhases;
  tiers: V7TierAxes;
  material: V7MaterialPresentation;
  presentation: V7PresentationState;
  responsive: V7ResponsiveState;
  lifecycle: V7LifecycleOverlay;
  media: V7CandidateOneMediaIntent;
  gsapCuePlan: V7GsapCuePlan;
  productionAuthority: "v7-sequence-contract";
}>;

export type V7ContractErrorCode =
  | "non-finite-timeline"
  | "invalid-viewport"
  | "invalid-phone-opacity"
  | "invalid-phone-tier"
  | "invalid-application-observation";

export type V7ContractError = Readonly<{
  code: V7ContractErrorCode;
  path: string;
  message: string;
}>;

export type V7ResolveResult =
  | Readonly<{ ok: true; state: V7SequenceState }>
  | Readonly<{ ok: false; errors: readonly V7ContractError[] }>;

export type V7TransitionChange =
  | Readonly<{ kind: "phase"; from: readonly V7PhaseName[]; to: readonly V7PhaseName[] }>
  | Readonly<{ kind: "react-tier"; from: V7Tier; to: V7Tier }>
  | Readonly<{ kind: "phone-visual-tier"; from: V7Tier; to: V7Tier }>
  | Readonly<{ kind: "material"; from: V7MaterialPresentation; to: V7MaterialPresentation }>
  | Readonly<{ kind: "lifecycle"; from: V7LifecycleOverlay; to: V7LifecycleOverlay }>
  | Readonly<{ kind: "media"; from: V7CandidateOneMediaIntent; to: V7CandidateOneMediaIntent }>;

export type V7TransitionDiff = Readonly<{
  fromReferenceTime: V7ReferenceTime;
  toReferenceTime: V7ReferenceTime;
  changes: readonly V7TransitionChange[];
}>;

export type V7InvariantResult = Readonly<{
  id: string;
  passed: boolean;
  message: string;
}>;

export type V7SequenceInvariant = Readonly<{
  id: string;
  evaluate: () => V7InvariantResult;
}>;

export type V7ShadowComparable = Omit<V7SequenceState, "gsapCuePlan" | "productionAuthority">;

export type V7ShadowMismatch = Readonly<{
  phase: V7PhaseName;
  referenceTime: number;
  input: V7SequenceInput;
  legacy: V7ShadowComparable;
  contract: V7ShadowComparable;
}>;

export type V7ShadowReport = Readonly<{
  checked: number;
  mismatches: readonly V7ShadowMismatch[];
  passed: boolean;
}>;
