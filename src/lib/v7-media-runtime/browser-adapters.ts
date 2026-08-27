import type {
  V7MediaAdapter,
  V7MediaFrameMetadata,
  V7MediaProfile,
  V7MediaRect,
} from "@/lib/v7-media-runtime/runtime";

export function isV7IOSWebKit(navigatorLike: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">) {
  return /iPad|iPhone|iPod/i.test(navigatorLike.userAgent)
    || (navigatorLike.platform === "MacIntel" && navigatorLike.maxTouchPoints > 1);
}

export function isV7DesktopSafari(navigatorLike: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">) {
  return /Safari/i.test(navigatorLike.userAgent)
    && !/Android|Chrome|Chromium|CriOS|Edg|FxiOS|OPiOS/i.test(navigatorLike.userAgent)
    && !isV7IOSWebKit(navigatorLike);
}

export function v7MediaProfile(navigatorLike: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">): V7MediaProfile {
  if (isV7IOSWebKit(navigatorLike)) return "ios-webkit";
  if (isV7DesktopSafari(navigatorLike)) return "desktop-safari";
  return "standard";
}

abstract class BaseBrowserV7MediaAdapter implements V7MediaAdapter {
  abstract readonly profile: V7MediaProfile;

  documentVisible() {
    return document.visibilityState === "visible";
  }

  reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  now() {
    return window.performance.now();
  }

  setTimeout(callback: () => void, delay: number) {
    return window.setTimeout(callback, delay);
  }

  clearTimeout(handle: number) {
    window.clearTimeout(handle);
  }

  requestAnimationFrame(callback: (time: number) => void) {
    return window.requestAnimationFrame(callback);
  }

  cancelAnimationFrame(handle: number) {
    window.cancelAnimationFrame(handle);
  }

  requestVideoFrame(
    video: HTMLVideoElement,
    callback: (time: number, metadata: V7MediaFrameMetadata) => void,
  ) {
    if (typeof video.requestVideoFrameCallback === "function") {
      return {
        id: video.requestVideoFrameCallback((time, metadata) => callback(time, { mediaTime: metadata.mediaTime })),
        kind: "video" as const,
      };
    }
    return {
      id: window.requestAnimationFrame((time) => callback(time, { mediaTime: video.currentTime })),
      kind: "animation" as const,
    };
  }

  cancelVideoFrame(video: HTMLVideoElement, request: { id: number; kind: "video" | "animation" }) {
    if (request.kind === "video" && typeof video.cancelVideoFrameCallback === "function") {
      video.cancelVideoFrameCallback(request.id);
      return;
    }
    window.cancelAnimationFrame(request.id);
  }

  play(video: HTMLVideoElement) {
    return video.play();
  }

  pause(video: HTMLVideoElement) {
    video.pause();
  }

  load(video: HTMLVideoElement) {
    video.load();
  }

  seek(video: HTMLVideoElement, time: number) {
    video.currentTime = time;
  }

  attachSource(video: HTMLVideoElement, preload: HTMLMediaElement["preload"] = "auto") {
    const source = video.dataset.videoSrc;
    video.preload = preload;
    if (!source || video.getAttribute("src") === source) return false;
    video.setAttribute("src", source);
    video.dataset.sourceState = "attached";
    video.load();
    return true;
  }

  releaseSource(video: HTMLVideoElement) {
    video.pause();
    video.preload = "none";
    if (!video.hasAttribute("src")) return;
    video.removeAttribute("src");
    video.dataset.sourceState = "detached";
    video.load();
  }

  listen(target: EventTarget, event: string, callback: EventListener) {
    target.addEventListener(event, callback);
    return () => target.removeEventListener(event, callback);
  }

  observeDocumentVisibility(callback: () => void) {
    document.addEventListener("visibilitychange", callback);
    return () => document.removeEventListener("visibilitychange", callback);
  }

  observeReducedMotion(callback: () => void) {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    preference.addEventListener("change", callback);
    return () => preference.removeEventListener("change", callback);
  }

  matchesMedia(query: string) {
    return window.matchMedia(query).matches;
  }

  observeMediaQuery(query: string, callback: () => void) {
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  }

  observeIntersection(target: Element, threshold: number, callback: (visible: boolean) => void) {
    const observer = new IntersectionObserver(([entry]) => callback(entry.isIntersecting), { threshold });
    observer.observe(target);
    return () => observer.disconnect();
  }

  observeMutations(target: Node, attributes: readonly string[], callback: () => void) {
    const observer = new MutationObserver(callback);
    observer.observe(target, {
      attributes: true,
      attributeFilter: [...attributes],
    });
    return () => observer.disconnect();
  }

  observeResize(target: Element, callback: () => void) {
    const observer = new ResizeObserver(callback);
    observer.observe(target);
    return () => observer.disconnect();
  }

  observePageShow(callback: () => void) {
    window.addEventListener("pageshow", callback);
    return () => window.removeEventListener("pageshow", callback);
  }

  observePageHide(callback: () => void) {
    window.addEventListener("pagehide", callback);
    return () => window.removeEventListener("pagehide", callback);
  }

  observeWindowFocus(callback: () => void) {
    window.addEventListener("focus", callback);
    return () => window.removeEventListener("focus", callback);
  }

  computedOpacity(target: Element) {
    return Number.parseFloat(window.getComputedStyle(target).opacity) || 0;
  }

  checkVisibility(target: Element) {
    if ("checkVisibility" in target && typeof target.checkVisibility === "function") {
      return target.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      });
    }
    const style = window.getComputedStyle(target);
    const bounds = target.getBoundingClientRect();
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number.parseFloat(style.opacity) > 0
      && bounds.width > 0
      && bounds.height > 0;
  }

  rect(target: Element): V7MediaRect {
    const rect = target.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }

  viewport() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
    };
  }
}

export class StandardBrowserV7MediaAdapter extends BaseBrowserV7MediaAdapter {
  readonly profile = "standard" as const;
}

export class SafariBrowserV7MediaAdapter extends BaseBrowserV7MediaAdapter {
  readonly profile: "desktop-safari" | "ios-webkit";

  constructor(profile: "desktop-safari" | "ios-webkit") {
    super();
    this.profile = profile;
  }
}

export function createBrowserV7MediaAdapter(): V7MediaAdapter {
  const profile = v7MediaProfile(window.navigator);
  return profile === "standard"
    ? new StandardBrowserV7MediaAdapter()
    : new SafariBrowserV7MediaAdapter(profile);
}
