import type {
  V7MediaAdapter,
  V7MediaFrameMetadata,
  V7MediaProfile,
  V7MediaRect,
} from "@/lib/v7-media-runtime/runtime";

type Scheduled = { at: number; callback: () => void };
type PlayOutcome = "resolve" | "reject" | "defer";
type DeferredPlay = {
  video: HTMLVideoElement;
  resolve: () => void;
  reject: () => void;
};

export class DeterministicV7MediaAdapter implements V7MediaAdapter {
  readonly operations: string[] = [];
  readonly profile: V7MediaProfile;
  #now = 0;
  #nextHandle = 1;
  #documentVisible = true;
  #reducedMotion = false;
  #timers = new Map<number, Scheduled>();
  #animationFrames = new Map<number, (time: number) => void>();
  #videoFrames = new Map<number, (time: number, metadata: V7MediaFrameMetadata) => void>();
  #playOutcomes: PlayOutcome[] = [];
  #deferredPlays: DeferredPlay[] = [];
  #playCounts = new WeakMap<HTMLVideoElement, number>();
  #pauseCounts = new WeakMap<HTMLVideoElement, number>();
  #documentVisibilityListeners = new Set<() => void>();
  #reducedMotionListeners = new Set<() => void>();
  #mediaQueries = new Map<string, boolean>();
  #mediaQueryListeners = new Map<string, Set<() => void>>();
  #pageShowListeners = new Set<() => void>();
  #pageHideListeners = new Set<() => void>();
  #focusListeners = new Set<() => void>();
  #intersectionListeners = new Map<Element, Set<(visible: boolean) => void>>();
  #mutationListeners = new Map<Node, Set<() => void>>();
  #resizeListeners = new Map<Element, Set<() => void>>();
  #eventListeners = new Map<EventTarget, Map<string, Set<EventListener>>>();
  #opacities = new Map<Element, number>();
  #visibility = new Map<Element, boolean>();
  #rects = new Map<Element, V7MediaRect>();
  #viewport = { width: 1440, height: 900, pixelRatio: 1 };

  constructor(profile: V7MediaProfile = "standard") {
    this.profile = profile;
  }

  get activeTimerCount() {
    return this.#timers.size;
  }

  get activeAnimationFrameCount() {
    return this.#animationFrames.size;
  }

  get activeVideoFrameCount() {
    return this.#videoFrames.size;
  }

  get activeObserverCount() {
    return this.#documentVisibilityListeners.size
      + this.#reducedMotionListeners.size
      + Array.from(this.#mediaQueryListeners.values()).reduce((sum, listeners) => sum + listeners.size, 0)
      + this.#pageShowListeners.size
      + this.#pageHideListeners.size
      + this.#focusListeners.size
      + Array.from(this.#intersectionListeners.values()).reduce((sum, listeners) => sum + listeners.size, 0)
      + Array.from(this.#mutationListeners.values()).reduce((sum, listeners) => sum + listeners.size, 0)
      + Array.from(this.#resizeListeners.values()).reduce((sum, listeners) => sum + listeners.size, 0);
  }

  get pendingPlayCount() {
    return this.#deferredPlays.length;
  }

  documentVisible() {
    return this.#documentVisible;
  }

  reducedMotion() {
    return this.#reducedMotion;
  }

  now() {
    return this.#now;
  }

  queuePlayOutcome(outcome: PlayOutcome) {
    this.#playOutcomes.push(outcome);
  }

  playCount(video: HTMLVideoElement) {
    return this.#playCounts.get(video) ?? 0;
  }

  pauseCount(video: HTMLVideoElement) {
    return this.#pauseCounts.get(video) ?? 0;
  }

  resolveNextDeferredPlay() {
    const pending = this.#deferredPlays.shift();
    if (!pending) throw new Error("No deferred media play to resolve");
    Object.defineProperty(pending.video, "paused", { configurable: true, writable: true, value: false });
    this.operations.push("media:play:resolve-deferred");
    pending.resolve();
  }

  rejectNextDeferredPlay() {
    const pending = this.#deferredPlays.shift();
    if (!pending) throw new Error("No deferred media play to reject");
    Object.defineProperty(pending.video, "paused", { configurable: true, writable: true, value: true });
    this.operations.push("media:play:reject-deferred");
    pending.reject();
  }

  setTimeout(callback: () => void, delay: number) {
    const handle = this.#nextHandle++;
    this.#timers.set(handle, { at: this.#now + delay, callback });
    this.operations.push(`timer:set:${delay}`);
    return handle;
  }

  clearTimeout(handle: number) {
    if (this.#timers.delete(handle)) this.operations.push("timer:clear");
  }

  advanceBy(milliseconds: number) {
    const target = this.#now + milliseconds;
    while (true) {
      const next = Array.from(this.#timers.entries())
        .filter(([, scheduled]) => scheduled.at <= target)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
      if (!next) break;
      const [handle, scheduled] = next;
      this.#timers.delete(handle);
      this.#now = scheduled.at;
      scheduled.callback();
    }
    this.#now = target;
  }

  requestAnimationFrame(callback: (time: number) => void) {
    const handle = this.#nextHandle++;
    this.#animationFrames.set(handle, callback);
    this.operations.push("raf:set");
    return handle;
  }

  cancelAnimationFrame(handle: number) {
    if (this.#animationFrames.delete(handle)) this.operations.push("raf:cancel");
  }

  flushAnimationFrames() {
    const frames = Array.from(this.#animationFrames.entries());
    this.#animationFrames.clear();
    this.#now += 1000 / 60;
    frames.forEach(([, callback]) => callback(this.#now));
  }

  requestVideoFrame(
    video: HTMLVideoElement,
    callback: (time: number, metadata: V7MediaFrameMetadata) => void,
  ) {
    void video;
    const handle = this.#nextHandle++;
    this.#videoFrames.set(handle, callback);
    this.operations.push("video-frame:set");
    return { id: handle, kind: "video" as const };
  }

  cancelVideoFrame(video: HTMLVideoElement, request: { id: number; kind: "video" | "animation" }) {
    void video;
    if (this.#videoFrames.delete(request.id)) this.operations.push("video-frame:cancel");
    if (request.kind === "animation") this.cancelAnimationFrame(request.id);
  }

  flushVideoFrames(mediaTime: number) {
    const frames = Array.from(this.#videoFrames.entries());
    this.#videoFrames.clear();
    this.#now += 1000 / 60;
    frames.forEach(([, callback]) => callback(this.#now, { mediaTime }));
  }

  play(video: HTMLVideoElement) {
    this.operations.push("media:play");
    this.#playCounts.set(video, this.playCount(video) + 1);
    const outcome = this.#playOutcomes.shift() ?? "resolve";
    if (outcome === "defer") {
      return new Promise<void>((resolve, reject) => {
        this.#deferredPlays.push({
          video,
          resolve,
          reject: () => reject(new Error("deterministic-play-rejection")),
        });
      });
    }
    if (outcome === "reject") {
      Object.defineProperty(video, "paused", { configurable: true, writable: true, value: true });
      return Promise.reject(new Error("deterministic-play-rejection"));
    }
    Object.defineProperty(video, "paused", { configurable: true, writable: true, value: false });
    return Promise.resolve();
  }

  pause(video: HTMLVideoElement) {
    this.operations.push("media:pause");
    this.#pauseCounts.set(video, this.pauseCount(video) + 1);
    Object.defineProperty(video, "paused", { configurable: true, writable: true, value: true });
  }

  load(video: HTMLVideoElement) {
    void video;
    this.operations.push("media:load");
  }

  seek(video: HTMLVideoElement, time: number) {
    this.operations.push(`media:seek:${time}`);
    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: time });
  }

  attachSource(video: HTMLVideoElement, preload: HTMLMediaElement["preload"] = "auto") {
    this.operations.push(`source:attach:${preload}`);
    const dataset = (video as HTMLVideoElement & { dataset: DOMStringMap }).dataset;
    dataset.sourceState = "attached";
    return true;
  }

  releaseSource(video: HTMLVideoElement) {
    this.operations.push("source:release");
    const dataset = (video as HTMLVideoElement & { dataset: DOMStringMap }).dataset;
    dataset.sourceState = "detached";
  }

  listen(target: EventTarget, event: string, callback: EventListener) {
    let events = this.#eventListeners.get(target);
    if (!events) {
      events = new Map();
      this.#eventListeners.set(target, events);
    }
    let listeners = events.get(event);
    if (!listeners) {
      listeners = new Set();
      events.set(event, listeners);
    }
    listeners.add(callback);
    return () => {
      listeners?.delete(callback);
      if (listeners?.size === 0) events?.delete(event);
      if (events?.size === 0) this.#eventListeners.delete(target);
    };
  }

  emit(target: EventTarget, event: string) {
    this.#eventListeners.get(target)?.get(event)?.forEach((listener) => listener(new Event(event)));
  }

  observeDocumentVisibility(callback: () => void) {
    this.#documentVisibilityListeners.add(callback);
    return () => this.#documentVisibilityListeners.delete(callback);
  }

  setDocumentVisible(visible: boolean) {
    this.#documentVisible = visible;
    this.#documentVisibilityListeners.forEach((listener) => listener());
  }

  observeReducedMotion(callback: () => void) {
    this.#reducedMotionListeners.add(callback);
    return () => this.#reducedMotionListeners.delete(callback);
  }

  setReducedMotion(reduced: boolean) {
    this.#reducedMotion = reduced;
    this.#reducedMotionListeners.forEach((listener) => listener());
  }

  matchesMedia(query: string) {
    if (query === "(prefers-reduced-motion: reduce)") return this.#reducedMotion;
    return this.#mediaQueries.get(query) ?? false;
  }

  observeMediaQuery(query: string, callback: () => void) {
    const listeners = this.#mediaQueryListeners.get(query) ?? new Set();
    listeners.add(callback);
    this.#mediaQueryListeners.set(query, listeners);
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) this.#mediaQueryListeners.delete(query);
    };
  }

  setMediaQuery(query: string, matches: boolean) {
    this.#mediaQueries.set(query, matches);
    this.#mediaQueryListeners.get(query)?.forEach((listener) => listener());
  }

  observeIntersection(target: Element, _threshold: number, callback: (visible: boolean) => void) {
    const listeners = this.#intersectionListeners.get(target) ?? new Set();
    listeners.add(callback);
    this.#intersectionListeners.set(target, listeners);
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) this.#intersectionListeners.delete(target);
    };
  }

  setIntersection(target: Element, visible: boolean) {
    this.#intersectionListeners.get(target)?.forEach((listener) => listener(visible));
  }

  observeMutations(target: Node, _attributes: readonly string[], callback: () => void) {
    const listeners = this.#mutationListeners.get(target) ?? new Set();
    listeners.add(callback);
    this.#mutationListeners.set(target, listeners);
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) this.#mutationListeners.delete(target);
    };
  }

  mutate(target: Node) {
    this.#mutationListeners.get(target)?.forEach((listener) => listener());
  }

  observeResize(target: Element, callback: () => void) {
    const listeners = this.#resizeListeners.get(target) ?? new Set();
    listeners.add(callback);
    this.#resizeListeners.set(target, listeners);
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) this.#resizeListeners.delete(target);
    };
  }

  resize(target: Element) {
    this.#resizeListeners.get(target)?.forEach((listener) => listener());
  }

  observePageShow(callback: () => void) {
    this.#pageShowListeners.add(callback);
    return () => this.#pageShowListeners.delete(callback);
  }

  pageShow() {
    this.#pageShowListeners.forEach((listener) => listener());
  }

  observePageHide(callback: () => void) {
    this.#pageHideListeners.add(callback);
    return () => this.#pageHideListeners.delete(callback);
  }

  pageHide() {
    this.#pageHideListeners.forEach((listener) => listener());
  }

  observeWindowFocus(callback: () => void) {
    this.#focusListeners.add(callback);
    return () => this.#focusListeners.delete(callback);
  }

  focus() {
    this.#focusListeners.forEach((listener) => listener());
  }

  computedOpacity(target: Element) {
    return this.#opacities.get(target) ?? 0;
  }

  setComputedOpacity(target: Element, opacity: number) {
    this.#opacities.set(target, opacity);
  }

  checkVisibility(target: Element) {
    return this.#visibility.get(target) ?? true;
  }

  setCheckVisibility(target: Element, visible: boolean) {
    this.#visibility.set(target, visible);
  }

  rect(target: Element) {
    return this.#rects.get(target) ?? {
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
      width: 100,
      height: 100,
    };
  }

  setRect(target: Element, rect: V7MediaRect) {
    this.#rects.set(target, rect);
  }

  viewport() {
    return this.#viewport;
  }

  setViewport(width: number, height: number, pixelRatio = 1) {
    this.#viewport = { width, height, pixelRatio };
  }
}

export function createDeterministicMediaElement() {
  return {
    currentTime: 0,
    duration: 30,
    readyState: 0,
    videoWidth: 1920,
    videoHeight: 1080,
    paused: true,
    ended: false,
    preload: "none",
    dataset: {},
  } as unknown as HTMLVideoElement;
}
