export type V7MediaRole =
  | "headline"
  | "phone"
  | "pro-atmosphere"
  | "mascot"
  | "application-pro"
  | "footer-material"
  | "packed-alpha";

export type V7MediaProfile = "standard" | "desktop-safari" | "ios-webkit";
export type V7MediaDemand = "cold" | "warm" | "play";
export type V7MediaVisibility = "unknown" | "inside" | "outside" | "css-hidden";
export type V7MediaSourceState = "detached" | "attaching" | "attached" | "releasing";
export type V7MediaDecodeState = "empty" | "loading" | "can-play" | "frame-ready" | "failed";
export type V7MediaPlaybackState = "idle" | "play-pending" | "playing" | "paused" | "retry-wait";
export type V7MediaPresentationState =
  | "fallback"
  | "video"
  | "poster"
  | "base"
  | "to-gaze"
  | "gaze"
  | "to-base"
  | "material";

export type V7MediaState = Readonly<{
  role: V7MediaRole;
  generation: number;
  connected: boolean;
  documentVisible: boolean;
  reducedMotion: boolean;
  demand: V7MediaDemand;
  visibility: V7MediaVisibility;
  source: V7MediaSourceState;
  decode: V7MediaDecodeState;
  playback: V7MediaPlaybackState;
  presentation: V7MediaPresentationState;
  failure: string | null;
}>;

export type V7MediaFrameMetadata = Readonly<{ mediaTime: number }>;
export type V7MediaRect = Readonly<{
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}>;

export interface V7MediaAdapter {
  readonly profile: V7MediaProfile;
  documentVisible(): boolean;
  reducedMotion(): boolean;
  now(): number;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
  requestAnimationFrame(callback: (time: number) => void): number;
  cancelAnimationFrame(handle: number): void;
  requestVideoFrame(
    video: HTMLVideoElement,
    callback: (time: number, metadata: V7MediaFrameMetadata) => void,
  ): { id: number; kind: "video" | "animation" };
  cancelVideoFrame(video: HTMLVideoElement, request: { id: number; kind: "video" | "animation" }): void;
  play(video: HTMLVideoElement): Promise<void>;
  pause(video: HTMLVideoElement): void;
  load(video: HTMLVideoElement): void;
  seek(video: HTMLVideoElement, time: number): void;
  attachSource(video: HTMLVideoElement, preload?: HTMLMediaElement["preload"]): boolean;
  releaseSource(video: HTMLVideoElement): void;
  listen(target: EventTarget, event: string, callback: EventListener): () => void;
  observeDocumentVisibility(callback: () => void): () => void;
  observeReducedMotion(callback: () => void): () => void;
  matchesMedia(query: string): boolean;
  observeMediaQuery(query: string, callback: () => void): () => void;
  observeIntersection(target: Element, threshold: number, callback: (visible: boolean) => void): () => void;
  observeMutations(target: Node, attributes: readonly string[], callback: () => void): () => void;
  observeResize(target: Element, callback: () => void): () => void;
  observePageShow(callback: () => void): () => void;
  observePageHide(callback: () => void): () => void;
  observeWindowFocus(callback: () => void): () => void;
  computedOpacity(target: Element): number;
  checkVisibility(target: Element): boolean;
  rect(target: Element): V7MediaRect;
  viewport(): Readonly<{ width: number; height: number; pixelRatio: number }>;
}

export type V7MediaPolicy = Readonly<{
  role: V7MediaRole;
  retryDelayMs: number | null;
  releaseDelayMs: number | null;
  releaseOnDispose: boolean;
  failurePresentation: V7MediaPresentationState;
}>;

export const V7_MEDIA_POLICIES: Readonly<Record<V7MediaRole, V7MediaPolicy>> = {
  headline: {
    role: "headline",
    retryDelayMs: null,
    releaseDelayMs: null,
    releaseOnDispose: true,
    failurePresentation: "fallback",
  },
  phone: {
    role: "phone",
    retryDelayMs: null,
    releaseDelayMs: 1400,
    releaseOnDispose: true,
    failurePresentation: "fallback",
  },
  "pro-atmosphere": {
    role: "pro-atmosphere",
    retryDelayMs: null,
    releaseDelayMs: 1600,
    releaseOnDispose: true,
    failurePresentation: "fallback",
  },
  mascot: {
    role: "mascot",
    retryDelayMs: 1200,
    releaseDelayMs: null,
    releaseOnDispose: false,
    failurePresentation: "poster",
  },
  "application-pro": {
    role: "application-pro",
    retryDelayMs: null,
    releaseDelayMs: null,
    releaseOnDispose: false,
    failurePresentation: "fallback",
  },
  "footer-material": {
    role: "footer-material",
    retryDelayMs: null,
    releaseDelayMs: null,
    releaseOnDispose: true,
    failurePresentation: "fallback",
  },
  "packed-alpha": {
    role: "packed-alpha",
    retryDelayMs: null,
    releaseDelayMs: null,
    releaseOnDispose: false,
    failurePresentation: "poster",
  },
};

export const V7_MEDIA_RUNTIME_SURFACES = {
  headline: true,
  phone: true,
  proAtmosphere: true,
  applicationPro: true,
  footerMaterial: true,
  // Enabled locally for the authorized Candidate 01 verification pass.
  // Each value remains a compile-time rollback switch to the preserved legacy path.
  mascot: true,
  packedAlpha: true,
} as const;

type StatePatch = Partial<Omit<V7MediaState, "role" | "generation">>;
type StateSink = (state: V7MediaState) => void;

const initialState = (role: V7MediaRole, adapter: V7MediaAdapter): V7MediaState => ({
  role,
  generation: 1,
  connected: true,
  documentVisible: adapter.documentVisible(),
  reducedMotion: adapter.reducedMotion(),
  demand: "cold",
  visibility: "unknown",
  source: "detached",
  decode: "empty",
  playback: "idle",
  presentation: role === "mascot" || role === "packed-alpha" ? "poster" : "fallback",
  failure: null,
});

export class V7MediaSurfaceSession {
  readonly adapter: V7MediaAdapter;
  readonly policy: V7MediaPolicy;
  #state: V7MediaState;
  #sink: StateSink;
  #resources = new Set<() => void>();
  #generationResources = new Set<() => void>();
  #disposed = false;

  constructor(adapter: V7MediaAdapter, role: V7MediaRole, sink: StateSink = () => undefined) {
    this.adapter = adapter;
    this.policy = V7_MEDIA_POLICIES[role];
    this.#state = initialState(role, adapter);
    this.#sink = sink;
    sink(this.#state);
  }

  get state() {
    return this.#state;
  }

  get generation() {
    return this.#state.generation;
  }

  get disposed() {
    return this.#disposed;
  }

  isCurrent(generation: number) {
    return !this.#disposed && generation === this.#state.generation;
  }

  transition(patch: StatePatch) {
    if (this.#disposed) return;
    const next = { ...this.#state, ...patch };
    const changed = Object.entries(next).some(([key, value]) => (
      value !== this.#state[key as keyof V7MediaState]
    ));
    if (!changed) return;
    this.#state = next;
    this.#sink(next);
  }

  invalidate(patch: StatePatch = {}) {
    if (this.#disposed) return this.#state.generation;
    this.#state = {
      ...this.#state,
      ...patch,
      generation: this.#state.generation + 1,
    };
    Array.from(this.#generationResources).reverse().forEach((dispose) => dispose());
    this.#generationResources.clear();
    this.#sink(this.#state);
    return this.#state.generation;
  }

  own(cancel: () => void) {
    if (this.#disposed) {
      cancel();
      return () => undefined;
    }
    let active = true;
    const dispose = () => {
      if (!active) return;
      active = false;
      this.#resources.delete(dispose);
      cancel();
    };
    this.#resources.add(dispose);
    return dispose;
  }

  ownGeneration(cancel: () => void) {
    if (this.#disposed) {
      cancel();
      return () => undefined;
    }
    let active = true;
    const dispose = () => {
      if (!active) return;
      active = false;
      this.#generationResources.delete(dispose);
      cancel();
    };
    this.#generationResources.add(dispose);
    return dispose;
  }

  timeout(callback: (generation: number) => void, delay: number) {
    const generation = this.generation;
    let release: () => void = () => undefined;
    const handle = this.adapter.setTimeout(() => {
      release();
      if (this.isCurrent(generation)) callback(generation);
    }, delay);
    release = this.ownGeneration(() => this.adapter.clearTimeout(handle));
    return release;
  }

  animationFrame(callback: (time: number, generation: number) => void) {
    const generation = this.generation;
    let release: () => void = () => undefined;
    const handle = this.adapter.requestAnimationFrame((time) => {
      release();
      if (this.isCurrent(generation)) callback(time, generation);
    });
    release = this.ownGeneration(() => this.adapter.cancelAnimationFrame(handle));
    return release;
  }

  mediaFrame(
    video: HTMLVideoElement,
    callback: (time: number, metadata: V7MediaFrameMetadata, generation: number) => void,
  ) {
    const generation = this.generation;
    let release: () => void = () => undefined;
    const request = this.adapter.requestVideoFrame(video, (time, metadata) => {
      release();
      if (this.isCurrent(generation)) callback(time, metadata, generation);
    });
    release = this.ownGeneration(() => this.adapter.cancelVideoFrame(video, request));
    return release;
  }

  attach(video: HTMLVideoElement, preload: HTMLMediaElement["preload"] = "auto") {
    this.transition({ source: "attaching", decode: "loading", failure: null });
    this.adapter.attachSource(video, preload);
    this.transition({ source: "attached" });
  }

  release(video: HTMLVideoElement) {
    this.transition({ source: "releasing", playback: "paused" });
    this.adapter.releaseSource(video);
    this.transition({ source: "detached", decode: "empty", presentation: this.policy.failurePresentation });
  }

  pause(video: HTMLVideoElement, presentation?: V7MediaPresentationState) {
    this.adapter.pause(video);
    this.transition({
      playback: "paused",
      ...(presentation ? { presentation } : {}),
    });
  }

  async attemptPlay(
    video: HTMLVideoElement,
    options: Readonly<{
      retryDelayMs?: number | null;
      shouldRetry?: () => boolean;
      onPlaying?: () => void;
      onRejected?: () => void;
    }> = {},
  ) {
    if (this.#disposed) return false;
    const generation = this.generation;
    this.transition({ playback: "play-pending", failure: null });
    try {
      await this.adapter.play(video);
      // A newer generation owns this element now. The stale completion may
      // retire its own bookkeeping, but it must not mutate shared media.
      if (!this.isCurrent(generation)) return false;
      this.transition({ playback: "playing" });
      options.onPlaying?.();
      return true;
    } catch {
      if (!this.isCurrent(generation)) return false;
      const retryDelay = options.retryDelayMs ?? this.policy.retryDelayMs;
      this.transition({
        playback: retryDelay === null ? "paused" : "retry-wait",
        presentation: this.policy.failurePresentation,
        failure: "play-rejected",
      });
      options.onRejected?.();
      if (retryDelay !== null && (options.shouldRetry?.() ?? true)) {
        this.timeout(() => {
          if (options.shouldRetry?.() ?? true) void this.attemptPlay(video, options);
        }, retryDelay);
      }
      return false;
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#state = {
      ...this.#state,
      connected: false,
      generation: this.#state.generation + 1,
      playback: "paused",
    };
    Array.from(this.#generationResources).reverse().forEach((dispose) => dispose());
    this.#generationResources.clear();
    Array.from(this.#resources).reverse().forEach((dispose) => dispose());
    this.#resources.clear();
    this.#sink(this.#state);
  }
}

export type V7MediaLease = Readonly<{
  role: V7MediaRole;
  state: () => V7MediaState;
  invalidate: () => number;
  dispose: () => void;
}>;

export const leaseForSession = (session: V7MediaSurfaceSession): V7MediaLease => ({
  role: session.state.role,
  state: () => session.state,
  invalidate: () => session.invalidate(),
  dispose: () => session.dispose(),
});
