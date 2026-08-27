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
  gazeMatchStartSeconds: number;
  gazeToBaseMatchSeconds: number;
  baseMatchRestartSeconds: number;
  toGazeCrossfadeMs: number;
  toBaseCrossfadeMs: number;
  initialGazeDelayMs?: number;
  repeatedGazeDelayMs?: number;
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
    spec.videos.forEach((video) => {
      if (preserveStandardPreroll && video === spec.videos[1]) return;
      resetVideo(video);
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
  const HAVE_CURRENT_DATA = 2;
  let visible = false;
  let cancelGazeTimer: (() => void) | null = null;
  let cancelBaseRetry: (() => void) | null = null;
  let cancelBaseFrame: (() => void) | null = null;
  let cancelGazeFrame: (() => void) | null = null;
  let baseLoadRequested = baseVideo.readyState !== 0;
  let gazeRunActive = false;
  let returnInFlight = false;

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
  };
  const delay = (milliseconds: number, generation: number) => new Promise<boolean>((resolve) => {
    let settled = false;
    let cancel: () => void = () => undefined;
    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      cancel();
      resolve(completed && valid(generation));
    };
    cancel = session.timeout(() => finish(true), milliseconds);
    session.ownGeneration(() => finish(false));
  });
  const waitForSeek = (video: HTMLVideoElement, time: number, generation: number) => new Promise<boolean>((resolve) => {
    if (Math.abs(video.currentTime - time) <= 0.04) {
      resolve(valid(generation));
      return;
    }
    let settled = false;
    let cancelTimeout: () => void = () => undefined;
    let cancelListener: () => void = () => undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      cancelTimeout();
      cancelListener();
      resolve(valid(generation));
    };
    cancelTimeout = session.timeout(finish, 600);
    cancelListener = session.ownGeneration(adapter.listen(video, "seeked", finish as EventListener));
    session.ownGeneration(() => {
      if (settled) return;
      settled = true;
      cancelTimeout();
      cancelListener();
      resolve(false);
    });
    try { adapter.seek(video, time); } catch { finish(); }
  });
  const resumeBaseVideo = () => {
    if (mascotDemand() !== "play") return;
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
    const inspect = (now: number, mediaTime: number) => {
      cancelBaseFrame = null;
      if (!valid(generation)) {
        resolve(false);
        return;
      }
      const duration = baseVideo.duration;
      const currentTime = Number.isFinite(mediaTime) ? mediaTime : baseVideo.currentTime;
      const nearMatch = Number.isFinite(duration)
        && duration > 0
        && currentTime >= spec.baseToGazeMatchSeconds
        && currentTime <= Math.min(duration, spec.baseToGazeMatchSeconds + 0.28);
      const waitLimit = Number.isFinite(duration) && duration > 0
        ? Math.max(10000, duration * 1500)
        : 10000;
      if (nearMatch) {
        resolve(true);
        return;
      }
      if (now - startedAt >= waitLimit) {
        resolve(false);
        return;
      }
      cancelBaseFrame = session.mediaFrame(baseVideo, (time, metadata) => inspect(time, metadata.mediaTime));
    };
    cancelBaseFrame = session.mediaFrame(baseVideo, (time, metadata) => inspect(time, metadata.mediaTime));
  });

  let scheduleGaze: (delayMs?: number) => void = () => undefined;
  const finishGaze = async (generation: number) => {
    if (!gazeRunActive || returnInFlight || !valid(generation)) return;
    gazeRunActive = false;
    returnInFlight = true;
    cancelGazeFrame?.();
    cancelGazeFrame = null;
    if (Math.abs(baseVideo.currentTime - spec.baseMatchRestartSeconds) > 0.06) {
      await waitForSeek(baseVideo, spec.baseMatchRestartSeconds, generation);
    }
    if (!valid(generation)) {
      returnInFlight = false;
      return;
    }
    try {
      await adapter.play(baseVideo);
    } catch {
      if (valid(generation)) {
        spec.onBaseFailed(true);
        session.transition({ decode: "failed", presentation: "poster", failure: "base-return-play-rejected" });
      }
      returnInFlight = false;
      return;
    }
    if (!valid(generation)) {
      returnInFlight = false;
      return;
    }
    setBridge("to-base");
    if (!await delay(spec.toBaseCrossfadeMs, generation)) {
      returnInFlight = false;
      return;
    }
    spec.onGazeActive(false);
    setBridge("idle");
    adapter.pause(gazeVideo);
    returnInFlight = false;
    session.transition({ playback: "playing", presentation: "base" });
    scheduleGaze(spec.repeatedGazeDelayMs ?? 7600);
  };
  const watchGazeReturn = (generation: number) => {
    cancelGazeFrame?.();
    cancelGazeFrame = null;
    const inspect = (_time: number, mediaTime: number) => {
      cancelGazeFrame = null;
      if (!valid(generation) || returnInFlight) return;
      if (mediaTime >= spec.gazeToBaseMatchSeconds) {
        void finishGaze(generation);
        return;
      }
      cancelGazeFrame = session.mediaFrame(gazeVideo, (time, metadata) => inspect(time, metadata.mediaTime));
    };
    cancelGazeFrame = session.mediaFrame(gazeVideo, (time, metadata) => inspect(time, metadata.mediaTime));
  };
  const startGaze = async () => {
    const generation = session.invalidate({ failure: null });
    stopFrames();
    gazeRunActive = false;
    returnInFlight = false;
    adapter.pause(gazeVideo);
    spec.onGazeActive(false);
    setBridge("idle");
    // Resume only after this gaze generation owns the base element. A play
    // completion from an earlier generation is intentionally side-effect free.
    resumeBaseVideo();
    if (!await waitForSeek(gazeVideo, spec.gazeMatchStartSeconds, generation) || !valid(generation)) return;
    if (!await waitForBaseMatch(generation) || !valid(generation)) return;
    try {
      await adapter.play(gazeVideo);
      if (!valid(generation)) return;
      gazeRunActive = true;
      spec.onGazeFailed(false);
      spec.onGazeActive(true);
      setBridge("to-gaze");
      watchGazeReturn(generation);
      if (!await delay(spec.toGazeCrossfadeMs, generation)) return;
      setBridge("idle");
      adapter.pause(baseVideo);
      session.transition({ presentation: "gaze", playback: "playing" });
      await waitForSeek(baseVideo, spec.baseMatchRestartSeconds, generation);
    } catch {
      if (!valid(generation)) return;
      gazeRunActive = false;
      spec.onGazeFailed(true);
      spec.onGazeActive(false);
      setBridge("idle");
      session.transition({ decode: "failed", presentation: "poster", failure: "gaze-play-rejected" });
      resumeBaseVideo();
    }
  };
  scheduleGaze = (delayMs = spec.initialGazeDelayMs ?? 4200) => {
    cancelGazeTimer?.();
    cancelGazeTimer = null;
    if (mascotDemand() !== "play") return;
    cancelGazeTimer = session.timeout(() => {
      cancelGazeTimer = null;
      if (gazeVideo.readyState < HAVE_CURRENT_DATA) {
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
    if (gazeVideo.currentTime >= spec.gazeToBaseMatchSeconds) void finishGaze(session.generation);
  };
  const stopGaze = () => {
    cancelGazeTimer?.();
    cancelGazeTimer = null;
    cancelBaseRetry?.();
    cancelBaseRetry = null;
    stopFrames();
    session.invalidate({ playback: "paused", presentation: adapter.reducedMotion() ? "poster" : "base" });
    gazeRunActive = false;
    returnInFlight = false;
    adapter.pause(gazeVideo);
    spec.onGazeActive(false);
    setBridge("idle");
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
      resumeBaseVideo();
      scheduleGaze();
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
