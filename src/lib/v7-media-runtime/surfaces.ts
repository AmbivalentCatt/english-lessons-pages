import {
  readLegacyHeadlinePlayingTiers,
  readLegacyPhoneVisualTier,
  readLegacyProAtmosphereState,
  readLegacyStandardPhonePreroll,
  type V7HeadlineTier,
} from "@/lib/v7-media-runtime/legacy-sequence-bridge";
import {
  leaseForSession,
  type V7MediaAdapter,
  type V7MediaLease,
  type V7MediaState,
  V7MediaSurfaceSession,
} from "@/lib/v7-media-runtime/runtime";
import {
  connectPackedAlphaSurface,
  type V7PackedAlphaSurfaceSpec,
} from "@/lib/v7-media-runtime/packed-alpha-renderer";
import {
  V7_MASCOT_GAZE_INTENT_EVENT,
  V7_MASCOT_RECORDED_LOOKS,
  type V7MascotGazeDirection,
} from "@/lib/v7-media-runtime/mascot-pose-splice";
export { V7_MASCOT_GAZE_INTENT_EVENT, V7_MASCOT_POSE_SPLICE } from "@/lib/v7-media-runtime/mascot-pose-splice";
import {
  resolveV7MediaIntentSnapshot,
  selectV7HeadlinePlayingTiers,
  selectV7MediaDemand,
  selectV7PhoneVisualTier,
  type V7MediaIntentFacts,
  type V7Tier,
  V7_SEQUENCE_CONTRACT_ROLLOUT,
} from "@/lib/v7-sequence-contract";

type StateSink = (state: V7MediaState) => void;

export type V7HeadlineSurfaceSpec = Readonly<{
  kind: "headline";
  headlineRig: HTMLElement;
  videos: readonly Readonly<{ tier: V7HeadlineTier; video: HTMLVideoElement }>[];
  getReferenceTime?: () => number;
  onState?: StateSink;
}>;

export type V7PhoneSurfaceSpec = Readonly<{
  kind: "phone";
  states: readonly (HTMLElement | null)[];
  videos: readonly (HTMLVideoElement | null)[];
  phone: HTMLElement;
  stage: HTMLElement;
  initialActiveTier: number;
  initialProPhase: "intro" | "idle";
  getReferenceTime?: () => number;
  onActiveTier: (tier: number) => void;
  onProPhase: (phase: "intro" | "idle") => void;
  onState?: StateSink;
}>;

export type V7ProAtmosphereSurfaceSpec = Readonly<{
  kind: "pro-atmosphere";
  stage: HTMLElement;
  scene: HTMLElement;
  video: HTMLVideoElement;
  loopLeadSeconds: number;
  loopRestartSeconds: number;
  getReferenceTime?: () => number;
  onReady: (ready: boolean) => void;
  onState?: StateSink;
}>;

export type V7ApplicationSurfaceSpec = Readonly<{
  kind: "application-pro";
  video: HTMLVideoElement;
  loopLeadSeconds: number;
  loopRestartSeconds: number;
  onReady: (ready: boolean) => void;
  onState?: StateSink;
}>;

export type V7MascotBridgePhase = "idle" | "to-gaze" | "to-base";

export type V7MascotSurfaceSpec = Readonly<{
  kind: "mascot";
  baseVideo: HTMLVideoElement;
  gazeVideo: HTMLVideoElement;
  visibleTarget: HTMLElement;
  baseToGazeMatchSeconds: number;
  baseToGazeMatchWindows?: readonly Readonly<{ start: number; end: number }>[];
  gazeMatchStartSeconds: number;
  gazeToBaseMatchSeconds: number;
  baseMatchRestartSeconds: number;
  toGazeCrossfadeMs: number;
  toBaseCrossfadeMs: number;
  initialGazeDelayMs?: number;
  repeatedGazeDelayMs?: number;
  gazeIntentTarget?: EventTarget;
  getReferenceTime?: () => number;
  onBaseFailed: (failed: boolean) => void;
  onGazeFailed: (failed: boolean) => void;
  onGazeActive: (active: boolean) => void;
  onBridgePhase: (phase: V7MascotBridgePhase) => void;
  onState?: StateSink;
}>;

export interface V7FooterMaterialRenderer {
  draw(): boolean;
  clear(): void;
  dispose(): void;
}

export type V7FooterSurfaceSpec = Readonly<{
  kind: "footer-material";
  brand: HTMLElement;
  video: HTMLVideoElement;
  renderer: V7FooterMaterialRenderer;
  onReady: (ready: boolean) => void;
  onState?: StateSink;
}>;

const tierFromIndex = (index: number): V7Tier => (
  index === 1 ? "standard" : index === 2 ? "pro" : "basic"
);

const tierToIndex = (tier: V7Tier) => (
  tier === "standard" ? 1 : tier === "pro" ? 2 : 0
);

function mediaIntentFacts(
  adapter: V7MediaAdapter,
  referenceTime: number,
  overrides: Partial<V7MediaIntentFacts> = {},
): V7MediaIntentFacts {
  return {
    referenceTime,
    viewport: adapter.viewport(),
    browserProfile: adapter.profile,
    reducedMotion: adapter.reducedMotion(),
    documentVisible: adapter.documentVisible(),
    ...overrides,
  };
}

export type V7ImplementedMediaSurfaceSpec =
  | V7HeadlineSurfaceSpec
  | V7PhoneSurfaceSpec
  | V7ProAtmosphereSurfaceSpec
  | V7ApplicationSurfaceSpec
  | V7FooterSurfaceSpec
  | V7MascotSurfaceSpec
  | V7PackedAlphaSurfaceSpec;

function watchMatchedLoop(
  session: V7MediaSurfaceSession,
  video: HTMLVideoElement,
  leadSeconds: number,
  restartSeconds: number,
) {
  const inspect = (mediaTime: number) => {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || duration - mediaTime > leadSeconds) return;
    try { session.adapter.seek(video, restartSeconds); } catch { /* metadata may be changing */ }
  };

  if (typeof video.requestVideoFrameCallback !== "function") {
    return session.own(session.adapter.listen(video, "timeupdate", (() => inspect(video.currentTime)) as EventListener));
  }

  let cancelFrame: (() => void) | null = null;
  const schedule = () => {
    if (cancelFrame || session.disposed) return;
    cancelFrame = session.mediaFrame(video, (_time, metadata) => {
      cancelFrame = null;
      inspect(metadata.mediaTime);
      schedule();
    });
  };
  session.own(session.adapter.listen(video, "loadeddata", schedule as EventListener));
  session.own(session.adapter.listen(video, "playing", schedule as EventListener));
  schedule();
  return session.own(() => cancelFrame?.());
}

export function connectHeadlineSurface(adapter: V7MediaAdapter, spec: V7HeadlineSurfaceSpec): V7MediaLease {
  const session = new V7MediaSurfaceSession(adapter, "headline", spec.onState);
  let cancelSyncFrame: (() => void) | null = null;

  const syncPlayback = () => {
    cancelSyncFrame = null;
    const headlineVisible = adapter.checkVisibility(spec.headlineRig);
    const legacyShouldPlay = adapter.matchesMedia("(min-width: 721px)")
      && !adapter.reducedMotion()
      && adapter.documentVisible()
      && headlineVisible;
    const legacyPlayingTiers = Array.from(readLegacyHeadlinePlayingTiers(spec.headlineRig));
    const facts = mediaIntentFacts(adapter, spec.getReferenceTime?.() ?? 0, {
      headlineVisible,
    });
    const shouldPlay = selectV7MediaDemand(
      "headline",
      facts,
      legacyShouldPlay ? "play" : "cold",
    ) === "play";
    const playingTiers = new Set(selectV7HeadlinePlayingTiers(facts, legacyPlayingTiers));
    session.transition({
      documentVisible: adapter.documentVisible(),
      reducedMotion: adapter.reducedMotion(),
      demand: shouldPlay && playingTiers.size > 0 ? "play" : "cold",
      visibility: headlineVisible ? "inside" : "css-hidden",
    });
    spec.videos.forEach(({ tier, video }) => {
      if (shouldPlay && playingTiers.has(tier)) {
        session.attach(video, "auto");
        void session.attemptPlay(video, {
          retryDelayMs: null,
          onPlaying: () => session.transition({ decode: "can-play", presentation: "video" }),
        });
      } else {
        session.pause(video);
      }
    });
  };
  const scheduleSync = () => {
    if (cancelSyncFrame) return;
    cancelSyncFrame = session.animationFrame(syncPlayback);
  };

  session.own(adapter.observeMutations(
    spec.headlineRig,
    ["data-active-tier", "data-playing-tiers", "style"],
    scheduleSync,
  ));
  session.own(adapter.observeReducedMotion(scheduleSync));
  session.own(adapter.observeMediaQuery("(min-width: 721px)", scheduleSync));
  session.own(adapter.observeDocumentVisibility(scheduleSync));
  session.own(() => cancelSyncFrame?.());
  session.own(() => spec.videos.forEach(({ video }) => adapter.releaseSource(video)));
  scheduleSync();
  return leaseForSession(session);
}

export function connectPhoneSurface(adapter: V7MediaAdapter, spec: V7PhoneSurfaceSpec): V7MediaLease {
  const session = new V7MediaSurfaceSession(adapter, "phone", spec.onState);
  let activeTier = spec.initialActiveTier;
  let proPhase = spec.initialProPhase;
  let phoneVisible = false;
  let cancelSyncFrame: (() => void) | null = null;
  let cancelRelease: (() => void) | null = null;
  const isIOS = adapter.profile === "ios-webkit";

  const phoneOpacities = (): readonly [number, number, number] => [
    spec.states[0] ? adapter.computedOpacity(spec.states[0]) : 0,
    spec.states[1] ? adapter.computedOpacity(spec.states[1]) : 0,
    spec.states[2] ? adapter.computedOpacity(spec.states[2]) : 0,
  ];
  const phoneIntentFacts = () => mediaIntentFacts(adapter, spec.getReferenceTime?.() ?? 0, {
    currentPhoneVisualTier: tierFromIndex(activeTier),
    phoneStateOpacities: phoneOpacities(),
    phoneVisible,
    proPhoneTrack: proPhase === "intro" ? "intro" : "loop",
  });
  const standardPrerollActive = () => V7_SEQUENCE_CONTRACT_ROLLOUT.mediaPhoneIntent
    ? resolveV7MediaIntentSnapshot(phoneIntentFacts()).phone.standardPreroll
    : readLegacyStandardPhonePreroll(spec.stage);
  const resetVideo = (video: HTMLVideoElement | null, release = false) => {
    if (!video) return;
    adapter.pause(video);
    if (release) {
      adapter.releaseSource(video);
      return;
    }
    try { adapter.seek(video, 0); } catch { /* metadata may not be ready */ }
  };
  const playVideo = (video: HTMLVideoElement | null, allowOffscreen = false) => {
    if (
      !video
      || (!phoneVisible && !allowOffscreen)
      || adapter.reducedMotion()
      || !adapter.documentVisible()
    ) return;
    session.attach(video, "auto");
    void session.attemptPlay(video, {
      retryDelayMs: null,
      onPlaying: () => session.transition({ decode: "can-play", presentation: "video" }),
    });
  };
  const setProPhase = (phase: "intro" | "idle") => {
    proPhase = phase;
    spec.onProPhase(phase);
  };
  const activateTier = (nextTier: number) => {
    if (activeTier === nextTier) return;
    activeTier = nextTier;
    spec.onActiveTier(nextTier);
    const preserveStandardPreroll = nextTier === 1 && standardPrerollActive();
    spec.videos.forEach((video, index) => {
      if (preserveStandardPreroll && video === spec.videos[1]) return;
      // A paused iOS video retains its decoder surfaces. Release the departed
      // tier before the next atmosphere starts, retaining only required preroll.
      const nextVideo = nextTier === 2 ? index === 2 || index === 3 : index === nextTier;
      resetVideo(video, isIOS && !nextVideo && !(index === 1 && standardPrerollActive()));
    });
    if (nextTier === 0) playVideo(spec.videos[0]);
    if (nextTier === 1) playVideo(spec.videos[1]);
    if (nextTier === 2) {
      setProPhase("intro");
      const idleVideo = spec.videos[3];
      if (phoneVisible && !adapter.reducedMotion() && idleVideo) session.attach(idleVideo, "metadata");
      playVideo(spec.videos[2]);
    }
    if (standardPrerollActive() && nextTier !== 1) playVideo(spec.videos[1], true);
  };
  const syncTier = () => {
    cancelSyncFrame = null;
    const legacyTier = tierFromIndex(readLegacyPhoneVisualTier(adapter, spec.states, activeTier));
    activateTier(tierToIndex(selectV7PhoneVisualTier(phoneIntentFacts(), legacyTier)));
  };
  const scheduleTierSync = () => {
    if (cancelSyncFrame) return;
    cancelSyncFrame = session.animationFrame(syncTier);
  };
  const syncVisibility = () => {
    cancelRelease?.();
    cancelRelease = null;
    const reduced = adapter.reducedMotion();
    const documentVisible = adapter.documentVisible();
    const shouldPrerollStandard = standardPrerollActive();
    const legacyDemand = reduced || !documentVisible
      ? "cold"
      : phoneVisible || shouldPrerollStandard
        ? "play"
        : "cold";
    const demand = selectV7MediaDemand("phone", phoneIntentFacts(), legacyDemand);
    session.transition({
      documentVisible,
      reducedMotion: reduced,
      visibility: phoneVisible ? "inside" : "outside",
      demand,
    });
    if (reduced || !documentVisible) {
      session.transition({ playback: "paused" });
      spec.videos.forEach((video) => video && adapter.pause(video));
      return;
    }
    if (shouldPrerollStandard) playVideo(spec.videos[1], true);
    else if (activeTier !== 1) resetVideo(spec.videos[1]);
    if (!phoneVisible) {
      spec.videos.forEach((video) => {
        if (shouldPrerollStandard && video === spec.videos[1]) return;
        if (video) adapter.pause(video);
      });
      if (isIOS && !shouldPrerollStandard) {
        cancelRelease = session.timeout(() => {
          spec.videos.forEach((video) => resetVideo(video, true));
          session.transition({ source: "detached", decode: "empty", presentation: "fallback" });
        }, 1400);
      }
      return;
    }
    if (activeTier === 0) playVideo(spec.videos[0]);
    if (activeTier === 1) playVideo(spec.videos[1]);
    if (activeTier === 2) playVideo(proPhase === "intro" ? spec.videos[2] : spec.videos[3]);
  };
  const handleProIntroEnded = () => {
    if (activeTier !== 2) return;
    if (isIOS && spec.videos[2]) adapter.releaseSource(spec.videos[2]);
    const idleVideo = spec.videos[3];
    setProPhase("idle");
    if (!idleVideo) return;
    session.attach(idleVideo, "auto");
    try { adapter.seek(idleVideo, 0); } catch { /* metadata may not be ready */ }
    void session.attemptPlay(idleVideo, {
      retryDelayMs: null,
      onPlaying: () => session.transition({ decode: "can-play", presentation: "video" }),
    });
  };

  spec.states.forEach((state) => {
    if (state) session.own(adapter.observeMutations(state, ["style", "class"], scheduleTierSync));
  });
  session.own(adapter.observeIntersection(spec.phone, 0.02, (visible) => {
    phoneVisible = visible;
    syncVisibility();
  }));
  session.own(adapter.observeMutations(spec.stage, ["data-standard-phone-preroll"], syncVisibility));
  session.own(adapter.observeDocumentVisibility(syncVisibility));
  session.own(adapter.observeReducedMotion(syncVisibility));
  const proIntroVideo = spec.videos[2];
  if (proIntroVideo) session.own(adapter.listen(proIntroVideo, "ended", handleProIntroEnded as EventListener));
  session.own(() => cancelSyncFrame?.());
  session.own(() => cancelRelease?.());
  session.own(() => {
    spec.videos.forEach((video) => {
      if (!video) return;
      if (isIOS) adapter.releaseSource(video);
      else adapter.pause(video);
    });
    spec.onActiveTier(-1);
  });
  scheduleTierSync();
  return leaseForSession(session);
}

export function connectProAtmosphereSurface(
  adapter: V7MediaAdapter,
  spec: V7ProAtmosphereSurfaceSpec,
): V7MediaLease {
  const session = new V7MediaSurfaceSession(adapter, "pro-atmosphere", spec.onState);
  let sceneVisible = false;
  let atmosphereWarmed = false;
  let cancelRelease: (() => void) | null = null;
  const isIOS = adapter.profile === "ios-webkit";
  watchMatchedLoop(session, spec.video, spec.loopLeadSeconds, spec.loopRestartSeconds);

  const syncPlayback = () => {
    const atmosphere = readLegacyProAtmosphereState(spec.stage);
    const legacyShouldWarm = atmosphere.warm && !adapter.reducedMotion();
    const legacyShouldPlay = atmosphere.active
      && sceneVisible
      && !adapter.reducedMotion()
      && adapter.documentVisible();
    const demand = selectV7MediaDemand(
      "atmosphere",
      mediaIntentFacts(adapter, spec.getReferenceTime?.() ?? 0, {
        atmosphereVisible: sceneVisible,
      }),
      legacyShouldPlay ? "play" : legacyShouldWarm ? "warm" : "cold",
    );
    const shouldWarm = demand !== "cold";
    const shouldPlay = demand === "play";
    session.transition({
      documentVisible: adapter.documentVisible(),
      reducedMotion: adapter.reducedMotion(),
      demand,
      visibility: sceneVisible ? "inside" : "outside",
    });
    if (shouldWarm && !atmosphereWarmed) {
      cancelRelease?.();
      cancelRelease = null;
      atmosphereWarmed = true;
      session.attach(spec.video, "auto");
    } else if (!shouldWarm && atmosphereWarmed) {
      atmosphereWarmed = false;
      spec.video.preload = "none";
      if (isIOS) {
        cancelRelease = session.timeout(() => {
          if (!atmosphereWarmed) session.release(spec.video);
        }, 1600);
      }
    }
    if (!shouldPlay) {
      session.pause(spec.video);
      return;
    }
    void session.attemptPlay(spec.video, {
      retryDelayMs: null,
      onPlaying: () => session.transition({ decode: "can-play", presentation: "video" }),
      onRejected: () => spec.onReady(false),
    });
  };

  session.own(adapter.observeIntersection(spec.scene, 0.02, (visible) => {
    sceneVisible = visible;
    syncPlayback();
  }));
  session.own(adapter.observeMutations(
    spec.stage,
    ["data-pro-atmosphere-active", "data-pro-atmosphere-warm"],
    syncPlayback,
  ));
  session.own(adapter.observeDocumentVisibility(syncPlayback));
  session.own(adapter.observeReducedMotion(syncPlayback));
  session.own(() => cancelRelease?.());
  session.own(() => {
    if (isIOS) adapter.releaseSource(spec.video);
    else adapter.pause(spec.video);
  });
  syncPlayback();
  return leaseForSession(session);
}

export function connectApplicationSurface(
  adapter: V7MediaAdapter,
  spec: V7ApplicationSurfaceSpec,
): V7MediaLease {
  const session = new V7MediaSurfaceSession(adapter, "application-pro", spec.onState);
  watchMatchedLoop(session, spec.video, spec.loopLeadSeconds, spec.loopRestartSeconds);
  const syncMotionPreference = () => {
    const reduced = adapter.reducedMotion();
    const demand = selectV7MediaDemand(
      "applicationPro",
      mediaIntentFacts(adapter, 33.5, { applicationTier: "pro" }),
      reduced ? "cold" : "play",
    );
    session.transition({
      reducedMotion: reduced,
      documentVisible: adapter.documentVisible(),
      demand,
      source: "attached",
    });
    if (demand !== "play") {
      session.pause(spec.video, "fallback");
      return;
    }
    void session.attemptPlay(spec.video, {
      retryDelayMs: null,
      onPlaying: () => session.transition({ decode: "can-play", presentation: "video" }),
      onRejected: () => spec.onReady(false),
    });
  };
  session.own(adapter.observeReducedMotion(syncMotionPreference));
  session.own(adapter.observeDocumentVisibility(syncMotionPreference));
  session.own(adapter.observePageShow(syncMotionPreference));
  session.own(() => adapter.pause(spec.video));
  syncMotionPreference();
  return leaseForSession(session);
}

export function connectFooterSurface(adapter: V7MediaAdapter, spec: V7FooterSurfaceSpec): V7MediaLease {
  const session = new V7MediaSurfaceSession(adapter, "footer-material", spec.onState);
  let visible = false;
  let cancelDrawFrame: (() => void) | null = null;
  let lastCanvasPaint = Number.NEGATIVE_INFINITY;

  const clearMaterial = () => {
    spec.renderer.clear();
    spec.onReady(false);
    session.transition({ decode: "empty", presentation: "fallback" });
  };
  const drawMaterial = () => {
    if (adapter.reducedMotion()) {
      clearMaterial();
      return;
    }
    const ready = spec.renderer.draw();
    spec.onReady(ready);
    session.transition({
      decode: ready ? "frame-ready" : "empty",
      presentation: ready ? "material" : "fallback",
    });
  };
  const stopDrawLoop = () => {
    cancelDrawFrame?.();
    cancelDrawFrame = null;
  };
  const startDrawLoop = () => {
    stopDrawLoop();
    if (typeof spec.video.requestVideoFrameCallback === "function") {
      const onFrame = () => {
        cancelDrawFrame = null;
        drawMaterial();
        if (visible && !adapter.reducedMotion() && !spec.video.paused) {
          cancelDrawFrame = session.mediaFrame(spec.video, onFrame);
        }
      };
      cancelDrawFrame = session.mediaFrame(spec.video, onFrame);
      return;
    }
    const onAnimationFrame = (time: number) => {
      cancelDrawFrame = null;
      if (time - lastCanvasPaint >= 1000 / 24) {
        drawMaterial();
        lastCanvasPaint = time;
      }
      if (visible && !adapter.reducedMotion() && !spec.video.paused) {
        cancelDrawFrame = session.animationFrame(onAnimationFrame);
      }
    };
    cancelDrawFrame = session.animationFrame(onAnimationFrame);
  };
  const syncPlayback = () => {
    const legacyShouldPlay = visible && !adapter.reducedMotion() && adapter.documentVisible();
    const demand = selectV7MediaDemand(
      "footerMaterial",
      mediaIntentFacts(adapter, 33.5, { footerVisible: visible }),
      legacyShouldPlay ? "play" : "cold",
    );
    const shouldPlay = demand === "play";
    session.transition({
      documentVisible: adapter.documentVisible(),
      reducedMotion: adapter.reducedMotion(),
      visibility: visible ? "inside" : "outside",
      demand,
    });
    if (!shouldPlay) {
      stopDrawLoop();
      session.pause(spec.video);
      if (adapter.reducedMotion()) clearMaterial();
      return;
    }
    session.attach(spec.video, "auto");
    void session.attemptPlay(spec.video, {
      retryDelayMs: null,
      onPlaying: () => {
        session.transition({ decode: "can-play" });
        startDrawLoop();
      },
      onRejected: clearMaterial,
    });
  };
  const handleLoadedData = () => {
    drawMaterial();
    syncPlayback();
  };
  const handlePageHide = () => {
    session.invalidate({ playback: "paused" });
    stopDrawLoop();
    adapter.pause(spec.video);
  };

  session.own(adapter.observeIntersection(spec.brand, 0.02, (nextVisible) => {
    visible = nextVisible;
    syncPlayback();
  }));
  session.own(adapter.observeResize(spec.brand, drawMaterial));
  session.own(adapter.listen(spec.video, "loadeddata", handleLoadedData as EventListener));
  session.own(adapter.listen(spec.video, "error", clearMaterial as EventListener));
  session.own(adapter.observeReducedMotion(syncPlayback));
  session.own(adapter.observeDocumentVisibility(syncPlayback));
  session.own(adapter.observePageShow(syncPlayback));
  session.own(adapter.observePageHide(handlePageHide));
  session.own(() => stopDrawLoop());
  session.own(() => {
    spec.renderer.dispose();
    adapter.releaseSource(spec.video);
  });
  syncPlayback();
  return leaseForSession(session);
}

export function connectMascotSurface(adapter: V7MediaAdapter, spec: V7MascotSurfaceSpec): V7MediaLease {
  const session = new V7MediaSurfaceSession(adapter, "mascot", spec.onState);
  const { baseVideo, gazeVideo } = spec;
  const originalBaseLoop = baseVideo.loop;
  // Automatic playback alternates complete clips instead of repeating the base.
  if (!spec.gazeIntentTarget) baseVideo.loop = false;
  const HAVE_CURRENT_DATA = 2;
  let visible = false;
  let cancelGazeTimer: (() => void) | null = null;
  let cancelBaseRetry: (() => void) | null = null;
  let cancelBaseFrame: (() => void) | null = null;
  let cancelGazeFrame: (() => void) | null = null;
  let baseLoadRequested = baseVideo.readyState !== 0;
  let gazePreparing = false;
  let gazeRunActive = false;
  let returnInFlight = false;
  let returnAttempts = 0;
  let cancelPoseHold: (() => void) | null = null;
  let gazeIntent: V7MascotGazeDirection = "neutral";
  let heldDirection: "left" | "right" | null = null;
  let intentRevision = 0;
  let satisfiedIntentRevision = 0;
  const heldDirections = new Set<"left" | "right">();
  const pointerDriven = Boolean(spec.gazeIntentTarget);
  spec.visibleTarget.dataset.handoffMode = "pose-splice";
  spec.visibleTarget.dataset.gazeIntent = gazeIntent;
  spec.visibleTarget.dataset.gazeHeld = "false";

  const mascotDemand = () => selectV7MediaDemand(
    "mascot",
    mediaIntentFacts(adapter, spec.getReferenceTime?.() ?? 0, { mascotVisible: visible }),
    visible && !adapter.reducedMotion() && adapter.documentVisible() ? "play" : "cold",
  );

  const valid = (generation: number) => session.isCurrent(generation)
    && mascotDemand() === "play";
  const setBridge = (phase: V7MascotBridgePhase) => {
    spec.onBridgePhase(phase);
    session.transition({
      presentation: phase === "to-gaze" ? "to-gaze" : phase === "to-base" ? "to-base" : session.state.presentation,
    });
  };
  const stopFrames = () => {
    cancelBaseFrame?.();
    cancelBaseFrame = null;
    cancelGazeFrame?.();
    cancelGazeFrame = null;
    cancelPoseHold?.();
    cancelPoseHold = null;
    heldDirection = null;
    spec.visibleTarget.dataset.gazeHeld = "false";
  };
  const waitForSeek = (video: HTMLVideoElement, time: number, generation: number) => new Promise<boolean>((resolve) => {
    const atTarget = () => !video.seeking
      && video.readyState >= HAVE_CURRENT_DATA
      && Math.abs(video.currentTime - time) <= 0.06;
    if (atTarget()) {
      resolve(valid(generation));
      return;
    }
    let settled = false;
    let cancelTimeout: () => void = () => undefined;
    let cancelListener: () => void = () => undefined;
    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      cancelTimeout();
      cancelListener();
      resolve(completed && valid(generation));
    };
    cancelTimeout = session.timeout(() => finish(false), 600);
    cancelListener = session.ownGeneration(adapter.listen(video, "seeked", (() => finish(atTarget())) as EventListener));
    session.ownGeneration(() => {
      if (settled) return;
      settled = true;
      cancelTimeout();
      cancelListener();
      resolve(false);
    });
    try { adapter.seek(video, time); } catch { finish(false); }
  });
  // play() can resolve before the incoming element has presented its first
  // decoded frame. Keep the outgoing clip visible until the matched frame is
  // actually available; an elapsed timeout is not evidence of media readiness.
  const waitForPresentedFrame = (video: HTMLVideoElement, minimumTime: number, generation: number) => new Promise<boolean>((resolve) => {
    let settled = false;
    let cancelTimeout: () => void = () => undefined;
    let cancelFrame: (() => void) | null = null;
    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      cancelTimeout();
      cancelFrame?.();
      resolve(completed && valid(generation));
    };
    const inspect = (_time: number, metadata: { mediaTime: number }) => {
      cancelFrame = null;
      if (!valid(generation)) {
        finish(false);
        return;
      }
      if (!video.seeking && !video.paused && video.readyState >= HAVE_CURRENT_DATA
        && metadata.mediaTime >= minimumTime - 0.06
        && metadata.mediaTime <= video.currentTime + 0.1) {
        finish(true);
        return;
      }
      cancelFrame = session.mediaFrame(video, inspect);
    };
    cancelTimeout = session.timeout(() => finish(false), 900);
    cancelFrame = session.mediaFrame(video, inspect);
    session.ownGeneration(() => finish(false));
  });
  const resumeBaseVideo = () => {
    if (mascotDemand() !== "play" || gazeRunActive || returnInFlight) return;
    cancelBaseRetry?.();
    cancelBaseRetry = null;
    if (baseVideo.readyState < HAVE_CURRENT_DATA) {
      baseVideo.preload = "auto";
      if (!baseLoadRequested) {
        baseLoadRequested = true;
        adapter.load(baseVideo);
      }
      return;
    }
    const generation = session.generation;
    void adapter.play(baseVideo).then(() => {
      if (!valid(generation)) return;
      spec.onBaseFailed(false);
      session.transition({ playback: "playing", decode: "frame-ready", presentation: "base", failure: null });
    }).catch(() => {
      if (!valid(generation)) return;
      session.transition({ playback: "retry-wait", presentation: "poster", failure: "play-rejected" });
      cancelBaseRetry = session.timeout(resumeBaseVideo, 1200);
    });
  };
  const waitForBaseMatch = (generation: number) => new Promise<boolean>((resolve) => {
    cancelBaseFrame?.();
    cancelBaseFrame = null;
    const startedAt = adapter.now();
    let settled = false;
    let cancelEnded: (() => void) | null = null;
    const finish = (matched: boolean) => {
      if (settled) return;
      settled = true;
      cancelBaseFrame?.(); cancelBaseFrame = null;
      cancelEnded?.();
      resolve(matched && valid(generation));
    };
    // End-of-clip is also an authoritative boundary. A busy renderer may skip
    // the last callback; that must never suppress the second original clip.
    cancelEnded = session.ownGeneration(adapter.listen(baseVideo, "ended", (() => finish(true)) as EventListener));
    session.ownGeneration(() => finish(false));
    const inspect = (now: number, mediaTime: number) => {
      cancelBaseFrame = null;
      if (!valid(generation)) { finish(false); return; }
      const duration = baseVideo.duration;
      const currentTime = Number.isFinite(mediaTime) ? mediaTime : baseVideo.currentTime;
      const matchWindows = spec.baseToGazeMatchWindows ?? [{
        start: spec.baseToGazeMatchSeconds,
        end: spec.baseToGazeMatchSeconds + 0.12,
      }];
      // WebM callback timestamps round 611/24 to 25.458. The 2 ms tolerance
      // accounts for metadata precision without skipping an animation frame.
      const nearMatch = Number.isFinite(duration) && duration > 0
        && matchWindows.some(({ start, end }) => currentTime >= start - 0.002 && currentTime <= Math.min(duration, end));
      const waitLimit = Number.isFinite(duration) && duration > 0 ? Math.max(10000, duration * 1500) : 10000;
      if (nearMatch || baseVideo.ended) { finish(true); return; }
      if (now - startedAt >= waitLimit) { finish(false); return; }
      cancelBaseFrame = session.mediaFrame(baseVideo, (time, metadata) => inspect(time, metadata.mediaTime));
    };
    cancelBaseFrame = session.mediaFrame(baseVideo, (time, metadata) => inspect(time, metadata.mediaTime));
  });

  let scheduleGaze: (delayMs?: number) => void = () => undefined;
  const finishGaze = async (generation: number) => {
    if (!gazeRunActive || returnInFlight || returnAttempts >= 2 || !valid(generation)) return;
    gazeRunActive = false;
    returnInFlight = true;
    returnAttempts += 1;
    cancelGazeFrame?.();
    cancelGazeFrame = null;
    const keepGazeVisible = (failure: string) => {
      if (!valid(generation)) return;
      returnInFlight = false;
      adapter.pause(baseVideo);
      gazeRunActive = true;
      session.transition({ presentation: "gaze", failure });
      // A brief decode stall gets one retry. Keep the last real gaze frame
      // visible if the base decoder stays unavailable.
      if (returnAttempts < 2) session.timeout(() => void finishGaze(generation), 250);
    };
    if (!await waitForSeek(baseVideo, spec.baseMatchRestartSeconds, generation)) {
      keepGazeVisible("base-return-seek-unready");
      return;
    }
    try {
      await adapter.play(baseVideo);
    } catch {
      keepGazeVisible("base-return-play-rejected");
      return;
    }
    if (!valid(generation)) {
      return;
    }
    if (!await waitForPresentedFrame(baseVideo, spec.baseMatchRestartSeconds, generation)) {
      keepGazeVisible("base-return-frame-unready");
      return;
    }
    spec.onBaseFailed(false);
    // One visible layer: switch at a decoded frontal pose instead of exposing
    // two independently moving ear silhouettes for a long dissolve.
    spec.onGazeActive(false);
    setBridge("idle");
    adapter.pause(gazeVideo);
    returnInFlight = false;
    session.transition({ playback: "playing", presentation: "base", failure: null });
    if (!pointerDriven) scheduleGaze(spec.repeatedGazeDelayMs ?? 7600);
    else if (gazeIntent !== "neutral" && satisfiedIntentRevision < intentRevision) scheduleGaze(0);
  };
  const resumeHeldGaze = async (generation: number) => {
    if (!heldDirection || !valid(generation)) return;
    cancelPoseHold?.();
    cancelPoseHold = null;
    heldDirection = null;
    spec.visibleTarget.dataset.gazeHeld = "false";
    try {
      await adapter.play(gazeVideo);
      if (valid(generation)) watchGazeReturn(generation);
    } catch {
      if (valid(generation)) session.transition({ failure: "gaze-hold-resume-rejected" });
    }
  };
  const watchGazeReturn = (generation: number) => {
    cancelGazeFrame?.();
    cancelGazeFrame = null;
    const inspect = (_time: number, mediaTime: number) => {
      cancelGazeFrame = null;
      if (!valid(generation) || returnInFlight) return;
      if (pointerDriven && gazeIntent !== "neutral" && !heldDirections.has(gazeIntent)
        && mediaTime >= V7_MASCOT_RECORDED_LOOKS[gazeIntent]
        && mediaTime < V7_MASCOT_RECORDED_LOOKS[gazeIntent] + 0.2) {
        heldDirection = gazeIntent;
        heldDirections.add(gazeIntent);
        satisfiedIntentRevision = intentRevision;
        adapter.pause(gazeVideo);
        spec.visibleTarget.dataset.gazeHeld = gazeIntent;
        cancelPoseHold = session.timeout(() => void resumeHeldGaze(generation), V7_MASCOT_RECORDED_LOOKS.maximumHoldMs);
        return;
      }
      if (mediaTime >= spec.gazeToBaseMatchSeconds) {
        void finishGaze(generation);
        return;
      }
      cancelGazeFrame = session.mediaFrame(gazeVideo, (time, metadata) => inspect(time, metadata.mediaTime));
    };
    cancelGazeFrame = session.mediaFrame(gazeVideo, (time, metadata) => inspect(time, metadata.mediaTime));
  };
  const startGaze = async () => {
    if (gazePreparing || gazeRunActive || returnInFlight) return;
    const generation = session.invalidate({ failure: null });
    stopFrames();
    gazePreparing = true;
    gazeRunActive = false;
    returnInFlight = false;
    returnAttempts = 0;
    heldDirections.clear();
    adapter.pause(gazeVideo);
    spec.onGazeActive(false);
    setBridge("idle");
    // Resume only after this gaze generation owns the base element. A play
    // completion from an earlier generation is intentionally side-effect free.
    resumeBaseVideo();
    try {
      if (!await waitForSeek(gazeVideo, spec.gazeMatchStartSeconds, generation)) {
        throw new Error("gaze-seek-unready");
      }
      if (!await waitForBaseMatch(generation)) throw new Error("base-match-unready");
      await adapter.play(gazeVideo);
      if (!valid(generation)) return;
      if (!await waitForPresentedFrame(gazeVideo, spec.gazeMatchStartSeconds, generation)) {
        throw new Error("gaze-frame-unready");
      }
      gazePreparing = false;
      gazeRunActive = true;
      spec.onGazeFailed(false);
      spec.onGazeActive(true);
      setBridge("idle");
      watchGazeReturn(generation);
      adapter.pause(baseVideo);
      session.transition({ presentation: "gaze", playback: "playing" });
      await waitForSeek(baseVideo, spec.baseMatchRestartSeconds, generation);
    } catch {
      if (!valid(generation)) return;
      gazePreparing = false;
      gazeRunActive = false;
      adapter.pause(gazeVideo);
      spec.onGazeFailed(true);
      spec.onGazeActive(false);
      setBridge("idle");
      session.transition({ presentation: "base", failure: "gaze-handoff-unready" });
      resumeBaseVideo();
      if (!pointerDriven) scheduleGaze(spec.repeatedGazeDelayMs ?? 7600);
    }
  };
  scheduleGaze = (delayMs = spec.initialGazeDelayMs ?? 4200) => {
    cancelGazeTimer?.();
    cancelGazeTimer = null;
    if (mascotDemand() !== "play" || (pointerDriven && gazeIntent === "neutral")) return;
    cancelGazeTimer = session.timeout(() => {
      cancelGazeTimer = null;
      if (gazeVideo.readyState < HAVE_CURRENT_DATA) {
        if (baseVideo.ended) resumeBaseVideo();
        if (gazeVideo.preload !== "auto") {
          gazeVideo.preload = "auto";
          adapter.load(gazeVideo);
        }
        scheduleGaze(1000);
        return;
      }
      void startGaze();
    }, delayMs);
  };
  const handleGazeTimeUpdate = () => {
    if (!heldDirection && gazeVideo.currentTime >= spec.gazeToBaseMatchSeconds) void finishGaze(session.generation);
  };
  const stopGaze = () => {
    cancelGazeTimer?.();
    cancelGazeTimer = null;
    cancelBaseRetry?.();
    cancelBaseRetry = null;
    stopFrames();
    session.invalidate({ playback: "paused", presentation: adapter.reducedMotion() ? "poster" : "base" });
    gazePreparing = false;
    gazeRunActive = false;
    returnInFlight = false;
    adapter.pause(gazeVideo);
    spec.onGazeActive(false);
    setBridge("idle");
    gazeIntent = "neutral";
    spec.visibleTarget.dataset.gazeIntent = gazeIntent;
    if (adapter.reducedMotion()) {
      try { adapter.seek(gazeVideo, 0); } catch { /* metadata may not be ready */ }
    }
  };
  const syncPlayback = () => {
    const demand = mascotDemand();
    const shouldPlay = demand === "play";
    session.transition({
      documentVisible: adapter.documentVisible(),
      reducedMotion: adapter.reducedMotion(),
      visibility: visible ? "inside" : "outside",
      demand,
    });
    if (shouldPlay) {
      // Repeated intersection/focus notifications must not restart the hidden
      // base clip or create a second handoff while the gaze clip owns playback.
      if (gazePreparing || gazeRunActive || returnInFlight) return;
      resumeBaseVideo();
      if (!pointerDriven && !cancelGazeTimer) scheduleGaze();
      return;
    }
    stopGaze();
    adapter.pause(baseVideo);
    if (adapter.reducedMotion()) {
      try { adapter.seek(baseVideo, 0); } catch { /* metadata may not be ready */ }
    }
  };

  session.own(adapter.listen(baseVideo, "canplay", resumeBaseVideo as EventListener));
  session.own(adapter.listen(baseVideo, "loadeddata", resumeBaseVideo as EventListener));
  session.own(adapter.listen(gazeVideo, "timeupdate", handleGazeTimeUpdate as EventListener));
  session.own(adapter.listen(gazeVideo, "ended", (() => void finishGaze(session.generation)) as EventListener));
  if (spec.gazeIntentTarget) {
    session.own(adapter.listen(spec.gazeIntentTarget, V7_MASCOT_GAZE_INTENT_EVENT, ((event: Event) => {
      const direction = (event as CustomEvent<{ direction?: unknown }>).detail?.direction;
      if (direction !== "left" && direction !== "right" && direction !== "neutral") return;
      if (gazeIntent === direction) return;
      gazeIntent = direction;
      intentRevision += 1;
      spec.visibleTarget.dataset.gazeIntent = direction;
      if (mascotDemand() !== "play") return;
      if (heldDirection && direction !== heldDirection) {
        void resumeHeldGaze(session.generation);
      } else if (!gazeRunActive && !returnInFlight) {
        if (direction === "neutral") {
          stopGaze();
          resumeBaseVideo();
        } else if (!gazePreparing) {
          scheduleGaze(0);
        }
      }
    }) as EventListener));
  }
  const initialRect = adapter.rect(spec.visibleTarget);
  const viewport = adapter.viewport();
  visible = initialRect.bottom > 0
    && initialRect.top < viewport.height
    && initialRect.right > 0
    && initialRect.left < viewport.width;
  session.own(adapter.observeIntersection(spec.visibleTarget, 0.02, (nextVisible) => {
    visible = nextVisible;
    syncPlayback();
  }));
  session.own(adapter.observeReducedMotion(syncPlayback));
  session.own(adapter.observeDocumentVisibility(syncPlayback));
  session.own(adapter.observePageShow(syncPlayback));
  session.own(adapter.observeWindowFocus(syncPlayback));
  session.own(() => {
    cancelGazeTimer?.();
    cancelBaseRetry?.();
    stopFrames();
    adapter.pause(baseVideo);
    adapter.pause(gazeVideo);
    baseVideo.loop = originalBaseLoop;
    delete spec.visibleTarget.dataset.handoffMode;
    delete spec.visibleTarget.dataset.gazeIntent;
    delete spec.visibleTarget.dataset.gazeHeld;
  });
  syncPlayback();
  return leaseForSession(session);
}

export function connectImplementedSurface(
  adapter: V7MediaAdapter,
  spec: V7ImplementedMediaSurfaceSpec,
) {
  switch (spec.kind) {
    case "headline": return connectHeadlineSurface(adapter, spec);
    case "phone": return connectPhoneSurface(adapter, spec);
    case "pro-atmosphere": return connectProAtmosphereSurface(adapter, spec);
    case "application-pro": return connectApplicationSurface(adapter, spec);
    case "footer-material": return connectFooterSurface(adapter, spec);
    case "mascot": return connectMascotSurface(adapter, spec);
    case "packed-alpha": return connectPackedAlphaSurface(adapter, spec);
  }
}
