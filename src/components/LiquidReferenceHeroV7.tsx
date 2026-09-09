"use client";

import Image from "@/components/StaticImage";
import { AstraExperience } from "@/components/astra/AstraExperience";
import { DeviceTiltControl } from "@/components/astra/DeviceTiltControl";
import { OpeningDepthLayers } from "@/components/astra/OpeningDepthLayers";
import lowerStyles from "@/components/astra/astra-lower.module.css";
import { prepareLiquidScene } from "@/lib/liquid-readiness";
import { LiquidModel } from "@/components/astra/LiquidModel";
import { PawTrail } from "@/components/astra/PawTrail";
import {
  createContext,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { tariffs, type TariffId, type TariffName } from "@/data/tariffs";
import {
  applicationLimits,
  contactMethodOptions,
  englishLevelOptions,
  packagesByTariff,
  type PublicApplicationFailure,
  type PublicApplicationPayload,
  type PublicApplicationSuccess,
} from "@/lib/application-contract";
import { CURRENT_PUBLIC_CLAIMS } from "@/lib/offer-domain/catalog/current-public-claims";
import { v7AvailabilityLabel } from "@/lib/offer-domain/adapters/v7-presentation";
import { resolveOfferDomainConsumer } from "@/lib/offer-domain/rollout";
import { createFooterMaterialRenderer } from "@/lib/v7-media-runtime/footer-material-renderer";
import { createV7MediaRuntime, V7_MASCOT_POSE_SPLICE, type V7MediaRuntime } from "@/lib/v7-media-runtime";
import { V7_MEDIA_RUNTIME_SURFACES } from "@/lib/v7-media-runtime/runtime";
import {
  V7_GSAP_SECTION_CUE_PLANS,
  V7_REFERENCE_FULL_METADATA_END,
  V7_REFERENCE_PINNED_END,
  V7_SEQUENCE_CONTRACT_ROLLOUT,
  animatedControlAvailability,
  createV7SequenceInput,
  materialClipPair as contractMaterialClipPair,
  phaseAtReferenceTime as contractPhaseAtReferenceTime,
  phoneIdentityAtReferenceTime as contractPhoneIdentityAtReferenceTime,
  referenceTimeAtScrollProgress as contractReferenceTimeAtScrollProgress,
  resolveV7MediaIntentSnapshot,
  resolveV7SequenceOrThrow,
  scrollProgressAtReferenceTime as contractScrollProgressAtReferenceTime,
  selectV7GsapCueAt,
  type V7SequenceState,
  type V7Tier,
} from "@/lib/v7-sequence-contract";
import styles from "@/styles/liquid-reference-v7.module.css";

const PHONE_SEQUENCE_DELAY = 0.85;
const shiftedPhoneTime = (referenceTime: number) => referenceTime + PHONE_SEQUENCE_DELAY;
const STANDARD_PHONE_PREROLL_WINDOWS = [
  { start: shiftedPhoneTime(13.27), end: shiftedPhoneTime(14.4) },
  { start: 25.05, end: 28.25 },
] as const;
const REFERENCE_FIRST_SEQUENCE_END = shiftedPhoneTime(20.75);
const REFERENCE_PINNED_END = 33.5;
const REFERENCE_FULL_END = 39.49;
const PRO_ATMOSPHERE_PRELOAD_START = 25.55;
const PRO_ATMOSPHERE_VISIBLE_START = 27.75;
const PRO_ATMOSPHERE_END = 32.25;
const PRO_PROOF_WALL_ACTIVE_START = 30.5;
const PRO_PROOF_WALL_ACTIVE_END = 32.49;
const METAMASK_SCROLL_DURATION_SECONDS = 1;
const SITE_REVEAL_BUDGET_MS = 3200;
const PRO_MATERIAL_LOOP_LEAD_SECONDS = 0.055;
const PRO_MATERIAL_LOOP_RESTART_SECONDS = 0.18;
const MASCOT_BASE_TO_GAZE_MATCH_SECONDS = 25.125;
const MASCOT_GAZE_MATCH_START_SECONDS = 1.251;
const MASCOT_GAZE_TO_BASE_MATCH_SECONDS = 10.75;
const MASCOT_BASE_MATCH_RESTART_SECONDS = 2.626;
const MASCOT_TO_GAZE_CROSSFADE_MS = 720;
const MASCOT_TO_BASE_CROSSFADE_MS = 860;
const V7_SEQUENCE_NAVIGATION_EVENT = "liquid-v7:navigate-to-reference";
const V7_BOOKING_NAVIGATION_EVENT = "liquid-v7:navigate-to-booking";
const V7SmoothScrollLockContext = createContext<(locked: boolean) => void>(() => undefined);
const FOOTER_BRAND_TEXT = "ХЕЛЛ ОУ...";
const V7_HEADLINE_MASK_ID = "liquid-v7-headline-mask";
const V7_SAY_MASK_ID = "liquid-v7-say-clip";
const V7_MASCOT_EDGE_FILTER_ID = "liquid-v7-mascot-edge-filter";
const V7_APPLICATION_ID_PREFIX = "liquid-v7-application";
const V7_FAQ_ID_PREFIX = "liquid-v7-faq";
const APPLICATION_API_BASE = (import.meta.env.VITE_APPLICATION_API_BASE
  ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "")).replace(/\/$/, "");
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

function applicationApiUrl(path: string) {
  return `${APPLICATION_API_BASE}${path}`;
}

function TurnstileWidget({
  onError,
  onReady,
  onToken,
}: {
  onError: (message: string) => void;
  onReady: () => void;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onError, onReady, onToken });

  useEffect(() => {
    callbacksRef.current = { onError, onReady, onToken };
  }, [onError, onReady, onToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      callbacksRef.current.onError("Защитная проверка пока не настроена.");
      return;
    }
    let widgetId: TurnstileWidgetId | null = null;
    let attempts = 0;
    const mount = () => {
      attempts += 1;
      if (containerRef.current && window.turnstile) {
        widgetId = window.turnstile.render(containerRef.current, {
          action: "lesson_application",
          callback: (token) => callbacksRef.current.onToken(token),
          "error-callback": () => callbacksRef.current.onError("Защитная проверка не загрузилась. Попробуйте ещё раз."),
          "expired-callback": () => callbacksRef.current.onError("Срок защитной проверки истёк. Пройдите её ещё раз."),
          sitekey: TURNSTILE_SITE_KEY,
          theme: "light",
        });
        callbacksRef.current.onReady();
        window.clearInterval(timer);
        return;
      }
      if (attempts >= 200) {
        window.clearInterval(timer);
        callbacksRef.current.onError("Защитная проверка временно недоступна.");
      }
    };
    const timer = window.setInterval(mount, 50);
    mount();
    return () => {
      window.clearInterval(timer);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  return <div ref={containerRef} />;
}

function shouldUseIOSPerformanceMode() {
  const userAgent = window.navigator.userAgent;
  return /iPad|iPhone|iPod/i.test(userAgent)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function shouldUseSafariPackedAlpha() {
  const userAgent = window.navigator.userAgent;
  const isIOSWebKit = shouldUseIOSPerformanceMode();
  const isDesktopSafari = /Safari/i.test(userAgent)
    && !/Android|Chrome|Chromium|CriOS|Edg|FxiOS|OPiOS/i.test(userAgent);

  return isIOSWebKit || isDesktopSafari;
}

function ensureDeferredVideoSource(
  video: HTMLVideoElement,
  preload: HTMLMediaElement["preload"] = "auto",
) {
  const source = video.dataset.videoSrc;
  if (!source) return false;
  video.preload = preload;
  if (video.getAttribute("src") === source) return false;
  video.setAttribute("src", source);
  video.dataset.sourceState = "attached";
  video.load();
  return true;
}

function releaseDeferredVideoSource(video: HTMLVideoElement) {
  video.pause();
  video.preload = "none";
  if (!video.hasAttribute("src")) return;
  video.removeAttribute("src");
  video.dataset.sourceState = "detached";
  video.load();
}

type PackedAlphaMascotVideoProps = {
  autoPlay?: boolean;
  loop?: boolean;
  mediaRuntime: V7MediaRuntime;
  onCanPlay: () => void;
  onError: () => void;
  onFirstFrame: () => void;
  onLoadStart: () => void;
  preload: "auto" | "metadata" | "none";
  src: string;
  testId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
};

function PackedAlphaMascotVideo({
  autoPlay = false,
  loop = false,
  mediaRuntime,
  onCanPlay,
  onError,
  onFirstFrame,
  onLoadStart,
  preload,
  src,
  testId,
  videoRef,
}: PackedAlphaMascotVideoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef({ onCanPlay, onError, onFirstFrame, onLoadStart });
  useEffect(() => {
    callbackRef.current = { onCanPlay, onError, onFirstFrame, onLoadStart };
  }, [onCanPlay, onError, onFirstFrame, onLoadStart]);

  useEffect(() => {
    if (!V7_MEDIA_RUNTIME_SURFACES.packedAlpha) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const lease = mediaRuntime.connect({
      kind: "packed-alpha",
      canvas,
      video,
      onCanPlay: () => callbackRef.current.onCanPlay(),
      onError: () => callbackRef.current.onError(),
      onFirstFrame: () => callbackRef.current.onFirstFrame(),
    });
    return () => lease.dispose();
  }, [mediaRuntime, videoRef]);

  useEffect(() => {
    if (V7_MEDIA_RUNTIME_SURFACES.packedAlpha) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
      stencil: false,
    });
    if (!gl) {
      callbackRef.current.onError();
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      void main() {
        vec3 color = texture2D(u_texture, vec2(v_texCoord.x * 0.5, v_texCoord.y)).rgb;
        float rawAlpha = texture2D(u_texture, vec2(0.5 + v_texCoord.x * 0.5, v_texCoord.y)).r;
        float alpha = smoothstep(0.012, 0.988, rawAlpha);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `;
    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      callbackRef.current.onError();
      return;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      callbackRef.current.onError();
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture || positionLocation < 0 || texCoordLocation < 0) {
      if (buffer) gl.deleteBuffer(buffer);
      if (texture) gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      callbackRef.current.onError();
      return;
    }

    canvas.width = 2;
    canvas.height = 2;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
      -1,  1, 0, 1,
       1, -1, 1, 0,
       1,  1, 1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    let firstFrameDrawn = false;
    let frameRequest = 0;
    let requestKind: "animation" | "video" | null = null;
    const cancelFrameRequest = () => {
      if (!frameRequest) return;
      if (requestKind === "video" && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(frameRequest);
      } else {
        window.cancelAnimationFrame(frameRequest);
      }
      frameRequest = 0;
      requestKind = null;
    };
    const drawFrame = () => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth < 2) return;
      try {
        const decodedWidth = Math.max(2, Math.round(video.videoWidth / 2));
        const decodedHeight = Math.max(2, video.videoHeight);
        if (canvas.width !== decodedWidth || canvas.height !== decodedHeight) {
          canvas.width = decodedWidth;
          canvas.height = decodedHeight;
          gl.viewport(0, 0, decodedWidth, decodedHeight);
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (!firstFrameDrawn) {
          firstFrameDrawn = true;
          canvas.dataset.frameReady = "true";
          callbackRef.current.onFirstFrame();
        }
      } catch {
        callbackRef.current.onError();
      }
    };
    const scheduleFrame = () => {
      cancelFrameRequest();
      if (video.paused || video.ended || document.visibilityState !== "visible") return;
      if (typeof video.requestVideoFrameCallback === "function") {
        requestKind = "video";
        frameRequest = video.requestVideoFrameCallback(() => {
          frameRequest = 0;
          requestKind = null;
          drawFrame();
          scheduleFrame();
        });
        return;
      }
      requestKind = "animation";
      frameRequest = window.requestAnimationFrame(() => {
        frameRequest = 0;
        requestKind = null;
        drawFrame();
        scheduleFrame();
      });
    };
    const handleLoadedData = () => {
      drawFrame();
      scheduleFrame();
    };
    const handleCanPlay = () => {
      callbackRef.current.onCanPlay();
      drawFrame();
    };
    const handleSeeked = () => drawFrame();
    const handlePlay = () => scheduleFrame();
    const handlePause = () => {
      cancelFrameRequest();
      drawFrame();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        drawFrame();
        scheduleFrame();
      } else {
        cancelFrameRequest();
      }
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      cancelFrameRequest();
      callbackRef.current.onError();
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    document.addEventListener("visibilitychange", handleVisibility);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) handleLoadedData();

    return () => {
      cancelFrameRequest();
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [videoRef]);

  return (
    <>
      <canvas aria-hidden="true" className={styles.packedAlphaCanvas} ref={canvasRef} />
      <video
        aria-hidden="true"
        autoPlay={autoPlay}
        className={styles.packedAlphaSourceVideo}
        data-testid={testId}
        loop={loop}
        muted
        onError={() => callbackRef.current.onError()}
        onLoadStart={() => callbackRef.current.onLoadStart()}
        playsInline
        preload={preload}
        ref={videoRef}
      >
        <source src={src} type='video/mp4; codecs="avc1.640029"' />
      </video>
    </>
  );
}

const scrollTimeSegments = [
  { start: 0, end: 4.5, weight: 2.3 },
  { start: 4.5, end: shiftedPhoneTime(11.05), weight: 1.45 },
  { start: shiftedPhoneTime(11.05), end: shiftedPhoneTime(13.4), weight: 1.8 },
  { start: shiftedPhoneTime(13.4), end: shiftedPhoneTime(14.06), weight: 5 },
  { start: shiftedPhoneTime(14.06), end: shiftedPhoneTime(14.75), weight: 4.8 },
  { start: shiftedPhoneTime(14.75), end: shiftedPhoneTime(18.75), weight: 1.05 },
  { start: shiftedPhoneTime(18.75), end: 23, weight: 5.2 },
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
  { start: 33.22, end: REFERENCE_PINNED_END, weight: 7.9 },
] as const;

const weightedScrollDuration = scrollTimeSegments.reduce(
  (total, segment) => total + (segment.end - segment.start) * segment.weight,
  0,
);

function referenceTimeAtScrollProgress(progress: number) {
  if (V7_SEQUENCE_CONTRACT_ROLLOUT.referenceTimeAuthority) {
    return contractReferenceTimeAtScrollProgress(progress);
  }
  let weightedTime = gsap.utils.clamp(0, 1, progress) * weightedScrollDuration;
  for (const segment of scrollTimeSegments) {
    const segmentDuration = (segment.end - segment.start) * segment.weight;
    if (weightedTime <= segmentDuration) {
      return segment.start + weightedTime / segment.weight;
    }
    weightedTime -= segmentDuration;
  }
  return REFERENCE_PINNED_END;
}

function scrollProgressAtReferenceTime(referenceTime: number) {
  if (V7_SEQUENCE_CONTRACT_ROLLOUT.referenceTimeAuthority) {
    return contractScrollProgressAtReferenceTime(referenceTime);
  }
  const clampedTime = gsap.utils.clamp(0, REFERENCE_PINNED_END, referenceTime);
  let weightedTime = 0;
  for (const segment of scrollTimeSegments) {
    if (clampedTime >= segment.end) {
      weightedTime += (segment.end - segment.start) * segment.weight;
      continue;
    }
    if (clampedTime > segment.start) {
      weightedTime += (clampedTime - segment.start) * segment.weight;
    }
    break;
  }
  return weightedTime / weightedScrollDuration;
}

const phaseLabels = [
  [0, "openingGeometry"],
  [0.55, "openingHeadline"],
  [2.5, "mascotRise"],
  [4.25, "mascotSettle"],
  [5, "headlineMedallions"],
  [9.25, "headlineArchitecture"],
  [10.2, "headlineFlood"],
  [shiftedPhoneTime(11.05), "phoneEmergence"],
  [shiftedPhoneTime(11.5), "phoneHold"],
  [shiftedPhoneTime(14.75), "phoneMaterialTakeover"],
  [shiftedPhoneTime(16), "outlineTrace"],
  [shiftedPhoneTime(16.25), "blockHeadline"],
  [shiftedPhoneTime(17.875), "readableHeadline"],
  [shiftedPhoneTime(18.75), "phoneReturn"],
  [shiftedPhoneTime(19), "sideCardsRise"],
  [shiftedPhoneTime(19.75), "firstCluster"],
  [23, "violetRise"],
  [24.25, "turnEnglishOn"],
  [25.75, "secondCardSystem"],
  [27.75, "coralRise"],
  [28.47, "learnWithConfidence"],
  [29.45, "lessonObject"],
  [30.5, "proofWall"],
  [32.25, "darkCampaign"],
] as const;

const medallions = [
  { x: 60, y: 74, r: 76, color: "var(--medallion-mint)", label: "Aa" },
  { x: 260, y: 278, r: 92, color: "var(--sky)", label: "/ə/" },
  { x: 470, y: 58, r: 82, color: "var(--coral)", label: "✓" },
  { x: 680, y: 282, r: 102, color: "var(--lavender)", label: "▤" },
  { x: 900, y: 72, r: 88, color: "var(--lime)", label: "◉" },
  { x: 1100, y: 272, r: 82, color: "var(--ice)", label: "⌁" },
];

const blockCells = Array.from({ length: 18 }, (_, index) => {
  const row = index < 9 ? 0 : 1;
  const column = index % 9;
  return {
    x: 34 + column * 96 + (row ? 28 : 0),
    y: row ? 182 : 24,
    width: row ? 84 : 90,
    height: row ? 138 : 126,
  };
});

const availabilityByTier = {
  basic: 2,
  standard: 0,
  premium: 2,
} satisfies Record<TariffId, number>;

const preparationToolsByTier = {
  basic: ["ChatGPT · High / Extra High", "Quizlet · по запросу"],
  standard: ["Quizlet", "ChatGPT Pro · x20", "Codex", "Gemini Pro", "NotebookLM", "Claude"],
  premium: ["Quizlet", "ChatGPT Pro · x20", "Codex", "Gemini Pro", "NotebookLM", "Claude"],
} satisfies Record<TariffId, string[]>;

const preparationToolCostByName = {
  "ChatGPT · High / Extra High": { group: "ChatGPT · High / Extra High", price: "2 626 ₽ / месяц" },
  "Quizlet · по запросу": { group: "Quizlet · подготовка карточек", price: "Бесплатная версия · платной подписки нет" },
  Quizlet: { group: "Quizlet · подготовка карточек", price: "Бесплатная версия · платной подписки нет" },
  "ChatGPT Pro · x20": { group: "ChatGPT Pro + Codex", price: "23 622 ₽ / месяц" },
  Codex: { group: "ChatGPT Pro + Codex", price: "23 622 ₽ / месяц" },
  "Gemini Pro": { group: "Gemini Pro + NotebookLM", price: "1 790 ₽ / месяц" },
  NotebookLM: { group: "Gemini Pro + NotebookLM", price: "1 790 ₽ / месяц" },
  Claude: { group: "Claude", price: "2 626 ₽ / месяц" },
} satisfies Record<string, { group: string; price: string }>;

const preparationSubscriptionTotal = {
  exact: "28 038 ₽ / месяц",
  rounded: "≈ 28 000 ₽ / месяц",
} as const;

function preparationToolCost(toolName: string) {
  return preparationToolCostByName[toolName as keyof typeof preparationToolCostByName];
}

const bookingRouteLabel = "ВЫБРАТЬ ТАРИФ";
const applicationButtonLabel = "ОТКРЫТЬ ЗАЯВКУ";
const reservedSlotPolicy = "Оплата пакета резервирует конкретный повторяющийся еженедельный слот, а не свободный баланс занятий. Пропуск или отмена со стороны ученика менее чем за 24 часа считаются проведённым занятием.";
const sharedScheduleRules = [
  "Если занятие отменяет преподаватель, оно переносится или засчитывается в следующий период.",
  "Замена времени возможна только в пределах доступного расписания преподавателя.",
  "Постоянное изменение регулярного слота согласовывается отдельно.",
  "Неиспользованные переносы не переходят в следующий пакет.",
  "Исключительные случаи остаются на усмотрение преподавателя.",
] as const;
const verifiedContacts = [
  {
    href: "https://t.me/helloFWIW",
    label: "Telegram-канал",
    value: "@helloFWIW",
    accessibleName: "Открыть публичный Telegram-канал @helloFWIW",
  },
  {
    href: "https://t.me/AmbivalentCatt",
    label: "Личный Telegram",
    value: "@AmbivalentCatt",
    accessibleName: "Написать в личный Telegram @AmbivalentCatt",
  },
  {
    href: "mailto:hormokp@gmail.com",
    label: "Email",
    value: "hormokp@gmail.com",
    accessibleName: "Написать на email hormokp@gmail.com",
  },
  {
    href: "tel:+79875140560",
    label: "Телефон",
    value: "+7 (987) 514-05-60",
    accessibleName: "Позвонить по номеру +7 987 514-05-60",
  },
] as const;
const proDashboardBenefit = "Для персонального дашборда нужен заранее оплаченный пакет из 8 занятий. Дашборд становится доступен после четвёртого завершённого урока: первые четыре занятия дают исходные данные для содержательного трекинга.";
const proExamRule = "Подготовка к ОГЭ и ЕГЭ доступна только в PRO и требует двух занятий в неделю.";
const introCallCopy = "Если перед заявкой нужно уточнить выбор, можно договориться о бесплатном вводном созвоне до 10 минут. Обсудим цель, текущий уровень, реалистичное расписание, подходящий тариф и один следующий шаг. Это не пробный урок и не отдельная диагностика.";
function tariffDecisionLine(tierId: TariffId) {
  if (tierId === "basic") return "Максимальная гибкость и минимум дополнительных сервисов.";
  if (tierId === "standard") return "Рекомендуемый старт для большинства задач по общему английскому.";
  return `Больше структуры, вовлечённости и контроля прогресса. ${proExamRule}`;
}

function rubles(value: string) {
  return Number(value.replace(/[^0-9]/gu, ""));
}

function packageDiscountLabel(
  tariff: (typeof tariffs)[number],
  price: (typeof tariffs)[number]["prices"][number],
) {
  if (price.lessons === 1) return null;
  if (tariff.id === "premium") {
    if (price.lessons !== 8) return null;
    const fourLessonPackage = tariff.prices.find((item) => item.lessons === 4);
    if (!fourLessonPackage) return null;
    const difference = Math.round((1 - (rubles(price.price) / 8) / (rubles(fourLessonPackage.price) / 4)) * 100);
    return `≈ ${difference}% НИЖЕ ЗА УРОК, ЧЕМ В ПАКЕТЕ ИЗ 4`;
  }

  const singleLesson = tariff.prices.find((item) => item.lessons === 1);
  if (!singleLesson) return null;
  const difference = Math.round((1 - rubles(price.price) / (rubles(singleLesson.price) * price.lessons)) * 100);
  return `≈ ${difference}% НИЖЕ РАЗОВОЙ ЦЕНЫ`;
}

function packagePriceLine({
  label,
  lessons,
  price,
}: (typeof tariffs)[number]["prices"][number], tariff: (typeof tariffs)[number]) {
  const discount = packageDiscountLabel(tariff, { label, lessons, price });
  return [label, price, discount].filter(Boolean).join(" · ");
}

function lessonCountLabel(lessons: number) {
  if (lessons === 1) return "1 занятие";
  if (lessons === 4) return "4 занятия";
  return `${lessons} занятий`;
}

function availabilityLabel(tierId: TariffId) {
  if (resolveOfferDomainConsumer("v7-presentation")) {
    const label = v7AvailabilityLabel(tierId, new Date().toISOString());
    return label === CURRENT_PUBLIC_CLAIMS.staleAvailability ? "Нет свежих данных" : label;
  }
  return `СЕЙЧАС ДОСТУПНО: ${availabilityByTier[tierId]}`;
}

type AvailabilityLabels = Readonly<Record<TariffId, string>>;

const initialAvailabilityLabels: AvailabilityLabels = Object.freeze({
  basic: availabilityLabel("basic"),
  standard: availabilityLabel("standard"),
  premium: availabilityLabel("premium"),
});

function navigateToBookingSection() {
  window.history.replaceState(null, "", "#book-a-lesson");
  window.dispatchEvent(new CustomEvent(V7_BOOKING_NAVIGATION_EVENT));
}

const supportCardsByTier = [
  [
    {
      eyebrow: "BASIC · КОМУ ПОДХОДИТ",
      title: "Максимальная гибкость.",
      detail: "Одно занятие или пакет · минимум сервисов",
      glyph: "ABC",
      visual: "scope",
      body: "Basic позволяет школьникам и студентам выбрать одно занятие или пакет для конкретной учебной задачи. Дополнительные сервисы сведены к минимуму; разбор проходит на уроке.",
      benefits: [
        "Одно занятие или пакет",
        "Материал можно прислать заранее",
        "Проверка и разбор проходят на уроке",
      ],
    },
    {
      eyebrow: "BASIC · ДЛИТЕЛЬНОСТЬ",
      title: "45–50 минут.",
      detail: "Компактный формат занятия",
      glyph: "50′",
      visual: "duration",
      body: "На занятии Basic может использоваться ChatGPT в режимах High / Extra High. Персонализированный учёт всех ошибок не ведётся; Codex не используется.",
      benefits: [
        tariffs[0].duration,
        "ChatGPT · High / Extra High",
        "Quizlet — по запросу",
        "Без Codex",
        "Без персонализированного учёта всех ошибок",
      ],
    },
    {
      eyebrow: "BASIC · СТОИМОСТЬ",
      title: "1 · 4 · 8 занятий.",
      detail: "От 1 300 ₽",
      glyph: "₽",
      visual: "price",
      body: tariffs[0].packageRule,
      benefits: tariffs[0].prices.map((price) => packagePriceLine(price, tariffs[0])),
    },
    {
      eyebrow: "BASIC · УСЛОВИЯ",
      title: "Без связи между уроками.",
      detail: "Материал разбирается на занятии",
      glyph: "1:1",
      visual: "terms",
      body: "Из-за длительности Basic не рассчитан на отдельный speaking-фокус и не подходит для подготовки к ОГЭ или ЕГЭ.",
      benefits: [
        "Без отдельного speaking-фокуса",
        "Не подходит для подготовки к ОГЭ",
        "Не подходит для подготовки к ЕГЭ",
        "Поддержка между занятиями не входит",
      ],
    },
  ],
  [
    {
      eyebrow: "STANDARD · КОМУ ПОДХОДИТ",
      title: "Рекомендуемый старт.",
      detail: "Системный общий английский",
      glyph: "LIVE",
      visual: "scope",
      body: "Standard рекомендуется большинству школьников и студентов для системного общего английского. Программу можно строить по школьному курсу, GoGetter, знакомому или другому согласованному учебнику.",
      benefits: [
        "Школьная программа",
        "GoGetter или знакомый учебник",
        "Другой согласованный учебник",
        "ОГЭ и ЕГЭ доступны только в PRO",
      ],
    },
    {
      eyebrow: "STANDARD · ДЛИТЕЛЬНОСТЬ",
      title: "50–55 минут.",
      detail: "Live-заметки · speaking · отчёт каждые 4 урока",
      glyph: "55′",
      visual: "duration",
      body: "Standard длится 50–55 минут. ChatGPT Live запускается на каждом уроке для заметок и может использоваться для speaking-практики; отчёт о сильных и слабых сторонах готовится каждые четыре занятия.",
      benefits: [
        tariffs[1].duration,
        "ChatGPT Live · заметки каждого урока + speaking",
        "Отчёт о сильных и слабых сторонах — раз в 4 занятия",
      ],
    },
    {
      eyebrow: "STANDARD · СТОИМОСТЬ",
      title: "1 · 4 · 8 занятий.",
      detail: "4 занятия ≈−10% · 8 занятий ≈−15%",
      glyph: "₽",
      visual: "price",
      body: tariffs[1].packageRule,
      benefits: tariffs[1].prices.map((price) => packagePriceLine(price, tariffs[1])),
    },
    {
      eyebrow: "STANDARD · ИНСТРУМЕНТЫ",
      title: "6 AI‑инструментов.",
      detail: "Quizlet · ChatGPT Pro x20 · ещё 4",
      glyph: "AI",
      visual: "terms",
      body: "В подготовке и учебных материалах Standard используются шесть AI-инструментов. ChatGPT Live запускается на каждом уроке для заметок и при необходимости поддерживает speaking-практику.",
      benefits: [...preparationToolsByTier.standard, "ChatGPT Live · заметки каждого урока + speaking"],
    },
  ],
  [
    {
      eyebrow: "PRO · ФОРМАТ",
      title: "Только пакеты.",
      detail: "8 занятий · ≈5% ниже за урок",
      glyph: "4·8",
      visual: "scope",
      body: tariffs[2].packageRule,
      benefits: tariffs[2].prices.map((price) => packagePriceLine(price, tariffs[2])),
    },
    {
      eyebrow: "PRO · ДЛИТЕЛЬНОСТЬ",
      title: "60 минут.",
      detail: "Отчёт после каждого урока",
      glyph: "60′",
      visual: "duration",
      body: "PRO длится 60 минут. Персонализированный трекинг и краткий отчёт обновляются после каждого занятия.",
      benefits: [
        tariffs[2].duration,
        "Персонализированный трекинг ошибок",
        "Отчёт после каждого занятия",
        proDashboardBenefit,
      ],
    },
    {
      eyebrow: "PRO · ПОДДЕРЖКА",
      title: "Связь и трекинг.",
      detail: "Короткие вопросы · отчёт после урока",
      glyph: "ЧАТ",
      visual: "price",
      body: "PRO включает разумную помощь с короткими вопросами между встречами, ответ в течение одного рабочего дня и персонализированный отчёт после каждого урока.",
      benefits: [...tariffs[2].notes, "Отчёт и трекинг после каждого занятия"],
    },
    {
      eyebrow: "PRO · ИНСТРУМЕНТЫ",
      title: "6 AI‑инструментов.",
      detail: "Quizlet · ChatGPT Pro x20 · ещё 4",
      glyph: "AI",
      visual: "terms",
      body: "В подготовке и учебных материалах PRO используются шесть AI-инструментов. ChatGPT Live запускается на каждом уроке для заметок и при необходимости поддерживает speaking-практику.",
      benefits: [...preparationToolsByTier.premium, "ChatGPT Live · заметки каждого урока + speaking"],
    },
  ],
] as const;

const v7OverviewByTier = {
  basic: {
    fit: `${tariffs[0].fit} Basic не подходит для подготовки к ОГЭ или ЕГЭ.`,
    included: [
      "Материал можно прислать заранее; разбор проходит на занятии",
      "ChatGPT · High / Extra High",
      "Quizlet по запросу",
      "Без Codex и без персонализированного трекинга ошибок",
      tariffs[0].transferPolicy,
    ],
  },
  standard: {
    fit: `${tariffs[1].fit} Для ОГЭ и ЕГЭ нужен PRO с двумя занятиями в неделю.`,
    included: [
      "ChatGPT Live · заметки каждого урока + speaking",
      tariffs[1].reporting,
      tariffs[1].support,
      tariffs[1].transferPolicy,
      "Шесть инструментов для подготовки и материалов",
    ],
  },
  premium: {
    fit: tariffs[2].fit,
    included: [
      tariffs[2].reporting,
      proDashboardBenefit,
      proExamRule,
      "ChatGPT Live · заметки каждого урока + speaking",
      tariffs[2].support,
      tariffs[2].transferPolicy,
      "Шесть инструментов для подготовки и материалов",
    ],
  },
} satisfies Record<TariffId, { fit: string; included: string[] }>;

const phoneUiCards = [
  {
    id: "basic",
    tariffId: "basic",
    name: "BASIC",
    label: "45–50 MIN",
    progress: "22%",
    meta: availabilityLabel("basic"),
    detail: "Школа · разбор присланного материала на уроке.",
    artwork: "/media/phone-tier-artwork/basic-coral-apricot.webp",
    artworkPosition: "50% 50%",
    loopVideo: "/media/phone-tier-animation/basic-loop-pass-1.mp4",
    mobileLoopVideo: "/media/phone-tier-animation/basic-loop-pass-1-mobile-safari.mp4",
  },
  {
    id: "standard",
    tariffId: "standard",
    name: "STANDARD",
    label: "50–55 MIN",
    progress: "52%",
    meta: availabilityLabel("standard"),
    detail: "Школа / GoGetter · speaking · отчёт каждые 4 урока.",
    artwork: "/media/phone-tier-artwork/standard-cyan-blue.webp",
    artworkPosition: "82% 50%",
    loopVideo: "/media/phone-tier-animation/standard-loop-pass-2.mp4",
    mobileLoopVideo: "/media/phone-tier-animation/standard-loop-pass-2-mobile-safari.mp4",
  },
  {
    id: "pro",
    tariffId: "premium",
    name: "PRO",
    label: "60 MIN",
    progress: "78%",
    meta: availabilityLabel("premium"),
    detail: "Трекинг · отчёт после каждого урока.",
    artwork: "/media/phone-tier-artwork/pro-deep-violet.webp",
    artworkPosition: "50% 50%",
    introVideo: "/media/phone-tier-animation/pro-intro-pass-1.mp4",
    mobileIntroVideo: "/media/phone-tier-animation/pro-intro-pass-1-mobile-safari.mp4",
    loopVideo: "/media/phone-tier-animation/pro-loop-pass-2.mp4",
    mobileLoopVideo: "/media/phone-tier-animation/pro-loop-pass-2-mobile-safari.mp4",
  },
] as const;

const headlineMediaCards = [phoneUiCards[1], phoneUiCards[2], phoneUiCards[0]] as const;

const MATERIAL_CURRENT_HANDOFFS = [
  {
    start: 1.2,
    end: 2.06,
    outgoingIndex: 0,
    incomingIndex: 1,
    outgoingTier: "basic",
    incomingTier: "standard",
  },
  {
    start: 3.05,
    end: 3.89,
    outgoingIndex: 1,
    incomingIndex: 2,
    outgoingTier: "standard",
    incomingTier: "pro",
  },
] as const;

const MATERIAL_CURRENT_FULL_CLIP = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
const MATERIAL_CURRENT_EMPTY_CLIP = "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)";

const materialCurrentClipPair = (progress: number) => {
  if (V7_SEQUENCE_CONTRACT_ROLLOUT.dataAttributeAuthority) {
    return contractMaterialClipPair(progress);
  }
  const clampedProgress = Math.min(1, Math.max(0, progress));
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
};

const proofCards = [
  { label: "PRO · ДЛИТЕЛЬНОСТЬ", value: "60", detail: "МИНУТ", artwork: "/media/pro-proof-artwork/duration-pearl-v4.webp", detailIndex: 1 },
  { label: "PRO · ПАКЕТ", value: "4 · 6 000 ₽", detail: "ЗАНЯТИЯ", artwork: "/media/pro-proof-artwork/format-pearl-v4.webp", detailIndex: 0 },
  { label: "PRO · ПАКЕТ", value: "8 · 11 400 ₽", detail: "ЗАНЯТИЙ", artwork: "/media/pro-proof-artwork/support-pearl-v4.webp", detailIndex: 0 },
  { label: "PRO · РАСПИСАНИЕ", value: "ПРИОРИТЕТ", detail: "ПОСТОЯННОЕ ВРЕМЯ", artwork: "/media/pro-proof-artwork/priority-pearl-v4.webp", detailIndex: 2 },
] as const;

const violetUtilities = [
  { id: "basic-duration", value: "45–50", label: "BASIC · МИН", artwork: "/media/tier-utility-artwork-v2/basic-duration-material.webp" },
  { id: "school", value: "ШКОЛА", label: "ПОМОЩЬ С Д/З", artwork: "/media/generated-backgrounds/transition-coral-cyan-b.webp" },
  { id: "quizlet", value: "QUIZLET", label: "STANDARD · PRO", artwork: "/media/v7-generated/quizlet-utility-material.webp" },
  { id: "standard-duration", value: "50–55", label: "STANDARD · МИН", artwork: "/media/tier-utility-artwork-v2/standard-duration-material.webp" },
  { id: "chatgpt-pro", value: "CHATGPT PRO", label: "STANDARD · PRO", artwork: "/media/v7-generated/chatgpt-pro-hero-utility-v2.webp" },
  { id: "codex", value: "CODEX", label: "STANDARD · PRO", artwork: "/media/v7-generated/codex-utility-material.webp" },
  { id: "pro-duration", value: "60", label: "PRO · МИН", artwork: "/media/tier-utility-artwork-v2/pro-duration-material.webp" },
  { id: "speaking", value: "SPEAKING", label: "CHATGPT LIVE · STANDARD · PRO", artwork: "/media/v7-generated/speaking-live-voice-orbit-v3.webp" },
  { id: "tracking", value: "TRACKING", label: "REPORTS · STANDARD / 4 · PRO / EACH", artwork: "/media/tier-utility-artwork-v2/pro-duration-material.webp" },
  { id: "claude", value: "CLAUDE", label: "PREPARATION · MATERIALS", artwork: "/media/generated-backgrounds/transition-coral-cyan-b.webp" },
] as const;

const flowStorySteps = [
  {
    eyebrow: "01 · ФОРМАТ",
    title: "Выберите темп.",
    summary: "Basic — 45–50 минут, Standard — 50–55 минут, PRO — 60 минут.",
    visualTitle: "BASIC · STANDARD · PRO",
    visualMeta: "45–50 · 50–55 · 60 МИН",
    artwork: "/media/phone-tier-artwork/standard-cyan-blue.webp",
    visualKind: "formats",
  },
  {
    eyebrow: "02 · МАТЕРИАЛЫ",
    title: "Материал под цель.",
    summary: "Грамматика, школьные задания, speaking и подготовка к проверочным собираются вокруг цели ученика; цифровые инструменты помогают подготовить материал.",
    visualTitle: "ПОД ЦЕЛЬ УЧЕНИКА",
    visualMeta: "ГРАММАТИКА · SPEAKING · ШКОЛА",
    artwork: "/media/standard-proof-artwork/materials-v3.webp",
    visualKind: "materials",
  },
  {
    eyebrow: "03 · ЗАПИСЬ",
    title: "Заявка на первый урок.",
    summary: "Выберите тариф, оставьте контакты и расскажите о цели занятий — так мы согласуем подходящий формат и первый урок.",
    visualTitle: "ПЕРВЫЙ УРОК",
    visualMeta: "ТАРИФ · ЦЕЛЬ · КОНТАКТ",
    artwork: "/media/v7-generated/booking-request-story-v1.webp",
    visualKind: "booking",
  },
] as const;

const materialTickerTools = [
  {
    id: "quizlet",
    name: "Quizlet",
    order: "01",
    title: "Карточки по словам урока.",
    body: "Для карточек по лексике и коротким правилам используется бесплатная версия Quizlet. Платной подписки нет ни у преподавателя, ни у ученика.",
    meta: "STANDARD · PRO · ПО УЧЕБНОЙ ЗАДАЧЕ",
    cost: "Бесплатная версия · без платной подписки",
  },
  {
    id: "chatgpt-pro",
    name: "ChatGPT Pro · x20",
    order: "02",
    title: "Больше ресурса на подготовку.",
    body: "ChatGPT Pro x20 помогает готовить объяснения, примеры, структуру занятия и персональные материалы. Это рабочий инструмент преподавателя.",
    meta: "STANDARD · PRO · ПОДГОТОВКА",
    cost: "ChatGPT Pro + Codex · 23 622 ₽ / месяц",
  },
  {
    id: "codex",
    name: "Codex",
    order: "03",
    title: "Интерактивные материалы под задачу.",
    body: "Codex помогает собирать персональные тренажёры, интерактивные задания и мини-приложения под конкретную учебную задачу.",
    meta: "STANDARD · PRO · МАТЕРИАЛЫ",
    cost: "ChatGPT Pro + Codex · 23 622 ₽ / месяц",
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    order: "04",
    title: "Дополнительный взгляд на материал.",
    body: "Gemini Pro используется для сравнения формулировок, работы с источниками и подготовки вариантов учебных материалов.",
    meta: "STANDARD · PRO · ПОДГОТОВКА",
    cost: "Gemini Pro + NotebookLM · 1 790 ₽ / месяц",
  },
  {
    id: "notebooklm",
    name: "NotebookLM",
    order: "05",
    title: "Источники и заметки в одной системе.",
    body: "NotebookLM помогает организовать исходные материалы, заметки и документы по теме, чтобы подготовка опиралась на конкретные источники.",
    meta: "STANDARD · PRO · ИСТОЧНИКИ",
    cost: "Gemini Pro + NotebookLM · 1 790 ₽ / месяц",
  },
  {
    id: "claude",
    name: "Claude",
    order: "06",
    title: "Альтернативная проверка материала.",
    body: "Claude используется для анализа длинных материалов, проверки структуры и подготовки альтернативных объяснений.",
    meta: "STANDARD · PRO · ПОДГОТОВКА",
    cost: "Claude · 2 626 ₽ / месяц",
  },
] as const;

type MaterialTickerToolId = (typeof materialTickerTools)[number]["id"];

const faqItems = [
  {
    question: "Какой формат занятий мне подойдёт?",
    answer: `Уроки рассчитаны на школьников и студентов с начальным или средним уровнем английского. Basic даёт максимальную гибкость и минимум дополнительных сервисов. Standard рекомендуется большинству учеников для системного общего английского и включает отчёт раз в четыре занятия. PRO подходит тем, кому нужны более строгая структура, повышенная вовлечённость, помощь с короткими вопросами между уроками и подробный контроль прогресса. ${proExamRule}`,
  },
  {
    question: "Сколько длится занятие?",
    answer: "Basic длится 45–50 минут, Standard — 50–55 минут, PRO — 60 минут.",
  },
  {
    question: "Можно ли приобрести одно занятие или нужен пакет?",
    answer: "В Basic и Standard можно выбрать одно занятие либо пакет из 4 или 8 занятий. PRO доступен только пакетами из 4 или 8 занятий.",
  },
  {
    question: "Что означает оплата пакета заранее?",
    answer: `${reservedSlotPolicy} ${sharedScheduleRules.join(" ")}`,
  },
  {
    question: "Сколько переносов входит в тариф?",
    answer: `Basic: ${tariffs[0].transferPolicy} Standard: ${tariffs[1].transferPolicy} PRO: ${tariffs[2].transferPolicy}`,
  },
  {
    question: "Какие инструменты используются при подготовке?",
    answer: "В Basic может использоваться ChatGPT в режимах High / Extra High, Quizlet создаётся по запросу, а Codex не используется. В подготовке Standard и PRO используются Quizlet, ChatGPT Pro x20, Codex, Gemini Pro, NotebookLM и Claude. Начиная со Standard, ChatGPT Live запускается на каждом уроке для заметок и может использоваться для speaking. Наборы Quizlet создаются в бесплатной версии: платной подписки нет ни у преподавателя, ни у ученика. Это рабочие инструменты преподавателя; отдельные подписки ученику не передаются.",
  },
  {
    question: "Как проходит запись на первый урок?",
    answer: "Сначала сравните три тарифа, выберите подходящий и откройте заявку. Укажите данные контактного лица и ученика, уровень, цель, пакет, удобное время и контакт. После серверной проверки заявка сохраняется, а сайт показывает настоящий номер подтверждения. Он не означает автоматическое зачисление или оплату: время первого урока согласовывается отдельно. Если до заявки остался вопрос, можно написать в Telegram или по email либо договориться о бесплатном вводном созвоне до 10 минут.",
  },
  {
    question: "Почему изменились цены?",
    answer: "Новые тарифы учитывают длительность занятия, объём подготовки, используемые AI-инструменты, формат обратной связи и трекинг прогресса. Новые тарифы и цены применяются с сентября. Для сравнения: в Пензе медианная стоимость 60-минутного занятия по школьному английскому составляет 800 ₽, а подготовки к ОГЭ и ЕГЭ — 1 000 ₽; онлайн-медианы для тех же форматов — 1 950 ₽ и 2 000 ₽ соответственно. При формировании тарифов также учитывается профильная квалификация преподавателя — степень магистра лингвистики по программе «Перевод и переводоведение».",
  },
  {
    question: "Что будет с уже оплаченными занятиями?",
    answer: "Если у вас остался аванс, посчитайте оставшиеся занятия и напишите мне. Я сверю количество со своей стороны. Подтверждённый остаток можно зачесть в счёт нового тарифа; если новый тариф не подходит, я верну подтверждённый остаток в течение двух недель.",
  },
  {
    question: "Для чего нужны данные из заявки?",
    answer: "Данные контактного лица и ученика, уровень, цель, выбранный тариф, расписание и контакт сохраняются, чтобы разобрать запрос и согласовать первый урок. Исправить или удалить заявку можно через опубликованные Telegram, email или телефон.",
  },
] as const;

const initialImageUrls = Array.from(new Set([
  "/media/v7-generated/frog-opening-field.webp",
  "/media/mascot/Liquid_cat_poster_alpha_decontaminated.png",
]));

const dialogFocusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "summary",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function dialogFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(dialogFocusableSelector)).filter(
    (element) => element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== "hidden",
  );
}

function trapDialogTabKey(event: KeyboardEvent, panel: HTMLElement) {
  if (event.key !== "Tab") return;
  const focusable = dialogFocusableElements(panel);
  if (!focusable.length) {
    event.preventDefault();
    panel.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeElement = document.activeElement;
  if (event.shiftKey && (!panel.contains(activeElement) || activeElement === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!panel.contains(activeElement) || activeElement === last)) {
    event.preventDefault();
    first.focus();
  }

  // Mobile WebKit can move focus to <body> after the keydown default action
  // when a disclosure is followed by checkbox controls. Re-assert containment
  // after that native step without interfering with normal in-panel order.
  window.requestAnimationFrame(() => {
    if (panel.contains(document.activeElement)) return;
    (event.shiftKey ? last : first).focus({ preventScroll: true });
  });
}

function inertV7Main() {
  const main = document.querySelector<HTMLElement>("[data-liquid-v7-main]");
  if (!main) return () => undefined;
  const wasInert = main.inert;
  main.inert = true;
  return () => { main.inert = wasInert; };
}

function watchProMaterialLoopBoundary(video: HTMLVideoElement) {
  let disposed = false;
  let frameRequest = 0;

  const restartAtMatchedFrame = (mediaTime: number) => {
    const duration = video.duration;
    if (
      !Number.isFinite(duration)
      || duration <= 0
      || duration - mediaTime > PRO_MATERIAL_LOOP_LEAD_SECONDS
    ) return;
    try { video.currentTime = PRO_MATERIAL_LOOP_RESTART_SECONDS; } catch { /* metadata may be changing */ }
  };

  if (typeof video.requestVideoFrameCallback !== "function") {
    const handleTimeUpdate = () => restartAtMatchedFrame(video.currentTime);
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }

  const watchFrame: VideoFrameRequestCallback = (_now, metadata) => {
    frameRequest = 0;
    if (disposed) return;
    restartAtMatchedFrame(metadata.mediaTime);
    frameRequest = video.requestVideoFrameCallback(watchFrame);
  };
  const scheduleWatch = () => {
    if (disposed || frameRequest) return;
    frameRequest = video.requestVideoFrameCallback(watchFrame);
  };

  video.addEventListener("loadeddata", scheduleWatch);
  video.addEventListener("playing", scheduleWatch);
  scheduleWatch();
  return () => {
    disposed = true;
    video.removeEventListener("loadeddata", scheduleWatch);
    video.removeEventListener("playing", scheduleWatch);
    if (frameRequest) video.cancelVideoFrameCallback(frameRequest);
  };
}

type RectState = { x: number; y: number; width: number; height: number };
type TransformState = { x: number; y: number; scale: number; rotation: number };
type V7ApplicationTier = "basic" | "standard" | "pro";
type V7ApplicationLaunch = { tier: V7ApplicationTier; origin: RectState };
type V7ApplicationOrigin = HTMLElement | RectState;
type V7ApplicationHandler = (planName: TariffName, origin?: V7ApplicationOrigin) => void;

type V7Bounds = {
  headline: RectState;
  headlineLines: RectState[];
  phone: RectState;
  phoneOutline: RectState;
  mascot: RectState;
  phoneMascotAnchor: RectState;
  cards: RectState[];
  proofCards: RectState[];
};

type PhoneIdentity =
  | "visible-black"
  | "dissolving"
  | "trace-only"
  | "offscreen-prepared"
  | "returning"
  | "restored";

type V7DebugState = {
  motionReady: boolean;
  preinitVisible: boolean;
  referenceTime: number;
  progress: number;
  activePhase: string;
  activeOpeningWord: string;
  visibleOpeningWordCount: number;
  visibleHeadlineLayerCount: number;
  headlineBounds: RectState;
  phoneBounds: RectState;
  phoneMaterialPercentage: number;
  phoneIdentityState: PhoneIdentity;
  outlinePercentage: number;
  liquidVisibleBounds: RectState;
  liquidVisibleHeight: number;
  phoneMascotAnchor: RectState;
  phoneMascotAnchorDelta: { dx: number; dy: number; distance: number };
  visibleSideCardCount: number;
  currentContinuationScene: string;
  ctaVisibility: number;
  videoCurrentSrc: string;
  videoDuration: number;
  videoCurrentTime: number;
  videoCount: number;
  scrollTriggerCount: number;
  horizontalOverflow: number;
};

declare global {
  interface Window {
    __LIQUID_V7_DEBUG__?: {
      setReferenceTime: (seconds: number) => void;
      setProgress: (progress: number) => void;
      getState: () => V7DebugState;
      getBounds: () => V7Bounds;
      releaseScroll: () => void;
    };
  }
}

function phaseAt(referenceTime: number) {
  if (V7_SEQUENCE_CONTRACT_ROLLOUT.debugAuthority) {
    return contractPhaseAtReferenceTime(referenceTime).id;
  }
  let phase: string = phaseLabels[0][1];
  for (const [start, label] of phaseLabels) {
    if (referenceTime >= start) phase = label;
  }
  return phase;
}

function phoneIdentityAt(referenceTime: number): PhoneIdentity {
  if (V7_SEQUENCE_CONTRACT_ROLLOUT.debugAuthority) {
    return contractPhoneIdentityAtReferenceTime(referenceTime);
  }
  if (referenceTime < shiftedPhoneTime(14.75)) return "visible-black";
  if (referenceTime < shiftedPhoneTime(16.2)) return "dissolving";
  if (referenceTime < shiftedPhoneTime(17.25)) return "trace-only";
  if (referenceTime < shiftedPhoneTime(18.75)) return "offscreen-prepared";
  if (referenceTime < shiftedPhoneTime(19.25)) return "returning";
  return "restored";
}

function numericGsapProperty(target: Element, property: string) {
  const value = gsap.getProperty(target, property);
  return typeof value === "number" ? value : Number.parseFloat(String(value)) || 0;
}

function transformState(target: Element): TransformState {
  return {
    x: numericGsapProperty(target, "x"),
    y: numericGsapProperty(target, "y"),
    scale: numericGsapProperty(target, "scale") || 1,
    rotation: numericGsapProperty(target, "rotation"),
  };
}

function serializeRect(rect?: DOMRect | DOMRectReadOnly): RectState {
  return {
    x: rect?.x ?? 0,
    y: rect?.y ?? 0,
    width: rect?.width ?? 0,
    height: rect?.height ?? 0,
  };
}

function visibleOpacity(element: Element | null) {
  if (!element) return 0;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return 0;
  return Number.parseFloat(style.opacity) || 0;
}

function LiquidReferenceHeroV7Sequence({
  availabilityLabels,
  mediaRuntime,
  onApply,
}: {
  availabilityLabels: AvailabilityLabels;
  mediaRuntime: V7MediaRuntime;
  onApply: V7ApplicationHandler;
}) {
  const setSmoothScrollLocked = useContext(V7SmoothScrollLockContext);
  const headlineMaskId = V7_HEADLINE_MASK_ID;
  const sayMaskId = V7_SAY_MASK_ID;
  const mascotEdgeFilterId = V7_MASCOT_EDGE_FILTER_ID;

  const sequenceRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const preinitRef = useRef<HTMLDivElement>(null);
  const siteAssemblyRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<HTMLDivElement>(null);
  const openingFieldRef = useRef<HTMLDivElement>(null);
  const planesRef = useRef<HTMLDivElement>(null);
  const headlineRigRef = useRef<HTMLDivElement>(null);
  const headlineHtmlRef = useRef<HTMLDivElement>(null);
  const headlineBaseRef = useRef<HTMLHeadingElement>(null);
  const fixedLineRef = useRef<HTMLSpanElement>(null);
  const wordViewportRef = useRef<HTMLSpanElement>(null);
  const paceWordRef = useRef<HTMLSpanElement>(null);
  const formatWordRef = useRef<HTMLSpanElement>(null);
  const planWordRef = useRef<HTMLSpanElement>(null);
  const paceMaterialEdgeRef = useRef<HTMLSpanElement>(null);
  const formatMaterialEdgeRef = useRef<HTMLSpanElement>(null);
  const planMaterialEdgeRef = useRef<HTMLSpanElement>(null);
  const headlineSvgRef = useRef<SVGSVGElement>(null);
  const headlineFloodRef = useRef<SVGGElement>(null);
  const medallionRootRef = useRef<SVGGElement>(null);
  const reelCanvasRef = useRef<SVGGElement>(null);
  const openingCtaRef = useRef<HTMLAnchorElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const phoneBodyRef = useRef<HTMLDivElement>(null);
  const phoneMaterialRef = useRef<HTMLDivElement>(null);
  const phoneAnchorRef = useRef<HTMLSpanElement>(null);
  const phoneUiStateRefs = useRef<Array<HTMLDivElement | null>>([]);
  const phoneTierVideoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const fiveCardCompositionRef = useRef<HTMLElement>(null);
  const proTierAtmosphereRef = useRef<HTMLDivElement>(null);
  const proFocalConvergenceRef = useRef<HTMLDivElement>(null);
  const proTierAtmosphereVideoRef = useRef<HTMLVideoElement>(null);
  const activePhoneTierRef = useRef(-1);
  const activeTierStateRef = useRef<0 | 1 | 2>(0);
  const proPlaybackPhaseRef = useRef<"intro" | "idle">("intro");
  const outlineRef = useRef<HTMLDivElement>(null);
  const outlinePathRef = useRef<SVGRectElement>(null);
  const blockSceneRef = useRef<HTMLDivElement>(null);
  const blockGridRef = useRef<SVGGElement>(null);
  const sayClipRectRef = useRef<SVGRectElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const mascotRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const gazeVideoRef = useRef<HTMLVideoElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const violetFieldRef = useRef<HTMLDivElement>(null);
  const violetMedallionsRef = useRef<HTMLDivElement>(null);
  const secondHeadlineRef = useRef<HTMLDivElement>(null);
  const secondCtaRef = useRef<HTMLButtonElement>(null);
  const blueFieldRef = useRef<HTMLDivElement>(null);
  const coralFieldRef = useRef<HTMLDivElement>(null);
  const coralHeadlineRef = useRef<HTMLDivElement>(null);
  const lessonObjectRef = useRef<HTMLDivElement>(null);
  const proofWallRef = useRef<HTMLDivElement>(null);
  const proofCardRefs = useRef<Array<HTMLElement | null>>([]);
  const navyFieldRef = useRef<HTMLDivElement>(null);
  const finalCampaignRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLButtonElement>(null);
  const debugOverlayRef = useRef<HTMLPreElement>(null);
  const detailBackdropRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const detailTriggerRectRef = useRef<DOMRectReadOnly | null>(null);
  const detailTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const detailCloseInFlightRef = useRef(false);
  const toolPriceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeToolPriceRef = useRef<string | null>(null);
  const toolPricePinnedRef = useRef(false);
  const toolPriceFocusReturnRef = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const sequenceContractStateRef = useRef<V7SequenceState | null>(null);
  const viewportRestoreRef = useRef<{ referenceTime: number; afterSequence: number | null } | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [modelFailed, setModelFailed] = useState(false);
  const [modelAttempt, setModelAttempt] = useState(0);
  const [loadingProblem, setLoadingProblem] = useState<"slow" | "error" | null>(null);
  const handleModelError = useCallback(() => setLoadingProblem("error"), []);
  const useLiquidModel = import.meta.env.VITE_LIQUID_3D !== "0" && !modelFailed;
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [gazeVideoFailed, setGazeVideoFailed] = useState(false);
  const [gazeVideoReady, setGazeVideoReady] = useState(false);
  const [gazeActive, setGazeActive] = useState(false);
  const [mascotBridgePhase, setMascotBridgePhase] = useState<"idle" | "to-gaze" | "to-base">("idle");
  const [proPlaybackPhase, setProPlaybackPhase] = useState<"intro" | "idle">("intro");
  const [activeTierIndex, setActiveTierIndex] = useState<0 | 1 | 2>(0);
  const [isProTierAtmosphereReady, setIsProTierAtmosphereReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [activeSupportCardIndex, setActiveSupportCardIndex] = useState<number | null>(null);
  const [activeToolPrice, setActiveToolPrice] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean | null>(null);
  const [useSafariMascotVideo, setUseSafariMascotVideo] = useState<boolean | null>(null);
  const [useIOSPerformanceMode, setUseIOSPerformanceMode] = useState(false);

  const closeToolPrice = useCallback((restoreFocus = true) => {
    activeToolPriceRef.current = null;
    toolPricePinnedRef.current = false;
    setActiveToolPrice(null);
    if (restoreFocus) {
      window.setTimeout(() => {
        toolPriceFocusReturnRef.current = true;
        toolPriceTriggerRef.current?.focus({ preventScroll: true });
        toolPriceFocusReturnRef.current = false;
      }, 0);
    }
  }, []);

  const closeSupportDetail = useCallback((afterClose?: () => void) => {
    if (activeSupportCardIndex === null || detailCloseInFlightRef.current) return;
    const detailTimeline = detailTimelineRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => {
      detailCloseInFlightRef.current = false;
      activeToolPriceRef.current = null;
      toolPriceTriggerRef.current = null;
      setActiveToolPrice(null);
      setActiveSupportCardIndex(null);
      if (afterClose) window.setTimeout(afterClose, 0);
    };

    if (!detailTimeline || reducedMotion || detailTimeline.progress() === 0) {
      finish();
      return;
    }

    detailCloseInFlightRef.current = true;
    detailTimeline.eventCallback("onReverseComplete", finish);
    detailTimeline.timeScale(1.32).reverse();
  }, [activeSupportCardIndex]);

  useLayoutEffect(() => {
    const detailBackdrop = detailBackdropRef.current;
    const detailPanel = detailPanelRef.current;
    if (activeSupportCardIndex === null || !detailBackdrop || !detailPanel) {
      return;
    }

    const fromLeft = activeSupportCardIndex < 2;
    const fromTop = activeSupportCardIndex % 2 === 0;
    const originX = fromLeft ? "18%" : "82%";
    const originY = fromTop ? "24%" : "76%";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const efficientSafariMotion = shouldUseIOSPerformanceMode();
    const previousOverflow = document.documentElement.style.overflow;
    const triggerToRestore = detailTriggerRef.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
      ?? cardRefs.current[activeSupportCardIndex];
    const restoreMainInert = inertV7Main();
    document.documentElement.style.overflow = "hidden";
    setSmoothScrollLocked(true);
    // Keep focus inside the modal while its interactive contents are still
    // intentionally hidden by the spatial assembly choreography. Focusing the
    // close button before GSAP applies autoAlpha would make Chromium discard
    // focus back to <body> as soon as that button becomes visibility:hidden.
    detailPanel.focus({ preventScroll: true });
    const detailAssembly = detailBackdrop.querySelector<HTMLElement>(`.${styles.detailAssembly}`);
    const detailSource = detailBackdrop.querySelector<HTMLElement>(`.${styles.detailSource}`);
    const detailFacets = detailAssembly
      ? Array.from(detailAssembly.children) as HTMLElement[]
      : [];
    const detailContents = Array.from(detailPanel.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const detailContext = gsap.context(() => {
      if (reducedMotion || efficientSafariMotion) {
        gsap.set([detailBackdrop, detailPanel, ...detailContents], { autoAlpha: 1 });
        gsap.set(detailPanel, {
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          filter: "none",
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          x: 0,
          y: 0,
        });
        gsap.set([detailSource, ...detailFacets].filter(Boolean), { autoAlpha: 0 });
        gsap.set(detailContents, {
          autoAlpha: 1,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          filter: "none",
          x: 0,
          y: 0,
        });
        if (reducedMotion) {
          detailCloseRef.current?.focus({ preventScroll: true });
          return;
        }

        const detailTimeline = gsap.timeline({
          paused: true,
          onComplete: () => detailCloseRef.current?.focus({ preventScroll: true }),
        });
        detailTimelineRef.current = detailTimeline;
        detailCloseInFlightRef.current = false;
        detailTimeline
          .fromTo(detailBackdrop, { autoAlpha: 0 }, {
            autoAlpha: 1,
            duration: 0.18,
            ease: "power1.out",
          })
          .fromTo(detailPanel, { autoAlpha: 0, scale: 0.982, y: 14 }, {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 0.26,
            ease: "power2.out",
          }, 0.03);
        detailTimeline.play(0);
        return;
      }

      const horizontalDirection = fromLeft ? -1 : 1;
      const verticalDirection = fromTop ? -1 : 1;
      const triggerRect = detailTriggerRectRef.current
        ?? detailTriggerRef.current?.getBoundingClientRect();
      const assemblyRect = detailAssembly?.getBoundingClientRect();
      const sourceCenterX = (triggerRect?.left ?? window.innerWidth / 2) + (triggerRect?.width ?? 0) / 2;
      const sourceCenterY = (triggerRect?.top ?? window.innerHeight / 2) + (triggerRect?.height ?? 0) / 2;
      const assemblyCenterX = (assemblyRect?.left ?? 0) + (assemblyRect?.width ?? window.innerWidth) / 2;
      const assemblyCenterY = (assemblyRect?.top ?? 0) + (assemblyRect?.height ?? window.innerHeight) / 2;
      const sourceDeltaX = sourceCenterX - assemblyCenterX;
      const sourceDeltaY = sourceCenterY - assemblyCenterY;
      const sourceScale = gsap.utils.clamp(
        0.14,
        0.34,
        (triggerRect?.width ?? 180) / Math.max(assemblyRect?.width ?? window.innerWidth, 1),
      );
      const detailTimeline = gsap.timeline({
        paused: true,
        onComplete: () => detailCloseRef.current?.focus({ preventScroll: true }),
      });
      detailTimelineRef.current = detailTimeline;
      detailCloseInFlightRef.current = false;

      detailTimeline
        .set(detailBackdrop, {
          autoAlpha: 1,
          backdropFilter: "blur(0px) saturate(0.82)",
        })
        .set(detailSource, {
          autoAlpha: 1,
          left: triggerRect?.left ?? sourceCenterX,
          top: triggerRect?.top ?? sourceCenterY,
          width: triggerRect?.width ?? 180,
          height: triggerRect?.height ?? 180,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          transformPerspective: 900,
          transformOrigin: "50% 50%",
        })
        .set(detailPanel, {
          autoAlpha: 1,
          clipPath: `polygon(${originX} ${originY}, ${originX} ${originY}, ${originX} ${originY}, ${originX} ${originY})`,
          filter: "blur(9px) saturate(0.82)",
          rotationX: verticalDirection * 9,
          rotationY: horizontalDirection * -13,
          scale: 0.965,
          z: -72,
          transformPerspective: 1200,
          transformOrigin: `${originX} ${originY}`,
        })
        .set(detailContents, {
          autoAlpha: 0,
          clipPath: fromLeft
            ? "polygon(0 0, 0 0, 0 100%, 0 100%)"
            : "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)",
          filter: "blur(5px)",
          x: horizontalDirection * 18,
          y: verticalDirection * 5,
        })
        .set(detailFacets, {
          autoAlpha: 1,
          scale: (index) => sourceScale * (0.9 + (index % 3) * 0.08),
          x: (index) => sourceDeltaX + horizontalDirection * ((index % 3) - 1) * 14,
          y: (index) => sourceDeltaY + verticalDirection * ((index % 2) ? 12 : -10),
          rotationX: (index) => verticalDirection * (index % 2 ? -62 : 54),
          rotationY: (index) => horizontalDirection * (index % 2 ? 68 : -58),
          rotationZ: (index) => horizontalDirection * (index - 2.5) * 2.8,
          transformPerspective: 1100,
          transformOrigin: `${originX} ${originY}`,
        })
        .addLabel("source", 0)
        .to(detailSource, {
          rotationX: verticalDirection * -3,
          rotationY: horizontalDirection * 5,
          scale: 1.025,
          z: 42,
          duration: 0.22,
          ease: "power3.out",
        }, "source")
        .to(detailBackdrop, {
          backdropFilter: "blur(22px) saturate(0.96)",
          duration: 0.44,
          ease: "power2.out",
        }, "source")
        .addLabel("planes", 0.15)
        .to(detailFacets, {
          scale: 1,
          x: 0,
          y: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          duration: 0.56,
          ease: "expo.out",
          stagger: { each: 0.042, from: fromTop ? "start" : "end" },
        }, "planes")
        .to(detailSource, {
          autoAlpha: 0,
          filter: "blur(5px)",
          rotationX: verticalDirection * -9,
          rotationY: horizontalDirection * 13,
          scale: 0.97,
          z: -34,
          duration: 0.24,
          ease: "power2.inOut",
        }, 0.34)
        .addLabel("surface", 0.38)
        .to(detailPanel, {
          clipPath: fromLeft
            ? "polygon(0 7%, 91% 0, 100% 48%, 94% 100%, 0 92%, 7% 52%)"
            : "polygon(9% 0, 100% 7%, 93% 52%, 100% 92%, 6% 100%, 0 48%)",
          filter: "blur(2px) saturate(1.02)",
          rotationX: verticalDirection * 1.2,
          rotationY: horizontalDirection * -1.8,
          scale: 0.992,
          z: -10,
          duration: 0.4,
          ease: "power3.inOut",
        }, "surface")
        .to(detailPanel, {
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          filter: "blur(0px) saturate(1)",
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          z: 0,
          duration: 0.34,
          ease: "expo.out",
        }, 0.7)
        .to(detailFacets, {
          autoAlpha: 0,
          rotationX: (index) => verticalDirection * (index % 2 ? 12 : -9),
          rotationY: (index) => horizontalDirection * (index % 2 ? -15 : 11),
          scale: 1.012,
          duration: 0.28,
          ease: "power2.inOut",
          stagger: { each: 0.022, from: "edges" },
        }, 0.69)
        .addLabel("content", 0.82)
        .to(detailContents, {
          autoAlpha: 1,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          filter: "blur(0px)",
          x: 0,
          y: 0,
          duration: 0.38,
          ease: "expo.out",
          stagger: 0.04,
        }, "content");

      detailTimeline.play(0);
    }, detailBackdrop);

    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (activeToolPriceRef.current) {
          closeToolPrice();
          return;
        }
        closeSupportDetail();
        return;
      }
      trapDialogTabKey(event, detailPanel);
    };
    const handleDialogFocus = (event: FocusEvent) => {
      if (!detailPanel.contains(event.target as Node)) {
        detailCloseRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", handleDialogKeydown);
    document.addEventListener("focusin", handleDialogFocus);

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeydown);
      document.removeEventListener("focusin", handleDialogFocus);
      detailTimelineRef.current = null;
      detailCloseInFlightRef.current = false;
      detailContext.revert();
      restoreMainInert();
      triggerToRestore?.focus();
      detailTriggerRef.current = null;
      detailTriggerRectRef.current = null;
      setSmoothScrollLocked(false);
    };
  }, [activeSupportCardIndex, closeSupportDetail, closeToolPrice, setSmoothScrollLocked]);

  useLayoutEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      const iosPerformanceMode = shouldUseIOSPerformanceMode();
      const legacySafariPackedAlpha = shouldUseSafariPackedAlpha();
      const browserProfile = iosPerformanceMode
        ? "ios-webkit" as const
        : legacySafariPackedAlpha
          ? "desktop-safari" as const
          : "standard" as const;
      const packedAlphaRenderer = resolveV7MediaIntentSnapshot({
        referenceTime: 0,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          pixelRatio: window.devicePixelRatio || 1,
        },
        browserProfile,
        reducedMotion: preference.matches,
        documentVisible: document.visibilityState === "visible",
        mascotVisible: true,
      }).packedAlpha.renderer;
      setPrefersReducedMotion(preference.matches);
      setUseSafariMascotVideo(
        V7_SEQUENCE_CONTRACT_ROLLOUT.mediaPackedAlphaIntent
          ? packedAlphaRenderer === "packed-alpha-webgl"
          : legacySafariPackedAlpha,
      );
      setUseIOSPerformanceMode(iosPerformanceMode);
    };

    syncPreference();
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion === null || useSafariMascotVideo === null) return;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    const sequence = sequenceRef.current;
    const stage = stageRef.current;
    const preinit = preinitRef.current;
    const siteAssembly = siteAssemblyRef.current;
    const runtime = runtimeRef.current;
    const openingField = openingFieldRef.current;
    const planes = planesRef.current;
    const headlineRig = headlineRigRef.current;
    const headlineHtml = headlineHtmlRef.current;
    const headlineBase = headlineBaseRef.current;
    const fixedLine = fixedLineRef.current;
    const wordViewport = wordViewportRef.current;
    const paceWord = paceWordRef.current;
    const formatWord = formatWordRef.current;
    const planWord = planWordRef.current;
    const paceMaterialEdge = paceMaterialEdgeRef.current;
    const formatMaterialEdge = formatMaterialEdgeRef.current;
    const planMaterialEdge = planMaterialEdgeRef.current;
    const headlineSvg = headlineSvgRef.current;
    const headlineFlood = headlineFloodRef.current;
    const medallionRoot = medallionRootRef.current;
    const reelCanvas = reelCanvasRef.current;
    const openingCta = openingCtaRef.current;
    const phone = phoneRef.current;
    const phoneBody = phoneBodyRef.current;
    const phoneMaterial = phoneMaterialRef.current;
    const phoneAnchor = phoneAnchorRef.current;
    const outline = outlineRef.current;
    const outlinePath = outlinePathRef.current;
    const blockScene = blockSceneRef.current;
    const blockGrid = blockGridRef.current;
    const sayClipRect = sayClipRectRef.current;
    const mascot = mascotRef.current;
    const video = videoRef.current;
    const cue = cueRef.current;
    const violetField = violetFieldRef.current;
    const violetMedallions = violetMedallionsRef.current;
    const secondHeadline = secondHeadlineRef.current;
    const secondCta = secondCtaRef.current;
    const blueField = blueFieldRef.current;
    const coralField = coralFieldRef.current;
    const coralHeadline = coralHeadlineRef.current;
    const lessonObject = lessonObjectRef.current;
    const lessonGlint = lessonObject?.querySelector<HTMLElement>(`.${styles.lessonGlint}`);
    const proTierAtmosphere = proTierAtmosphereRef.current;
    const proFocalConvergence = proFocalConvergenceRef.current;
    const proofWall = proofWallRef.current;
    const navyField = navyFieldRef.current;
    const finalCampaign = finalCampaignRef.current;
    const finalCta = finalCtaRef.current;
    const cards = sequence
      ? Array.from(sequence.querySelectorAll<HTMLElement>("[data-v7-support-card]"))
      : [];
    const proofCardElements = sequence
      ? Array.from(sequence.querySelectorAll<HTMLElement>("[data-v7-proof-card]"))
      : [];
    const phoneUiStates = phoneBody
      ? Array.from(phoneBody.querySelectorAll<HTMLElement>(`.${styles.phoneUiState}`))
      : [];

    if (
      !sequence || !stage || !preinit || !siteAssembly || !runtime || !openingField || !planes ||
      !headlineRig || !headlineHtml || !headlineBase || !fixedLine ||
      !wordViewport || !paceWord || !formatWord || !planWord ||
      !paceMaterialEdge || !formatMaterialEdge || !planMaterialEdge || !headlineSvg ||
      !headlineFlood || !medallionRoot || !reelCanvas || !openingCta || !phone ||
      !phoneBody || !phoneMaterial || !phoneAnchor || !outline || !outlinePath ||
      phoneUiStates.length !== phoneUiCards.length || !blockScene || !blockGrid ||
      !sayClipRect || cards.length !== 4 ||
      !mascot || (!useLiquidModel && !video) || !cue || !violetField || !violetMedallions || !secondHeadline ||
      !secondCta || !blueField || !coralField || !coralHeadline || !lessonObject || !lessonGlint ||
      !proTierAtmosphere || !proFocalConvergence ||
      !proofWall || proofCardElements.length !== proofCards.length || !navyField ||
      !finalCampaign || !finalCta
    ) {
      document.documentElement.dataset.liquidV7MotionMissing = [
        !sequence && "sequence",
        !stage && "stage",
        !preinit && "preinit",
        !siteAssembly && "siteAssembly",
        !runtime && "runtime",
        !openingField && "openingField",
        !planes && "planes",
        !headlineRig && "headlineRig",
        !headlineHtml && "headlineHtml",
        !headlineBase && "headlineBase",
        !fixedLine && "fixedLine",
        !wordViewport && "wordViewport",
        !paceWord && "paceWord",
        !formatWord && "formatWord",
        !planWord && "planWord",
        !paceMaterialEdge && "paceMaterialEdge",
        !formatMaterialEdge && "formatMaterialEdge",
        !planMaterialEdge && "planMaterialEdge",
        !headlineSvg && "headlineSvg",
        !headlineFlood && "headlineFlood",
        !medallionRoot && "medallionRoot",
        !reelCanvas && "reelCanvas",
        !openingCta && "openingCta",
        !phone && "phone",
        !phoneBody && "phoneBody",
        !phoneMaterial && "phoneMaterial",
        !phoneAnchor && "phoneAnchor",
        !outline && "outline",
        !outlinePath && "outlinePath",
        phoneUiStates.length !== phoneUiCards.length && `phoneUiStates:${phoneUiStates.length}`,
        !blockScene && "blockScene",
        !blockGrid && "blockGrid",
        !sayClipRect && "sayClipRect",
        cards.length !== 4 && `cards:${cards.length}`,
        !mascot && "mascot",
        !useLiquidModel && !video && "video",
        !cue && "cue",
        !violetField && "violetField",
        !violetMedallions && "violetMedallions",
        !secondHeadline && "secondHeadline",
        !secondCta && "secondCta",
        !blueField && "blueField",
        !coralField && "coralField",
        !coralHeadline && "coralHeadline",
        !lessonObject && "lessonObject",
        !lessonGlint && "lessonGlint",
        !proTierAtmosphere && "proTierAtmosphere",
        !proFocalConvergence && "proFocalConvergence",
        !proofWall && "proofWall",
        proofCardElements.length !== proofCards.length && `proofCards:${proofCardElements.length}`,
        !navyField && "navyField",
        !finalCampaign && "finalCampaign",
        !finalCta && "finalCta",
      ].filter(Boolean).join(",");
      return;
    }
    delete document.documentElement.dataset.liquidV7MotionMissing;

    const colorProbe = document.createElement("i");
    colorProbe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    sequence.append(colorProbe);
    const resolveColor = (value: string) => {
      colorProbe.style.color = value;
      return window.getComputedStyle(colorProbe).color;
    };
    const phoneColor = resolveColor("var(--phone)");
    const phoneBorderColor = resolveColor(
      "color-mix(in srgb, var(--ice) 24%, transparent)",
    );
    const phoneShadowColor = resolveColor(
      "color-mix(in srgb, var(--deep-teal) 22%, transparent)",
    );
    colorProbe.remove();

    const viewportRestore = viewportRestoreRef.current;
    viewportRestoreRef.current = null;
    const layoutWidth = document.documentElement.clientWidth;
    const layoutHeight = window.innerHeight;
    const nativeTouchViewport = shouldUseIOSPerformanceMode();
    const layoutStart = sequence.offsetTop;
    const layoutDistance = Math.max(1, sequence.offsetHeight - layoutHeight);
    let layoutScrollY = window.scrollY;
    let layoutReferenceTime = viewportRestore?.referenceTime
      ?? referenceTimeAtScrollProgress(gsap.utils.clamp(0, 1, (layoutScrollY - layoutStart) / layoutDistance));
    const viewportMatchesLayout = () => document.documentElement.clientWidth === layoutWidth
      // Safari expands/collapses its toolbar during a gesture. Keep the current
      // timeline and scroll position; width changes still rebuild for rotation.
      && (nativeTouchViewport || window.innerHeight === layoutHeight);
    let disposed = false;
    const readinessAbort = new AbortController();
    stage.dataset.revealState = "pending";
    runtime.inert = true;
    let siteRevealTimeline: gsap.core.Timeline | null = null;
    let runtimeCleanup: (() => void) | undefined;
    let debugHandle: NonNullable<Window["__LIQUID_V7_DEBUG__"]> | undefined;
    const context = gsap.context(() => {
      const reducedMotion = prefersReducedMotion;
      const openingWordSequence = [
        { name: "pace.", tier: "basic" },
        { name: "format.", tier: "standard" },
        { name: "plan.", tier: "pro" },
      ] as const;
      const wordLayers = [paceWord, formatWord, planWord];
      const materialCurrentEdges = [
        paceMaterialEdge,
        formatMaterialEdge,
        planMaterialEdge,
      ];
      const tierFromIndex = (index: number): V7Tier => (
        index === 1 ? "standard" : index === 2 ? "pro" : "basic"
      );
      const indexFromTier = (tier: V7Tier): 0 | 1 | 2 => (
        tier === "standard" ? 1 : tier === "pro" ? 2 : 0
      );
      let contractStateCache: Readonly<{ referenceTime: number; state: V7SequenceState }> | null = null;
      const contractStateAt = (referenceTime: number) => {
        if (contractStateCache?.referenceTime === referenceTime) return contractStateCache.state;
        const phoneStateOpacities = phoneUiStates.map((state) => {
          const opacity = Number.parseFloat(String(gsap.getProperty(state, "opacity")));
          return Number.isFinite(opacity) ? gsap.utils.clamp(0, 1, opacity) : 0;
        }) as [number, number, number];
        const browserProfile = shouldUseIOSPerformanceMode()
          ? "ios-webkit" as const
          : useSafariMascotVideo
            ? "desktop-safari" as const
            : "standard" as const;
        const state = resolveV7SequenceOrThrow(createV7SequenceInput(
          { kind: "reference-time", seconds: referenceTime },
          {
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              pixelRatio: window.devicePixelRatio || 1,
            },
            motion: reducedMotion ? "reduced" : "normal",
            document: document.visibilityState === "visible" ? "visible" : "hidden",
            browserProfile,
            observations: {
              currentPhoneVisualTier: tierFromIndex(activePhoneTierRef.current),
              phoneStateOpacities,
              headlineVisible: true,
              phoneVisible: true,
              atmosphereVisible: true,
              mascotVisible: true,
              footerVisible: false,
              application: { kind: "closed" },
              proPhoneTrack: proPlaybackPhaseRef.current === "intro" ? "intro" : "loop",
            },
          },
        ));
        sequenceContractStateRef.current = state;
        contractStateCache = { referenceTime, state };
        return state;
      };
      const siteAssemblyFacets = Array.from(siteAssembly.children) as HTMLElement[];
      const loaderPanel = preinit.querySelector<HTMLElement>(`.${styles.loaderPanel}`);
      const loaderFoldMark = preinit.querySelector<HTMLElement>(`.${styles.loaderFoldMark}`);
      const preinitHeader = preinit.querySelector<HTMLElement>(`.${styles.preinitHeader}`);

      const setHeadlineActiveTier = (tier: string) => {
        if (headlineRig.dataset.activeTier !== tier) headlineRig.dataset.activeTier = tier;
      };
      const resetMaterialCurrentLayers = () => {
        wordLayers.forEach((word, index) => {
          word.style.opacity = "0";
          word.style.visibility = "hidden";
          word.style.clipPath = MATERIAL_CURRENT_EMPTY_CLIP;
          materialCurrentEdges[index].style.opacity = "0";
          materialCurrentEdges[index].style.transform = "translateX(-150%)";
        });
      };
      const setMaterialCurrentHold = (index: number) => {
        resetMaterialCurrentLayers();
        const word = wordLayers[index];
        const tier = openingWordSequence[index]?.tier ?? "basic";
        word.style.opacity = "1";
        word.style.visibility = "visible";
        word.style.clipPath = MATERIAL_CURRENT_FULL_CLIP;
        headlineRig.dataset.playingTiers = tier;
        stage.dataset.openingMaterialPhase = `hold-${tier}`;
        delete stage.dataset.openingMaterialProgress;
      };
      const syncMaterialCurrent = (referenceTime: number) => {
        if (V7_SEQUENCE_CONTRACT_ROLLOUT.dataAttributeAuthority) {
          const material = contractStateAt(referenceTime).material;
          if (material.kind === "hold") {
            setMaterialCurrentHold(indexFromTier(material.tier));
            return;
          }

          resetMaterialCurrentLayers();
          const outgoingIndex = indexFromTier(material.outgoing);
          const incomingIndex = indexFromTier(material.incoming);
          const outgoingWord = wordLayers[outgoingIndex];
          const incomingWord = wordLayers[incomingIndex];
          outgoingWord.style.opacity = "1";
          outgoingWord.style.visibility = "visible";
          outgoingWord.style.clipPath = material.clip.outgoingClip;
          incomingWord.style.opacity = "1";
          incomingWord.style.visibility = "visible";
          incomingWord.style.clipPath = material.clip.incomingClip;
          for (const index of [outgoingIndex, incomingIndex]) {
            materialCurrentEdges[index].style.opacity = String(material.clip.edgeOpacity);
            materialCurrentEdges[index].style.transform = `translateX(${material.clip.edgeXPercent}%)`;
          }
          headlineRig.dataset.playingTiers = material.playingTiers.join(" ");
          stage.dataset.openingMaterialPhase = material.phaseAttribute;
          stage.dataset.openingMaterialProgress = material.progress.toFixed(5);
          return;
        }
        const handoff = MATERIAL_CURRENT_HANDOFFS.find(
          ({ start, end }) => referenceTime > start && referenceTime < end,
        );

        if (!handoff) {
          const holdIndex = referenceTime <= MATERIAL_CURRENT_HANDOFFS[0].start
            ? 0
            : referenceTime <= MATERIAL_CURRENT_HANDOFFS[1].start
              ? 1
              : 2;
          setMaterialCurrentHold(holdIndex);
          return;
        }

        resetMaterialCurrentLayers();
        const progress = (referenceTime - handoff.start) / (handoff.end - handoff.start);
        const clipPair = materialCurrentClipPair(progress);
        const outgoingWord = wordLayers[handoff.outgoingIndex];
        const incomingWord = wordLayers[handoff.incomingIndex];

        outgoingWord.style.opacity = "1";
        outgoingWord.style.visibility = "visible";
        outgoingWord.style.clipPath = clipPair.outgoingClip;
        incomingWord.style.opacity = "1";
        incomingWord.style.visibility = "visible";
        incomingWord.style.clipPath = clipPair.incomingClip;

        for (const index of [handoff.outgoingIndex, handoff.incomingIndex]) {
          materialCurrentEdges[index].style.opacity = String(clipPair.edgeOpacity);
          materialCurrentEdges[index].style.transform = `translateX(${clipPair.edgeXPercent}%)`;
        }

        headlineRig.dataset.playingTiers = `${handoff.outgoingTier} ${handoff.incomingTier}`;
        stage.dataset.openingMaterialPhase = `${handoff.outgoingTier}-to-${handoff.incomingTier}`;
        stage.dataset.openingMaterialProgress = progress.toFixed(5);
      };
      const syncActiveOpeningWord = (referenceTime: number) => {
        if (V7_SEQUENCE_CONTRACT_ROLLOUT.dataAttributeAuthority) {
          const openingHeadline = contractStateAt(referenceTime).tiers.openingHeadline;
          setHeadlineActiveTier(openingHeadline.activeTier);
          stage.dataset.openingTier = openingHeadline.activeWord;
          return;
        }
        const firstMidpoint = (
          MATERIAL_CURRENT_HANDOFFS[0].start + MATERIAL_CURRENT_HANDOFFS[0].end
        ) / 2;
        const secondMidpoint = (
          MATERIAL_CURRENT_HANDOFFS[1].start + MATERIAL_CURRENT_HANDOFFS[1].end
        ) / 2;
        const activeIndex = referenceTime < firstMidpoint ? 0 : referenceTime < secondMidpoint ? 1 : 2;
        const activeWord = openingWordSequence[activeIndex];
        setHeadlineActiveTier(activeWord.tier);
        stage.dataset.openingTier = activeWord.name;
      };
      const setAnimatedControlsInteractive = (elements: HTMLElement[], interactive: boolean) => {
        elements.forEach((element) => {
          element.inert = !interactive;
          element.tabIndex = interactive ? 0 : -1;
        });
      };
      const syncVisibleAnimatedControls = (elements: HTMLElement[], sceneActive: boolean) => {
        elements.forEach((element) => {
          const opacity = Number.parseFloat(String(gsap.getProperty(element, "opacity")));
          const scale = Number.parseFloat(String(gsap.getProperty(element, "scale")));
          if (V7_SEQUENCE_CONTRACT_ROLLOUT.dataAttributeAuthority) {
            const availability = animatedControlAvailability({
              sceneActive,
              computedOpacity: opacity,
              computedScale: scale,
            });
            setAnimatedControlsInteractive([element], availability.interactive);
            return;
          }
          const visiblyAvailable = sceneActive
            && Number.isFinite(opacity)
            && opacity >= 0.12
            && (!Number.isFinite(scale) || scale >= 0.68);
          setAnimatedControlsInteractive([element], visiblyAvailable);
        });
      };
      const syncAnimatedControlAvailability = (referenceTime: number) => {
        void referenceTime;
        syncVisibleAnimatedControls(cards, true);
        syncVisibleAnimatedControls(proofCardElements, true);
      };
      const tierAtReferenceTime = (referenceTime: number): 0 | 1 | 2 => {
        if (referenceTime < shiftedPhoneTime(13.52)) return 0;
        if (referenceTime < shiftedPhoneTime(14.18)) return 1;
        if (referenceTime < shiftedPhoneTime(18.65)) return 2;
        if (referenceTime < 25.54) return 0;
        if (referenceTime < 28.05) return 1;
        return 2;
      };
      const syncActiveTierState = (referenceTime: number) => {
        const nextTier = V7_SEQUENCE_CONTRACT_ROLLOUT.reactPresentationAuthority
          ? indexFromTier(contractStateAt(referenceTime).tiers.reactTariffTier)
          : tierAtReferenceTime(referenceTime);
        if (activeTierStateRef.current === nextTier) return;
        activeTierStateRef.current = nextTier;
        setActiveTierIndex(nextTier);
      };
      const syncProTierAtmospherePhase = (referenceTime: number) => {
        const contractAtmosphere = V7_SEQUENCE_CONTRACT_ROLLOUT.dataAttributeAuthority
          ? contractStateAt(referenceTime).presentation.atmosphere
          : null;
        const atmosphereWarm = contractAtmosphere?.warm ?? (
          referenceTime >= PRO_ATMOSPHERE_PRELOAD_START
          && referenceTime < PRO_ATMOSPHERE_END
        );
        const atmosphereActive = contractAtmosphere?.active ?? (
          referenceTime >= PRO_ATMOSPHERE_VISIBLE_START
          && referenceTime < PRO_ATMOSPHERE_END
        );
        const nextWarmValue = atmosphereWarm ? "true" : "false";
        const nextValue = atmosphereActive ? "true" : "false";
        if (stage.dataset.proAtmosphereWarm !== nextWarmValue) {
          stage.dataset.proAtmosphereWarm = nextWarmValue;
        }
        if (stage.dataset.proAtmosphereActive !== nextValue) {
          stage.dataset.proAtmosphereActive = nextValue;
        }
      };
      const syncProProofWallHeaderVisibility = (referenceTime: number) => {
        const proofWallActive = V7_SEQUENCE_CONTRACT_ROLLOUT.dataAttributeAuthority
          ? contractStateAt(referenceTime).presentation.proofWallActive
          : (
              referenceTime >= PRO_PROOF_WALL_ACTIVE_START
              && referenceTime < PRO_PROOF_WALL_ACTIVE_END
            );
        const nextValue = proofWallActive ? "true" : "false";
        if (stage.dataset.proProofWallActive !== nextValue) {
          stage.dataset.proProofWallActive = nextValue;
        }
      };
      const syncStandardPhonePreroll = (referenceTime: number) => {
        const shouldPreroll = V7_SEQUENCE_CONTRACT_ROLLOUT.dataAttributeAuthority
          ? contractStateAt(referenceTime).presentation.standardPhonePreroll
          : STANDARD_PHONE_PREROLL_WINDOWS.some(
              ({ start, end }) => referenceTime >= start && referenceTime < end,
            );
        const nextValue = shouldPreroll ? "true" : "false";
        if (stage.dataset.standardPhonePreroll !== nextValue) {
          stage.dataset.standardPhonePreroll = nextValue;
        }
      };

      const markReady = () => {
        runtime.inert = false;
        stage.dataset.motionReady = "true";
        stage.dataset.motionMode = reducedMotion ? "reduced" : "normal";
      };

      const completeSiteReveal = () => {
        stage.dataset.revealState = "complete";
        gsap.set(runtime, {
          autoAlpha: 1,
          clearProps: "clipPath",
        });
        gsap.set([preinit, siteAssembly], {
          autoAlpha: 0,
          visibility: "hidden",
        });
      };

      const completeStaticReveal = (reason: string) => {
        stage.dataset.revealMode = reason;
        setLoadingProgress(100);
        markReady();
        completeSiteReveal();
      };

      const runSiteReveal = () => new Promise<void>((resolve) => {
        stage.dataset.revealState = "assembling";
        stage.dataset.revealBeat = "source";
        markReady();
        const sourceRect = loaderFoldMark?.getBoundingClientRect();
        const sourceCenterX = (sourceRect?.left ?? window.innerWidth * 0.72) + (sourceRect?.width ?? 0) / 2;
        const sourceCenterY = (sourceRect?.top ?? window.innerHeight * 0.5) + (sourceRect?.height ?? 0) / 2;
        const sourceOffsetX = sourceCenterX - window.innerWidth / 2;
        const sourceOffsetY = sourceCenterY - window.innerHeight / 2;
        const sourceScale = gsap.utils.clamp(
          0.16,
          0.4,
          (sourceRect?.width ?? window.innerWidth * 0.3) / Math.max(window.innerWidth, 1),
        );
        siteRevealTimeline = gsap.timeline({
          onComplete: () => {
            delete stage.dataset.revealBeat;
            completeSiteReveal();
            resolve();
          },
        });

        siteRevealTimeline
          .set(siteAssembly, { autoAlpha: 1, visibility: "visible" })
          .set(siteAssemblyFacets, {
            autoAlpha: 1,
            x: (index) => sourceOffsetX + [-18, 20, -12, 16, -7, 10][index],
            y: (index) => sourceOffsetY + [-14, -8, 14, 10, -20, 18][index],
            scale: (index) => sourceScale * (0.9 + (index % 3) * 0.08),
            rotationX: (index) => [-48, 54, -66, 61, -38, 44][index],
            rotationY: (index) => [-62, 67, -34, 38, 58, -61][index],
            rotationZ: (index) => [-4, 3.2, -2.4, 2.7, -5.2, 4.6][index],
            transformPerspective: 1200,
            transformOrigin: `${sourceCenterX}px ${sourceCenterY}px`,
          })
          .set(runtime, {
            autoAlpha: 1,
            clipPath: "polygon(47% 45%, 54% 40%, 62% 49%, 57% 61%, 43% 60%, 38% 51%)",
          })
          .to(loaderFoldMark, {
            rotationX: -7,
            rotationY: 10,
            z: 26,
            transformPerspective: 900,
            transformOrigin: "50% 50%",
            duration: 0.18,
            ease: "power2.out",
          }, 0)
          .call(() => { stage.dataset.revealBeat = "planes"; }, [], 0.1)
          .to(siteAssemblyFacets, {
            x: 0,
            y: 0,
            scale: 1,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            duration: 0.48,
            ease: "expo.out",
            stagger: { each: 0.035, from: "center" },
          }, 0.1)
          .to(loaderPanel, {
            autoAlpha: 0,
            rotationX: -26,
            y: -14,
            transformPerspective: 900,
            transformOrigin: "50% 0%",
            duration: 0.24,
            ease: "power2.in",
          }, 0.2)
          .to(preinitHeader, {
            autoAlpha: 0,
            duration: 0.18,
            ease: "power1.in",
          }, 0.3)
          .to(loaderFoldMark, {
            autoAlpha: 0,
            rotationX: -18,
            rotationY: 22,
            z: -36,
            duration: 0.2,
            ease: "power2.in",
          }, 0.4)
          .to(preinit, {
            autoAlpha: 0,
            duration: 0.14,
            ease: "none",
          }, 0.48)
          .call(() => { stage.dataset.revealBeat = "surface"; }, [], 0.48)
          .to(runtime, {
            clipPath: "polygon(13% 0%, 82% 2%, 100% 35%, 94% 89%, 63% 100%, 0% 92%, 3% 29%)",
            duration: 0.44,
            ease: "power3.inOut",
          }, 0.5)
          .to(runtime, {
            clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
            duration: 0.36,
            ease: "expo.out",
          }, 0.82)
          .to(siteAssemblyFacets, {
            autoAlpha: 0,
            xPercent: (index) => [-18, 17, -14, 16, -9, 10][index] ?? 0,
            yPercent: (index) => [-10, -8, 15, 13, -18, 19][index] ?? 0,
            rotationX: (index) => [-14, 18, -72, 67, -28, 31][index] ?? 0,
            rotationY: (index) => [-76, 72, -18, 21, 58, -62][index] ?? 0,
            rotationZ: (index) => [-2.5, 2.1, -1.6, 1.9, -4, 3.6][index] ?? 0,
            duration: 0.72,
            ease: "expo.inOut",
            stagger: { each: 0.035, from: "center" },
          }, 0.58)
          .call(() => { stage.dataset.revealBeat = "content"; }, [], 0.94);
      });

      const waitForSceneAssets = () => prepareLiquidScene(stage, {
        imageUrls: useLiquidModel ? initialImageUrls.filter(url => !url.includes("/mascot/")) : initialImageUrls,
        needsModel: useLiquidModel,
        signal: readinessAbort.signal,
        onProgress: setLoadingProgress,
        onSlow: () => { if (!disposed) setLoadingProblem("slow"); },
      }).then(degraded => {
        if (!disposed) setLoadingProblem(null);
        return degraded;
      });
      const showLoadingError = () => { if (!disposed) setLoadingProblem("error"); };

      if (reducedMotion) {
        mascot.dataset.referenceTime = "0";
        video?.pause();
        try { if (video) video.currentTime = 0; } catch { /* metadata may not be ready */ }
        gsap.set(runtime, { autoAlpha: 0 });
        gsap.set(openingField, { autoAlpha: 1, clipPath: "inset(0 0 0 0)" });
        gsap.set(planes, { autoAlpha: 1 });
        gsap.set(headlineRig, { xPercent: -50, autoAlpha: 1, scale: 1 });
        gsap.set(headlineHtml, { autoAlpha: 1 });
        gsap.set(headlineSvg, { autoAlpha: 0 });
        gsap.set(wordLayers, {
          xPercent: -50,
          yPercent: 0,
          scale: 1,
          scaleY: 1,
          rotationX: 0,
          filter: "none",
        });
        syncMaterialCurrent(0);
        syncActiveOpeningWord(0);
        gsap.set(openingCta, { autoAlpha: 1, y: 0 });
        gsap.set(mascot, {
          xPercent: -50,
          yPercent: -50,
          y: window.innerHeight * (window.innerWidth < 900 ? 0.12 : 0.16),
          scale: window.innerWidth < 900 ? 0.34 : 0.25,
          autoAlpha: 1,
        });
        gsap.set([secondCta, finalCta], { autoAlpha: 0, xPercent: -50 });
        gsap.set(
          [phone, outline, blockScene, ...cards, violetField, secondHeadline, blueField,
            coralField, coralHeadline, lessonObject, proofWall, navyField, finalCampaign],
          { autoAlpha: 0 },
        );
        setAnimatedControlsInteractive(cards, false);
        setAnimatedControlsInteractive(proofCardElements, false);
        void waitForSceneAssets().then(() => {
          if (!disposed) completeStaticReveal("reduced");
        }).catch(showLoadingError);
        return;
      }

      const isMobile = window.innerWidth < 900;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const compactLandscape = isMobile && viewportHeight <= 550;
      const headlineScale = isMobile ? 1.95 : 2.2;
      const compactOpening = viewportWidth < 1100;
      const openingMascotY = viewportHeight * (isMobile ? 0.39 : compactOpening ? 0.42 : 0.46);
      const openingMascotScale = isMobile ? 0.62 : compactOpening ? 0.62 : 0.68;
      const stablePhoneY = viewportHeight * -0.026;
      const phoneHeight = phone.offsetHeight;
      const hiddenBelow = viewportHeight * 1.04;
      const hiddenAbove = viewportHeight * -1.08;
      const settledMascotScale = isMobile ? 0.34 : 0.245;
      const attachedMascotScale = isMobile ? 0.33 : 0.235;
      const preferredSettledMascotY = viewportHeight * (isMobile ? compactLandscape ? 0.15 : 0.18 : 0.065);
      // The bottom-origin rig's registration point includes half its unscaled
      // height. Constrain that point, instead of guessing offsets per viewport.
      const mascotRegistrationY = viewportHeight / 2 + mascot.offsetHeight / 2;
      const fitMascotY = (desiredY: number, bottom: number) => useLiquidModel
        ? Math.min(desiredY, bottom - mascotRegistrationY) : desiredY;
      const settledMascotY = fitMascotY(preferredSettledMascotY, viewportHeight - 24);
      const openingSettledMascotY = settledMascotY;
      const openingCue = (
        cue: keyof typeof V7_GSAP_SECTION_CUE_PLANS.openingHeadline,
        legacyReferenceTime: number,
      ) => selectV7GsapCueAt(
        "openingHeadline",
        cue,
        legacyReferenceTime,
        V7_SEQUENCE_CONTRACT_ROLLOUT.gsapOpeningHeadline,
      );
      const basicCue = (
        cue: keyof typeof V7_GSAP_SECTION_CUE_PLANS.basicSequence,
        legacyReferenceTime: number,
      ) => selectV7GsapCueAt(
        "basicSequence",
        cue,
        legacyReferenceTime,
        V7_SEQUENCE_CONTRACT_ROLLOUT.gsapBasicSequence,
      );
      const standardCue = (
        cue: keyof typeof V7_GSAP_SECTION_CUE_PLANS.standardSequence,
        legacyReferenceTime: number,
      ) => selectV7GsapCueAt(
        "standardSequence",
        cue,
        legacyReferenceTime,
        V7_SEQUENCE_CONTRACT_ROLLOUT.gsapStandardSequence,
      );
      const phoneMaterialCue = (
        cue: keyof typeof V7_GSAP_SECTION_CUE_PLANS.phoneMaterial,
        legacyReferenceTime: number,
      ) => selectV7GsapCueAt(
        "phoneMaterial",
        cue,
        legacyReferenceTime,
        V7_SEQUENCE_CONTRACT_ROLLOUT.gsapPhoneMaterial,
      );
      const proEntryCue = (
        cue: keyof typeof V7_GSAP_SECTION_CUE_PLANS.proEntryAtmosphere,
        legacyReferenceTime: number,
      ) => selectV7GsapCueAt(
        "proEntryAtmosphere",
        cue,
        legacyReferenceTime,
        V7_SEQUENCE_CONTRACT_ROLLOUT.gsapProEntryAtmosphere,
      );
      const proofCue = (
        cue: keyof typeof V7_GSAP_SECTION_CUE_PLANS.proProofApplication,
        legacyReferenceTime: number,
      ) => selectV7GsapCueAt(
        "proProofApplication",
        cue,
        legacyReferenceTime,
        V7_SEQUENCE_CONTRACT_ROLLOUT.gsapProProofApplication,
      );
      const closingCue = (
        cue: keyof typeof V7_GSAP_SECTION_CUE_PLANS.footerClosing,
        legacyReferenceTime: number,
      ) => selectV7GsapCueAt(
        "footerClosing",
        cue,
        legacyReferenceTime,
        V7_SEQUENCE_CONTRACT_ROLLOUT.gsapFooterClosing,
      );
      const sensitiveCue = (
        cue: keyof typeof V7_GSAP_SECTION_CUE_PLANS.mascotSafariLifecycle,
        legacyReferenceTime: number,
      ) => selectV7GsapCueAt(
        "mascotSafariLifecycle",
        cue,
        legacyReferenceTime,
        V7_SEQUENCE_CONTRACT_ROLLOUT.gsapMascotSafariLifecycle,
      );
      const mascotHandoffStart = sensitiveCue("handoffStart", 29.32);
      const mascotHandoffSeam = sensitiveCue("handoffSeam", 29.45);
      const mascotHandoffEnd = sensitiveCue("handoffEnd", 29.91);
      const mascotHandoffEndY = -viewportHeight * 0.16;
      const mascotHandoffStartProgress = scrollProgressAtReferenceTime(mascotHandoffStart);
      const mascotHandoffSeamProgress = scrollProgressAtReferenceTime(mascotHandoffSeam);
      const mascotHandoffEndProgress = scrollProgressAtReferenceTime(mascotHandoffEnd);
      const mascotHandoffSeamRatio = (
        mascotHandoffSeamProgress - mascotHandoffStartProgress
      ) / (
        mascotHandoffEndProgress - mascotHandoffStartProgress
      );
      const smootherStep = (value: number) => {
        const progress = gsap.utils.clamp(0, 1, value);
        return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
      };
      const mascotHandoffSeamCurve = smootherStep(mascotHandoffSeamRatio);
      const mascotHandoffSeamY = gsap.utils.interpolate(
        settledMascotY,
        mascotHandoffEndY,
        mascotHandoffSeamCurve,
      );
      const mascotHandoffBeforeEase = (progress: number) => (
        smootherStep(mascotHandoffSeamRatio * progress) / mascotHandoffSeamCurve
      );
      const mascotHandoffAfterEase = (progress: number) => (
        (
          smootherStep(
            mascotHandoffSeamRatio + (1 - mascotHandoffSeamRatio) * progress,
          ) - mascotHandoffSeamCurve
        ) / (1 - mascotHandoffSeamCurve)
      );
      const phoneMascotY = {
        at10: viewportHeight * (isMobile ? 0.16 : 0.05),
        at1025: viewportHeight * (isMobile ? 0.16 : 0.052),
        at1050: viewportHeight * (isMobile ? 0.161 : 0.054),
        at1075: viewportHeight * (isMobile ? 0.162 : 0.056),
        at1100: viewportHeight * (isMobile ? 0.163 : 0.058),
        at1150: viewportHeight * (isMobile ? 0.164 : 0.06),
        at1450: viewportHeight * (isMobile ? 0.17 : 0.065),
      };
      const phoneAnchorRatio = isMobile
        ? {
            initial: -0.443,
            at1050: 0.004,
            at1075: 0.33,
            at1100: 0.48,
            at1150: 0.57,
            settled: 0.592,
            longHold: 0.578,
            materialEarly: 0.519,
            materialMiddle: -0.023,
            materialHigh: -0.185,
            materialPeak: -0.198,
            materialHold: -0.178,
          }
        : {
            initial: -0.36,
            at1050: 0.025,
            at1075: 0.312,
            at1100: 0.44,
            at1150: 0.519,
            settled: 0.52,
            longHold: 0.52,
            materialEarly: 0.473,
            materialMiddle: 0,
            materialHigh: -0.14,
            materialPeak: -0.154,
            materialHold: -0.132,
          };
      const materialMascotY = {
        early: viewportHeight * (isMobile ? 0.126 : 0.018),
        middle: viewportHeight * (isMobile ? -0.275 : -0.383),
        high: viewportHeight * (isMobile ? -0.395 : -0.503),
        peak: viewportHeight * (isMobile ? -0.405 : -0.515),
        hold: viewportHeight * (isMobile ? -0.39 : -0.496),
      };
      const blockHeadlineTop = blockScene.offsetTop - blockScene.offsetHeight / 2;
      const blockHeadlineBottom = blockScene.offsetTop + blockScene.offsetHeight / 2;
      const materialMascotBottom = mascotRegistrationY + materialMascotY.hold;
      const readableHeadlineY = isMobile && useLiquidModel ? gsap.utils.clamp(
        0,
        Math.max(0, viewportHeight - 24 - blockHeadlineBottom),
        materialMascotBottom + 16 - blockHeadlineTop,
      ) : 0;
      const maskLines = Array.from(
        headlineSvg.querySelectorAll<SVGTextElement>(`.${styles.headlineMaskLine}`),
      );
      const metricLines = Array.from(
        headlineSvg.querySelectorAll<SVGTextElement>(`.${styles.headlineMetricLine}`),
      );
      const metricBoxes = Array.from(
        headlineSvg.querySelectorAll<SVGRectElement>(`.${styles.headlineMetricBox}`),
      );
      const floodLines = Array.from(
        headlineFlood.querySelectorAll<SVGTextElement>(`.${styles.headlineFloodLine}`),
      );
      const baseLines = Array.from(
        headlineBase.querySelectorAll<HTMLElement>(`.${styles.headlineMeasureLine}`),
      );
      const medallionElements = Array.from(
        medallionRoot.querySelectorAll<SVGGElement>(`.${styles.medallion}`),
      );
      const planeElements = Array.from(planes.children) as HTMLElement[];
      const ghostCells = Array.from(
        blockGrid.querySelectorAll<SVGRectElement>(`.${styles.blockCell}`),
      );
      const violetMedallionElements = Array.from(violetMedallions.querySelectorAll<HTMLElement>("[data-utility] > i"));
      const measureHeadline = () => {
        const previousTransform = {
          ...transformState(headlineRig),
          xPercent: numericGsapProperty(headlineRig, "xPercent"),
          yPercent: numericGsapProperty(headlineRig, "yPercent"),
        };
        const widestWord = Math.max(...wordLayers.map((word) => word.offsetWidth));
        wordViewport.style.setProperty("--dynamic-word-width", `${Math.ceil(widestWord)}px`);
        gsap.set(headlineRig, { xPercent: -50, x: 0, y: 0, scale: 1 });
        const rigRect = headlineRig.getBoundingClientRect();
        headlineSvg.setAttribute("viewBox", `0 0 ${rigRect.width} ${rigRect.height}`);
        reelCanvas.setAttribute(
          "transform",
          `scale(${rigRect.width / 1200} ${rigRect.height / 400})`,
        );
        maskLines.forEach((line, index) => {
          const source = baseLines[index];
          const metricLine = metricLines[index];
          const floodLine = floodLines[index];
          const metricBox = metricBoxes[index];
          if (!source || !metricLine || !floodLine || !metricBox) return;
          const sourceRect = source.getBoundingClientRect();
          const computed = window.getComputedStyle(source);
          const localLeft = sourceRect.left - rigRect.left;
          const localTop = sourceRect.top - rigRect.top;
          metricBox.setAttribute("x", String(localLeft));
          metricBox.setAttribute("y", String(localTop));
          metricBox.setAttribute("width", String(sourceRect.width));
          metricBox.setAttribute("height", String(sourceRect.height));
          for (const target of [line, metricLine, floodLine]) {
            target.removeAttribute("transform");
            target.setAttribute("x", String(localLeft + sourceRect.width / 2));
            target.setAttribute("y", String(localTop + sourceRect.height / 2));
            target.setAttribute("text-anchor", "middle");
            target.setAttribute("dominant-baseline", "central");
            target.setAttribute("font-family", computed.fontFamily);
            target.setAttribute("font-size", computed.fontSize);
            target.setAttribute("font-weight", computed.fontWeight);
            target.setAttribute("letter-spacing", computed.letterSpacing);
            target.setAttribute("textLength", String(sourceRect.width));
            target.setAttribute("lengthAdjust", "spacingAndGlyphs");
          }
          let rendered = metricLine.getBoundingClientRect();
          if (rendered.width > 0) {
            const correctedTextLength = sourceRect.width * (sourceRect.width / rendered.width);
            for (const target of [line, metricLine, floodLine]) {
              target.setAttribute("textLength", String(correctedTextLength));
            }
            rendered = metricLine.getBoundingClientRect();
          }
          const translateX =
            sourceRect.left + sourceRect.width / 2 - (rendered.left + rendered.width / 2);
          const translateY =
            sourceRect.top + sourceRect.height / 2 - (rendered.top + rendered.height / 2);
          for (const target of [line, metricLine, floodLine]) {
            target.setAttribute("transform", `translate(${translateX} ${translateY})`);
          }
        });
        gsap.set(headlineRig, previousTransform);
      };

      const setInitialState = () => {
        mascot.dataset.referenceTime = "0";
        contractStateCache = null;
        // Initial geometry can be prepared while the model downloads, but only
        // the readiness/reveal controller may expose the interactive scene.
        gsap.set(runtime, { autoAlpha: stage.dataset.motionReady === "true" ? 1 : 0 });
        gsap.set(openingField, {
          autoAlpha: 1,
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        });
        gsap.set([planeElements[0], planeElements[3]], {
          xPercent: 0,
          yPercent: 0,
          autoAlpha: 0.3,
        });
        gsap.set([planeElements[1], planeElements[2]], {
          xPercent: (index) => index ? -10 : 10,
          yPercent: (index) => index ? 10 : -7,
          autoAlpha: 0.28,
        });
        gsap.set(headlineRig, {
          xPercent: -50,
          yPercent: 0,
          x: 0,
          y: viewportHeight * 0.025,
          scale: 1,
          rotation: 0,
          autoAlpha: 1,
          transformOrigin: "50% 62%",
        });
        gsap.set(headlineHtml, {
          autoAlpha: 1,
          y: 0,
          clipPath: "inset(0% 0% 0% 0%)",
        });
        gsap.set(headlineSvg, { autoAlpha: 0 });
        gsap.set(wordLayers, {
          xPercent: -50,
          yPercent: 0,
          scale: 1,
          scaleY: 1,
          rotationX: 0,
          filter: "none",
        });
        syncMaterialCurrent(0);
        syncActiveOpeningWord(0);
        gsap.set(openingCta, { autoAlpha: 1, y: 0 });
        gsap.set(medallionElements, {
          autoAlpha: 0,
          scale: 1.35,
          rotation: (index) => index % 2 ? 7 : -8,
          transformOrigin: "50% 50%",
        });
        gsap.set(headlineFlood, { autoAlpha: 0 });
        gsap.set(floodLines, { strokeWidth: 0 });
        gsap.set(phone, {
          xPercent: -50,
          yPercent: -50,
          x: 0,
          y: hiddenBelow,
          scale: 1,
          rotation: 0,
          rotationY: 0,
          transformPerspective: 1200,
          autoAlpha: 1,
        });
        gsap.set(phoneBody, {
          backgroundColor: phoneColor,
          borderColor: phoneBorderColor,
          boxShadow: `0 30px 96px ${phoneShadowColor}`,
        });
        gsap.set(phoneMaterial, {
          clipPath: "polygon(0 100%, 0 98%, 4% 100%, 0 100%, 0 100%, 0 100%)",
        });
        gsap.set(phoneUiStates, { autoAlpha: 0 });
        gsap.set(phoneUiStates[0], { autoAlpha: 1 });
        activeTierStateRef.current = 0;
        setActiveTierIndex((currentTier) => currentTier === 0 ? currentTier : 0);
        gsap.set(phoneAnchor, {
          xPercent: -50,
          y: phoneHeight * phoneAnchorRatio.initial,
        });
        gsap.set(outline, { xPercent: -50, yPercent: -50, y: stablePhoneY, autoAlpha: 0 });
        gsap.set(outlinePath, { strokeDasharray: 1, strokeDashoffset: 1 });
        gsap.set(blockScene, { xPercent: -50, yPercent: -50, y: readableHeadlineY, autoAlpha: 0 });
        gsap.set(ghostCells, { autoAlpha: 0.04, scaleY: 0.18, transformOrigin: "50% 100%" });
        gsap.set(sayClipRect, { attr: { y: 350, height: 0 } });
        cards.forEach((card, index) => {
          const side = index < 2 ? -1 : 1;
          gsap.set(card, {
            x: side * viewportWidth * (isMobile ? 0.18 : 0.25),
            y: viewportHeight * (0.72 + (index % 2) * 0.18),
            rotation: side * (index % 2 ? 9 : 6),
            rotationY: isMobile ? 0 : side * -24,
            rotationX: isMobile ? 0 : 12,
            transformPerspective: 1100,
            scale: isMobile ? 0.86 : 0.82,
            autoAlpha: 0,
          });
        });
        gsap.set(mascot, {
          xPercent: -50,
          yPercent: -50,
          x: 0,
          y: openingMascotY,
          scale: openingMascotScale,
          rotation: 1.8,
          autoAlpha: 1,
          transformOrigin: "50% 100%",
        });
        gsap.set(cue, { autoAlpha: 1 });
        gsap.set([violetField, blueField, coralField, navyField], {
          yPercent: 100,
          autoAlpha: 1,
        });
        gsap.set(violetMedallionElements, {
          y: viewportHeight * 0.72,
          rotation: (index) => index % 2 ? 14 : -12,
          autoAlpha: 0,
        });
        gsap.set([secondHeadline, finalCampaign], { autoAlpha: 0, y: 46 });
        gsap.set(coralHeadline, {
          autoAlpha: 0,
          y: 46,
          scale: 1,
          transformOrigin: "50% 50%",
        });
        gsap.set([secondCta, finalCta], { autoAlpha: 0, xPercent: -50, y: 18 });
        gsap.set(lessonObject, {
          autoAlpha: 0,
          y: viewportHeight * 0.12,
          rotation: -3,
          rotationY: -18,
          scale: 0.84,
          transformPerspective: 1100,
          transformOrigin: "50% 50%",
        });
        gsap.set(lessonGlint, { xPercent: -160, autoAlpha: 0 });
        gsap.set(proTierAtmosphere, { autoAlpha: 0 });
        gsap.set(proFocalConvergence, { autoAlpha: 0 });
        gsap.set(proofWall, { autoAlpha: 0, x: viewportWidth * 0.18 });
        gsap.set(proofCardElements, { autoAlpha: 0, y: viewportHeight * 0.3, scale: 0.88 });
        syncAnimatedControlAvailability(0);
        syncProTierAtmospherePhase(0);
        syncProProofWallHeaderVisibility(0);
        syncStandardPhonePreroll(0);
      };

      measureHeadline();
      setInitialState();
      ScrollTrigger.addEventListener("refreshInit", measureHeadline);

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        paused: true,
        onUpdate: () => {
          const referenceTime = timeline.time();
          if (viewportMatchesLayout()) layoutReferenceTime = referenceTime;
          mascot.dataset.referenceTime = referenceTime.toFixed(4);
          contractStateCache = null;
          syncActiveOpeningWord(referenceTime);
          syncMaterialCurrent(referenceTime);
          syncAnimatedControlAvailability(referenceTime);
          syncActiveTierState(referenceTime);
          syncProTierAtmospherePhase(referenceTime);
          syncProProofWallHeaderVisibility(referenceTime);
          syncStandardPhonePreroll(referenceTime);
        },
      });
      timelineRef.current = timeline;

      timeline
        .to({}, {
          duration: V7_SEQUENCE_CONTRACT_ROLLOUT.referenceTimeAuthority
            ? V7_REFERENCE_PINNED_END
            : REFERENCE_PINNED_END,
        }, openingCue("sequenceStart", 0))
        .to(openingField, {
          clipPath: "polygon(0 0%, 100% 0%, 100% 100%, 0 100%)",
          duration: 0.55,
          ease: "power2.inOut",
        }, openingCue("openingFieldIn", 0))
        .to([planeElements[1], planeElements[2]], {
          xPercent: 0,
          yPercent: 0,
          autoAlpha: 0.62,
          duration: 0.55,
          stagger: 0.06,
          ease: "power2.inOut",
        }, openingCue("openingPlanesIn", 0))
        .to(headlineHtml, {
          autoAlpha: 1,
          y: 0,
          clipPath: "inset(0% 0% 0% 0%)",
          duration: 0.53,
          ease: "power2.inOut",
        }, openingCue("headlineIn", 0.32))
        .to(openingCta, {
          autoAlpha: 1,
          y: 0,
          duration: 0.32,
          ease: "power2.out",
        }, openingCue("openingCtaIn", 0.68))
        .to(mascot, {
          y: viewportHeight * (isMobile ? 0.18 : 0.2),
          scale: isMobile ? 0.4 : 0.72,
          duration: 1,
          rotation: 0.7,
        }, openingCue("mascotRise", 2.5))
        .to(mascot, {
          y: -viewportHeight * (isMobile ? 0.18 : 0.1),
          scale: isMobile ? 0.36 : 0.5,
          duration: 1.25,
          rotation: 0,
        }, openingCue("mascotArc", 3.5))
        .to(mascot, {
          y: openingSettledMascotY,
          scale: settledMascotScale,
          duration: 1.75,
          ease: "power2.inOut",
        }, openingCue("mascotSettle", 4.75))
        .to(medallionElements, {
          autoAlpha: 1,
          scale: 1,
          rotation: 0,
          duration: 0.8,
          stagger: 0.08,
        }, openingCue("medallionsIn", 5))
        .to(reelCanvas, {
          x: -viewportWidth * 0.24,
          y: -viewportHeight * 0.08,
          rotation: 1,
          duration: 4.25,
        }, openingCue("reelTravel", 5))
        .to(openingCta, {
          autoAlpha: 0,
          scaleX: 0.08,
          duration: 0.35,
          ease: "power1.in",
        }, openingCue("openingCtaOut", 8.75))
        .to(medallionElements, {
          x: (index) => (index % 2 ? -90 : 120),
          y: (index) => (index % 3 - 1) * 42,
          rotation: (index) => index % 2 ? -16 : 18,
          duration: 4.25,
        }, openingCue("medallionTravel", 5))
        .to(headlineRig, {
          scale: headlineScale,
          x: isMobile ? viewportWidth * 0.025 : 0,
          y: viewportHeight * (isMobile ? 0.24 : -0.08),
          duration: 1.5,
          ease: isMobile ? "power2.inOut" : "power1.inOut",
        }, openingCue("headlineArchitecture", 9.25))
        .to(openingField, {
          autoAlpha: 0,
          duration: 1.02,
          ease: "power2.inOut",
        }, openingCue("openingFieldOut", 10.68))
        .to(planeElements, {
          autoAlpha: 0,
          duration: 0.82,
          ease: "power2.inOut",
        }, openingCue("planesOut", 10.28))
        .set(planeElements, { autoAlpha: 0 }, openingCue("planesClear", 11.12))
        .to(
          medallionElements,
          { autoAlpha: 0.18, duration: 0.75 },
          openingCue("medallionsDim", 9.25),
        )
        .addLabel("headlineFlood", openingCue("headlineFlood", 10.2))
        .to(headlineRig, {
          scale: isMobile ? 3.05 : 6.4,
          y: viewportHeight * (isMobile ? 0.46 : -0.13),
          duration: isMobile ? 1.25 : 1.55,
          ease: isMobile ? "expo.inOut" : "power2.in",
        }, "headlineFlood")
        .to(headlineRig, {
          autoAlpha: 0,
          duration: 0.7,
          ease: "power1.in",
        }, openingCue("headlineOut", 11.05))
        .addLabel("headlineCleared", openingCue("headlineCleared", 11.75))
        .set(planes.children, { autoAlpha: 0 }, "headlineCleared")
        .to(openingField, {
          autoAlpha: 0,
          duration: 0.45,
          ease: "power1.inOut",
        }, "headlineCleared")
        .addLabel("phoneEntry", basicCue("phoneEntry", shiftedPhoneTime(11.05)))
        .to(phone, {
          y: stablePhoneY,
          duration: 2.55,
          ease: "power1.inOut",
        }, "phoneEntry")
        .to(mascot, {
          y: phoneMascotY.at1150,
          scale: attachedMascotScale,
          duration: 2.55,
          ease: "power1.inOut",
        }, "phoneEntry")
        .to(phoneAnchor, {
          y: phoneHeight * phoneAnchorRatio.settled,
          duration: 2.55,
          ease: "power1.inOut",
        }, "phoneEntry")
        .to(
          phoneUiStates[0],
          { autoAlpha: 0, duration: 0.12 },
          basicCue("basicTierOut", shiftedPhoneTime(13.4)),
        )
        .to(
          phoneUiStates[1],
          { autoAlpha: 1, duration: 0.12 },
          basicCue("standardTierIn", shiftedPhoneTime(13.52)),
        )
        .to(
          phoneUiStates[1],
          { autoAlpha: 0, duration: 0.12 },
          standardCue("standardTierOut", shiftedPhoneTime(14.06)),
        )
        .to(
          phoneUiStates[2],
          { autoAlpha: 1, duration: 0.12 },
          standardCue("proTierIn", shiftedPhoneTime(14.18)),
        )
        .to(mascot, {
          y: phoneMascotY.at1450,
          duration: 1.05,
          ease: "none",
        }, phoneMaterialCue("mascotLongHold", shiftedPhoneTime(13.6)))
        .to(phoneAnchor, {
          y: phoneHeight * phoneAnchorRatio.longHold,
          duration: 1.05,
          ease: "none",
        }, phoneMaterialCue("mascotLongHold", shiftedPhoneTime(13.6)))
        .to(phoneMaterial, {
          clipPath: "polygon(0 72%, 28% 58%, 100% 78%, 100% 100%, 0 100%, 0 100%)",
          duration: 0.5,
          ease: "power1.inOut",
        }, phoneMaterialCue("materialStart", shiftedPhoneTime(14.75)))
        .to(phoneMaterial, {
          clipPath: "polygon(0 24%, 54% 4%, 100% 42%, 100% 100%, 0 100%, 0 100%)",
          duration: 0.55,
          ease: "power1.inOut",
        }, phoneMaterialCue("materialSecondClip", shiftedPhoneTime(15.25)))
        .to(phoneMaterial, {
          clipPath: "polygon(0 -8%, 100% -8%, 100% 100%, 100% 100%, 0 100%, 0 100%)",
          duration: 0.45,
          ease: "power1.inOut",
        }, phoneMaterialCue("materialFinalClip", shiftedPhoneTime(15.8)))
        .to(mascot, {
          y: materialMascotY.early,
          scale: settledMascotScale,
          duration: 0.3,
          ease: "power1.inOut",
        }, phoneMaterialCue("materialStart", shiftedPhoneTime(14.75)))
        .to(phoneAnchor, {
          y: phoneHeight * phoneAnchorRatio.materialEarly,
          duration: 0.3,
          ease: "power1.inOut",
        }, phoneMaterialCue("materialStart", shiftedPhoneTime(14.75)))
        .to(mascot, {
          y: materialMascotY.middle,
          duration: 0.35,
          ease: "power2.inOut",
        }, phoneMaterialCue("materialMiddle", shiftedPhoneTime(15.05)))
        .to(phoneAnchor, {
          y: phoneHeight * phoneAnchorRatio.materialMiddle,
          duration: 0.35,
          ease: "power2.inOut",
        }, phoneMaterialCue("materialMiddle", shiftedPhoneTime(15.05)))
        .to(mascot, {
          y: materialMascotY.high,
          duration: 0.35,
          ease: "power2.inOut",
        }, phoneMaterialCue("materialHigh", shiftedPhoneTime(15.4)))
        .to(phoneAnchor, {
          y: phoneHeight * phoneAnchorRatio.materialHigh,
          duration: 0.35,
          ease: "power2.inOut",
        }, phoneMaterialCue("materialHigh", shiftedPhoneTime(15.4)))
        .to(mascot, {
          y: materialMascotY.peak,
          duration: 0.5,
          ease: "power1.out",
        }, phoneMaterialCue("materialPeak", shiftedPhoneTime(15.75)))
        .to(phoneAnchor, {
          y: phoneHeight * phoneAnchorRatio.materialPeak,
          duration: 0.5,
          ease: "power1.out",
        }, phoneMaterialCue("materialPeak", shiftedPhoneTime(15.75)))
        .to(
          outline,
          { autoAlpha: 1, duration: 0.2 },
          phoneMaterialCue("outlineStart", shiftedPhoneTime(15.8)),
        )
        .to(outlinePath, {
          strokeDashoffset: 0,
          duration: 0.7,
          ease: "power1.inOut",
        }, phoneMaterialCue("outlineStart", shiftedPhoneTime(15.8)))
        .to(phoneBody, {
          backgroundColor: "transparent",
          borderColor: "transparent",
          boxShadow: "0 0 0 transparent",
          duration: 0.35,
        }, phoneMaterialCue("phoneBodyClear", shiftedPhoneTime(16)))
        .to(
          blockScene,
          { autoAlpha: 1, duration: 0.25 },
          phoneMaterialCue("blockSceneIn", shiftedPhoneTime(16.1)),
        )
        .to(ghostCells, {
          autoAlpha: 0.26,
          scaleY: 1,
          duration: 0.8,
          stagger: { amount: 0.55, from: "center" },
          ease: "power1.inOut",
        }, phoneMaterialCue("ghostCellsIn", shiftedPhoneTime(16.15)))
        .to(sayClipRect, {
          attr: { y: 0, height: 350 },
          duration: 1.35,
          ease: "power1.inOut",
        }, phoneMaterialCue("readableHeadline", shiftedPhoneTime(16.95)))
        .to(ghostCells, {
          autoAlpha: 0,
          duration: 0.3,
          ease: "power1.out",
        }, phoneMaterialCue("ghostCellsOut", shiftedPhoneTime(18.2)))
        .to(mascot, {
          y: materialMascotY.hold,
          duration: 2.5,
          ease: "none",
        }, phoneMaterialCue("mascotMaterialHold", shiftedPhoneTime(16.25)))
        .to(phoneAnchor, {
          y: phoneHeight * phoneAnchorRatio.materialHold,
          duration: 2.5,
          ease: "none",
        }, phoneMaterialCue("mascotMaterialHold", shiftedPhoneTime(16.25)))
        .to(phone, {
          y: hiddenAbove,
          duration: 0.95,
          ease: "power1.inOut",
        }, phoneMaterialCue("phoneExit", shiftedPhoneTime(16.3)))
        .to(outline, {
          y: hiddenAbove,
          autoAlpha: 0,
          duration: 0.95,
          ease: "power1.inOut",
        }, phoneMaterialCue("phoneExit", shiftedPhoneTime(16.3)))
        .set(phoneBody, {
          backgroundColor: phoneColor,
          borderColor: phoneBorderColor,
          boxShadow: `0 30px 96px ${phoneShadowColor}`,
        }, phoneMaterialCue("phoneBodyRestore", shiftedPhoneTime(17.4)))
        .set(phoneMaterial, {
          clipPath: "polygon(0 100%, 0 98%, 4% 100%, 0 100%, 0 100%, 0 100%)",
        }, phoneMaterialCue("phoneMaterialReset", shiftedPhoneTime(17.4)))
        .set(
          phoneUiStates,
          { autoAlpha: 0 },
          phoneMaterialCue("phoneUiReset", shiftedPhoneTime(18.65)),
        )
        .set(
          phoneUiStates[0],
          { autoAlpha: 1 },
          phoneMaterialCue("phoneUiReset", shiftedPhoneTime(18.65)),
        )
        .to(
          phone,
          { y: hiddenAbove, duration: 1.35 },
          phoneMaterialCue("phoneReturnPrepare", shiftedPhoneTime(17.4)),
        )
        .to(phone, {
          y: stablePhoneY,
          duration: 0.5,
          ease: "power1.inOut",
        }, phoneMaterialCue("phoneReturn", shiftedPhoneTime(18.75)))
        .to(outlinePath, {
          strokeDashoffset: 1,
          duration: 0.45,
          ease: "power1.inOut",
        }, phoneMaterialCue("outlineReturn", shiftedPhoneTime(18.78)))
        .to(
          outline,
          { autoAlpha: 0, duration: 0.15 },
          phoneMaterialCue("outlineOut", shiftedPhoneTime(19.15)),
        )
        .to(blockScene, {
          autoAlpha: 0,
          y: readableHeadlineY + viewportHeight * 0.07,
          duration: 0.45,
        }, phoneMaterialCue("blockSceneOut", shiftedPhoneTime(18.78)))
        .to(mascot, {
          y: settledMascotY,
          scale: attachedMascotScale,
          duration: 0.55,
          ease: "power2.in",
        }, phoneMaterialCue("mascotAttach", shiftedPhoneTime(19.45)))
        .to(phoneAnchor, {
          y: phoneHeight * phoneAnchorRatio.settled,
          duration: 0.55,
          ease: "power2.in",
        }, phoneMaterialCue("mascotAttach", shiftedPhoneTime(19.45)))
        .to(cards.slice(0, 3), {
          x: 0,
          y: 0,
          rotation: (index) => isMobile ? 0 : [-2.2, 1.4, 2][index],
          rotationY: 0,
          rotationX: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.78,
          stagger: 0.1,
          ease: "power2.out",
        }, phoneMaterialCue("sideCardsIn", shiftedPhoneTime(19)))
        .to(cards[3], {
          x: 0,
          y: 0,
          rotation: isMobile ? 0 : -1.6,
          rotationY: 0,
          rotationX: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.68,
          ease: "power2.out",
        }, phoneMaterialCue("fourthCardIn", shiftedPhoneTime(19.72)))
        .to(
          cue,
          { autoAlpha: 0, duration: 0.25 },
          phoneMaterialCue("cueOut", shiftedPhoneTime(20.25)),
        )
        .to(
          {},
          { duration: 23 - REFERENCE_FIRST_SEQUENCE_END },
          phoneMaterialCue("firstSequenceEnd", REFERENCE_FIRST_SEQUENCE_END),
        )
        .to([phone, ...cards], {
          y: -viewportHeight * 1.08,
          duration: 0.72,
          ease: "power1.inOut",
        }, phoneMaterialCue("firstClusterEnd", 23))
        .to(mascot, {
          y: -viewportHeight * (isMobile ? 0.12 : 0.16),
          scale: settledMascotScale * 0.88,
          autoAlpha: 1,
          duration: 0.72,
          ease: "power1.inOut",
        }, phoneMaterialCue("firstClusterEnd", 23))
        .to(
          violetField,
          { yPercent: 0, duration: 0.8, ease: "power1.inOut" },
          proEntryCue("violetRise", 23),
        )
        .to(mascot, {
          y: settledMascotY,
          scale: settledMascotScale,
          duration: 0.45,
          ease: "power1.out",
        }, proEntryCue("mascotVioletSettle", 23.72))
        .to(violetMedallionElements, {
          y: 0,
          rotation: 0,
          autoAlpha: 1,
          duration: 0.72,
          stagger: 0.07,
          ease: "power2.out",
        }, proEntryCue("violetMedallionsIn", 23.55))
        .to(secondHeadline, {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          ease: "power2.out",
        }, proEntryCue("secondHeadlineIn", 24.25))
        .to(
          secondCta,
          { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out" },
          proEntryCue("secondCtaIn", 24.55),
        )
        .to(violetMedallionElements, {
          x: (index, element) => {
            const utilityId = (element as HTMLElement).dataset.utility;
            if (utilityId === "speaking") return -viewportWidth * 0.03;
            if (utilityId === "tracking") return viewportWidth * 0.04;
            if (utilityId === "claude") return viewportWidth * 0.01;
            return (index - 2) * viewportWidth * 0.05;
          },
          y: (index, element) => {
            const utilityId = (element as HTMLElement).dataset.utility;
            if (utilityId === "speaking") return -40;
            if (utilityId === "tracking") return 28;
            if (utilityId === "claude") return -24;
            return index % 2 ? -58 : 40;
          },
          rotation: (index, element) => {
            const utilityId = (element as HTMLElement).dataset.utility;
            if (utilityId === "speaking") return -7;
            if (utilityId === "tracking") return 7;
            if (utilityId === "claude") return 5;
            return index % 2 ? -12 : 12;
          },
          duration: 1.5,
        }, proEntryCue("violetMedallionDrift", 24.25))
        .to(
          blueField,
          { yPercent: 0, duration: 0.55, ease: "power1.inOut" },
          proEntryCue("blueRise", 25.55),
        )
        .to([secondHeadline, secondCta, violetMedallions], {
          autoAlpha: 0,
          duration: 0.32,
        }, proEntryCue("violetContentOut", 25.55))
        .set(
          phoneUiStates,
          { autoAlpha: 0 },
          standardCue("secondStandardPrepare", 25.33),
        )
        .set(
          phoneUiStates[1],
          { autoAlpha: 1 },
          standardCue("secondStandardPrepare", 25.33),
        )
        .set(phone, { y: hiddenBelow }, standardCue("secondPhonePrepare", 25.34))
        .set(cards, {
          y: viewportHeight * 0.75,
          rotationY: (index) => isMobile ? 0 : (index < 2 ? 18 : -18),
          rotationX: isMobile ? 0 : -8,
          autoAlpha: 0,
          x: (index) => (index < 2 ? -1 : 1) * viewportWidth * 0.18,
        }, standardCue("secondCardsPrepare", 25.34))
        .to(
          phone,
          { y: stablePhoneY, duration: 0.62, ease: "power1.inOut" },
          standardCue("secondPhoneIn", 25.34),
        )
        .to(cards, {
          x: 0,
          y: 0,
          rotationY: 0,
          rotationX: 0,
          autoAlpha: 1,
          duration: 0.72,
          stagger: 0.07,
          ease: "power2.out",
        }, standardCue("secondCardsIn", 25.38))
        .to(mascot, {
          y: settledMascotY,
          scale: attachedMascotScale,
          duration: 0.55,
        }, standardCue("secondMascotSettle", 25.34))
        .to([phone, ...cards], {
          y: -viewportHeight * 1.05,
          duration: 0.62,
          ease: "power1.inOut",
        }, proEntryCue("coralRise", 27.75))
        .to(mascot, {
          y: -viewportHeight * (isMobile ? 0.12 : 0.16),
          scale: settledMascotScale * 0.88,
          autoAlpha: 1,
          duration: 0.62,
          ease: "power1.inOut",
        }, proEntryCue("coralRise", 27.75))
        .to(
          coralField,
          { yPercent: 0, duration: 0.72, ease: "power1.inOut" },
          proEntryCue("coralRise", 27.75),
        )
        .to(proTierAtmosphere, {
          autoAlpha: 1,
          duration: 0.52,
          ease: "power1.out",
        }, proEntryCue("proAtmosphereIn", PRO_ATMOSPHERE_VISIBLE_START))
        .set(phoneUiStates, { autoAlpha: 0 }, proEntryCue("proTierIn", 28.05))
        .set(phoneUiStates[2], { autoAlpha: 1 }, proEntryCue("proTierIn", 28.05))
        .to(mascot, {
          y: settledMascotY,
          scale: settledMascotScale,
          duration: 0.45,
          ease: "power1.out",
        }, proEntryCue("proMascotSettle", 28.05))
        .to(coralHeadline, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: "power2.out",
        }, proEntryCue("coralHeadlineIn", 28.05))
        .to(coralHeadline, {
          autoAlpha: 0,
          y: -viewportHeight * 0.025,
          scale: 0.94,
          duration: 0.3,
          ease: "power2.inOut",
        }, proEntryCue("coralHeadlineOut", 29.15))
        .to(mascot, {
          autoAlpha: 1,
          y: mascotHandoffSeamY,
          duration: mascotHandoffSeam - mascotHandoffStart,
          ease: mascotHandoffBeforeEase,
        }, mascotHandoffStart)
        .to(mascot, {
          autoAlpha: 1,
          y: mascotHandoffEndY,
          duration: mascotHandoffEnd - mascotHandoffSeam,
          ease: mascotHandoffAfterEase,
        }, mascotHandoffSeam)
        .to(proFocalConvergence, {
          autoAlpha: 1,
          duration: 0.18,
          ease: "power2.out",
        }, proEntryCue("focalConvergenceIn", 29.22))
        .to(lessonObject, {
          autoAlpha: 1,
          y: 0,
          rotation: 0,
          rotationY: 0,
          scale: 1,
          duration: 0.61,
          ease: "power3.out",
        }, proEntryCue("lessonObjectIn", 29.3))
        .to(proFocalConvergence, {
          autoAlpha: 0,
          duration: 0.33,
          ease: "power2.inOut",
        }, proEntryCue("focalConvergenceOut", 29.58))
        .to(lessonGlint, {
          xPercent: 160,
          duration: 0.72,
          ease: "power2.inOut",
        }, proEntryCue("lessonGlintIn", 29.66))
        .to(lessonGlint, {
          autoAlpha: 0.78,
          duration: 0.18,
          ease: "power2.out",
        }, proEntryCue("lessonGlintIn", 29.66))
        .to(lessonGlint, {
          autoAlpha: 0,
          duration: 0.28,
          ease: "power2.inOut",
        }, proEntryCue("lessonGlintOut", 30.18))
        .to(lessonObject, {
          rotation: 1.2,
          rotationY: 7,
          scale: 1.015,
          duration: 0.29,
          ease: "power2.inOut",
        }, proEntryCue("lessonObjectAccent", 29.91))
        .to(lessonObject, {
          rotation: 0,
          rotationY: 0,
          scale: 1,
          duration: 0.3,
          ease: "power2.inOut",
        }, proEntryCue("lessonObjectRestore", 30.2))
        .to(lessonObject, {
          autoAlpha: 0,
          y: -viewportHeight * 0.35,
          duration: 0.4,
        }, proEntryCue("lessonObjectOut", 30.5))
        .set(
          phone,
          { zIndex: 6, scale: isMobile ? 0.84 : 1 },
          proofCue("proofPhonePrepare", 30.45),
        )
        .fromTo(phone, {
          y: hiddenAbove,
          autoAlpha: 0,
        }, {
          y: stablePhoneY,
          autoAlpha: 1,
          duration: 0.55,
          ease: "power1.inOut",
          immediateRender: false,
        }, proofCue("proofPhoneIn", 30.45))
        .to(proofWall, {
          autoAlpha: 1,
          x: 0,
          duration: 0.45,
          ease: "power1.out",
        }, proofCue("proofWallIn", 30.5))
        .to(proofCardElements, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.65,
          stagger: { each: 0.06, from: "center" },
          ease: "power2.out",
        }, proofCue("proofCardsIn", 30.55))
        .to(mascot, {
          x: 0,
          y: settledMascotY,
          scale: attachedMascotScale,
          autoAlpha: 1,
          duration: 0.45,
          ease: "power1.out",
        }, proofCue("proofMascotIn", 30.5))
        .to(proofWall, {
          x: -viewportWidth * (isMobile ? 0.01 : 0.06),
          duration: 1.2,
        }, proofCue("proofWallDrift", 31.05))
        .to(
          navyField,
          { yPercent: 0, duration: 0.68, ease: "power1.inOut" },
          closingCue("darkCampaignIn", 32.25),
        )
        .to(proTierAtmosphere, {
          autoAlpha: 0,
          duration: 0.55,
          ease: "power1.inOut",
        }, closingCue("atmosphereOut", PRO_ATMOSPHERE_END))
        .to(proofWall, {
          autoAlpha: 0,
          duration: 0.24,
          ease: "power1.out",
        }, proofCue("proofWallOut", 32.25))
        .to(phone, {
          y: -viewportHeight * 0.5,
          autoAlpha: 0,
          duration: 0.55,
        }, closingCue("proofPhoneOut", 32.25))
        .to(mascot, {
          x: 0,
          y: -viewportHeight * (isMobile ? 0.14 : 0.18),
          scale: settledMascotScale * 0.82,
          autoAlpha: 1,
          duration: 0.55,
        }, closingCue("closingMascotPrepare", 32.25))
        .set(phone, { zIndex: 9 }, closingCue("closingPhonePrepare", 32.62))
        .fromTo(phone, {
          x: viewportWidth * 0.36,
          y: viewportHeight * 0.18,
          scale: 0.62,
          rotation: 8,
          autoAlpha: 0,
        }, {
          x: viewportWidth * (isMobile ? 0.23 : 0.3),
          y: viewportHeight * (isMobile ? 0.08 : 0.015),
          scale: isMobile ? 0.66 : 0.72,
          rotation: isMobile ? 2 : 4,
          autoAlpha: 1,
          duration: 0.58,
          ease: "power2.out",
          immediateRender: false,
        }, closingCue("closingPhoneIn", 32.62))
        .to(mascot, {
          x: viewportWidth * (isMobile ? 0.23 : 0.3),
          y: viewportHeight * (isMobile ? -0.02 : -0.05),
          scale: isMobile ? 0.27 : 0.2,
          autoAlpha: 1,
          duration: 0.58,
          ease: "power2.out",
        }, closingCue("closingMascotIn", 32.66))
        .to(finalCampaign, {
          autoAlpha: 1,
          y: 0,
          duration: 0.52,
          ease: "power2.out",
        }, closingCue("finalCampaignIn", 32.62))
        .to(finalCta, {
          autoAlpha: 1,
          y: 0,
          duration: 0.32,
          ease: "power2.out",
        }, closingCue("finalCtaIn", 32.9));

      const scrollTrigger = ScrollTrigger.create({
        trigger: sequence,
        start: "top top",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate(self) {
          if (stage.dataset.motionReady !== "true") return;
          const targetTime = referenceTimeAtScrollProgress(self.progress);
          if (targetTime <= 0.001) {
            timeline.pause(0);
            setInitialState();
            syncActiveOpeningWord(0);
            return;
          }
          timeline.totalTime(targetTime, false);
        },
      });
      triggerRef.current = scrollTrigger;

      const getBounds = (): V7Bounds => ({
        headline: serializeRect(headlineRig.getBoundingClientRect()),
        headlineLines: baseLines.map((line) => serializeRect(line.getBoundingClientRect())),
        phone: serializeRect(phone.getBoundingClientRect()),
        phoneOutline: serializeRect(outline.getBoundingClientRect()),
        mascot: serializeRect(mascot.getBoundingClientRect()),
        phoneMascotAnchor: serializeRect(phoneAnchor.getBoundingClientRect()),
        cards: cards.map((card) => serializeRect(card.getBoundingClientRect())),
        proofCards: proofCardElements.map((card) => serializeRect(card.getBoundingClientRect())),
      });

      const getState = (): V7DebugState => {
        const referenceTime = timeline.time();
        const bounds = getBounds();
        const anchorRect = phoneAnchor.getBoundingClientRect();
        const mascotRect = mascot.getBoundingClientRect();
        const mascotRegistrationX = mascotRect.left + mascotRect.width / 2;
        const mascotRegistrationY = mascotRect.bottom;
        const anchorX = anchorRect.left + anchorRect.width / 2;
        const anchorY = anchorRect.top + anchorRect.height / 2;
        const dx = mascotRegistrationX - anchorX;
        const dy = mascotRegistrationY - anchorY;
        const wordVisible = wordLayers.filter(
          (word) => visibleOpacity(word) > 0.02 && word.getBoundingClientRect().height > 0,
        ).length;
        const headlineLayers = [headlineHtml, headlineSvg].filter(
          (layer) => visibleOpacity(layer) > 0.02,
        ).length;
        const cardCount = cards.filter((card) => {
          const rect = card.getBoundingClientRect();
          return visibleOpacity(card) > 0.02 && rect.bottom > 0 && rect.top < viewportHeight;
        }).length;
        const materialStart = shiftedPhoneTime(14.75);
        const materialEnd = shiftedPhoneTime(17.4);
        const materialPercentage = referenceTime < materialStart || referenceTime >= materialEnd
          ? 0
          : gsap.utils.clamp(0, 100, ((referenceTime - materialStart) / 1.5) * 100);
        const outlinePercentage = visibleOpacity(outline) <= 0.02
          ? 0
          : gsap.utils.clamp(
            0,
            100,
            (1 - numericGsapProperty(outlinePath, "strokeDashoffset")) * 100,
          );
        return {
          motionReady: stage.dataset.motionReady === "true",
          preinitVisible: visibleOpacity(preinit) > 0.02,
          referenceTime,
          progress: scrollProgressAtReferenceTime(referenceTime),
          activePhase: phaseAt(referenceTime),
          activeOpeningWord: stage.dataset.openingTier ?? "pace.",
          visibleOpeningWordCount: wordVisible,
          visibleHeadlineLayerCount: headlineLayers,
          headlineBounds: bounds.headline,
          phoneBounds: bounds.phone,
          phoneMaterialPercentage: materialPercentage,
          phoneIdentityState: phoneIdentityAt(referenceTime),
          outlinePercentage,
          liquidVisibleBounds: bounds.mascot,
          liquidVisibleHeight: bounds.mascot.height,
          phoneMascotAnchor: bounds.phoneMascotAnchor,
          phoneMascotAnchorDelta: { dx, dy, distance: Math.hypot(dx, dy) },
          visibleSideCardCount: cardCount,
          currentContinuationScene: phaseAt(referenceTime),
          ctaVisibility: Math.max(
            visibleOpacity(openingCta),
            visibleOpacity(secondCta),
            visibleOpacity(finalCta),
          ),
          videoCurrentSrc: video?.currentSrc ?? "",
          videoDuration: video && Number.isFinite(video.duration) ? video.duration : 0,
          videoCurrentTime: video?.currentTime ?? 0,
          videoCount: sequence.querySelectorAll("video").length,
          scrollTriggerCount: ScrollTrigger.getAll().length,
          horizontalOverflow: Math.max(
            0,
            document.documentElement.scrollWidth - window.innerWidth,
          ),
        };
      };

      const updateDebug = () => {
        if (debugHandle && window.__LIQUID_V7_DEBUG__ !== debugHandle) {
          window.__LIQUID_V7_DEBUG__ = debugHandle;
        }
        const overlay = debugOverlayRef.current;
        if (!overlay || overlay.hidden) return;
        const state = getState();
        const phoneTransform = transformState(phone);
        const mascotTransform = transformState(mascot);
        overlay.textContent = [
          `reference   ${state.referenceTime.toFixed(3)} / ${REFERENCE_PINNED_END.toFixed(2)} s`,
          `phase       ${state.activePhase}`,
          `ready       ${state.motionReady} · preinit ${state.preinitVisible}`,
          `word/layers ${state.activeOpeningWord} · ${state.visibleOpeningWordCount}/${state.visibleHeadlineLayerCount}`,
          `phone       ${state.phoneIdentityState} · y ${phoneTransform.y.toFixed(1)} · ${state.phoneBounds.width.toFixed(1)}×${state.phoneBounds.height.toFixed(1)}`,
          `material    ${state.phoneMaterialPercentage.toFixed(0)}% · outline ${state.outlinePercentage.toFixed(0)}%`,
          `Liquid      y ${mascotTransform.y.toFixed(1)} · s ${mascotTransform.scale.toFixed(3)} · h ${state.liquidVisibleHeight.toFixed(1)}`,
          `anchor      Δ ${state.phoneMascotAnchorDelta.distance.toFixed(1)} px`,
          `cards       ${state.visibleSideCardCount} · CTA ${state.ctaVisibility.toFixed(2)}`,
          `runtime     ${state.scrollTriggerCount} trigger · ${state.videoCount} video`,
          `video       ${state.videoCurrentTime.toFixed(2)} / ${state.videoDuration.toFixed(3)} s`,
          `overflow    ${state.horizontalOverflow.toFixed(1)} px`,
        ].join("\n");
      };

      const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      const debugRequested = new URLSearchParams(window.location.search).get("debug") === "1";
      if (debugOverlayRef.current) {
        debugOverlayRef.current.hidden = !(isLocal && debugRequested);
      }

      const setReferenceTime = (seconds: number) => {
        const referenceTime = gsap.utils.clamp(
          0,
          REFERENCE_PINNED_END,
          Number(seconds) || 0,
        );
        const progress = scrollProgressAtReferenceTime(referenceTime);
        const scrollDistance = Math.max(0, sequence.offsetHeight - window.innerHeight);
        const activeTrigger = triggerRef.current;
        activeTrigger?.enable(false, false);
        timeline.pause();
        const previousScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({
          top: sequence.offsetTop + progress * scrollDistance,
          behavior: "auto",
        });
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
        ScrollTrigger.update();
        timeline.totalTime(referenceTime, false);
        if (referenceTime <= 0.001) setInitialState();
        updateDebug();
      };

      if (isLocal) {
        debugHandle = {
          setReferenceTime,
          setProgress(progress) {
            setReferenceTime(referenceTimeAtScrollProgress(Number(progress) || 0));
          },
          getState,
          getBounds,
          releaseScroll() {
            triggerRef.current?.enable(false, false);
            ScrollTrigger.update();
          },
        };
        window.__LIQUID_V7_DEBUG__ = debugHandle;
      }

      const syncAndReveal = async () => {
        try {
          const readinessDegraded = await waitForSceneAssets();
          if (disposed) return;
          if (
            useSafariMascotVideo === false
            && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            setVideoReady(true);
          }
          timeline.pause(0);
          setInitialState();
          measureHeadline();
          timeline.invalidate();
          ScrollTrigger.refresh();
          const scrollDistance = Math.max(1, sequence.offsetHeight - window.innerHeight);
          const currentProgress = gsap.utils.clamp(
            0,
            1,
            (window.scrollY - sequence.offsetTop) / scrollDistance,
          );
          timeline.totalTime(referenceTimeAtScrollProgress(currentProgress), false);
          ScrollTrigger.update();
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
          if (disposed) return;
          stage.dataset.referenceFullEnd = String(
            V7_SEQUENCE_CONTRACT_ROLLOUT.dataAttributeAuthority
              ? V7_REFERENCE_FULL_METADATA_END
              : REFERENCE_FULL_END,
          );
          setLoadingProgress(100);

          // The opening assembly must never override a restored scroll scene.
          // Only the main timeline owns the headline and opening CTA.
          if (window.scrollY > sequence.offsetTop + 2) {
            completeStaticReveal("scroll-restored");
          } else if (readinessDegraded) {
            completeStaticReveal("readiness-fallback");
          } else {
            const revealCompleted = await new Promise<boolean>((resolve) => {
              let settled = false;
              const finish = (completed: boolean) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeout);
                resolve(completed);
              };
              const timeout = window.setTimeout(() => finish(false), SITE_REVEAL_BUDGET_MS);
              void runSiteReveal().then(() => finish(true), () => finish(false));
            });
            if (!revealCompleted && !disposed) {
              siteRevealTimeline?.kill();
              completeStaticReveal("reveal-fallback");
            }
          }

          if (disposed) return;
          // Scroll may change while fonts, images or the assembly are settling.
          const settledProgress = gsap.utils.clamp(0, 1,
            (window.scrollY - sequence.offsetTop) / Math.max(1, sequence.offsetHeight - window.innerHeight));
          timeline.totalTime(referenceTimeAtScrollProgress(settledProgress), false);
          syncActiveOpeningWord(timeline.time());
          syncAnimatedControlAvailability(timeline.time());
          if (isLocal && debugHandle) {
            window.__LIQUID_V7_DEBUG__ = debugHandle;
          }
          updateDebug();
        } catch {
          if (disposed) return;
          // A failed 3D load is not a successful reveal. Offer an explicit retry
          // or a visitor-selected fallback instead of silently showing old Liquid.
          if (useLiquidModel && stage.querySelector<HTMLElement>("[data-liquid-model]")?.dataset.ready !== "true") {
            showLoadingError();
            return;
          }
          siteRevealTimeline?.kill();
          try { setInitialState(); } catch { /* expose the CSS-backed opening below */ }
          completeStaticReveal("initialization-fallback");
        }
      };
      if (viewportRestore) {
        // Rebuild the geometry at the new viewport, then restore the same story beat.
        // The parent resynchronises Lenis so its previous target cannot undo this seek.
        ScrollTrigger.refresh();
        window.dispatchEvent(new CustomEvent(V7_SEQUENCE_NAVIGATION_EVENT, {
          detail: {
            referenceTime: viewportRestore.afterSequence === null ? viewportRestore.referenceTime : REFERENCE_PINNED_END,
            afterSequence: viewportRestore.afterSequence ?? 0,
            immediate: true,
          },
        }));
        void waitForSceneAssets().then(() => {
          if (!disposed) completeStaticReveal("viewport-restored");
        }).catch(showLoadingError);
        const restoredTime = viewportRestore.afterSequence === null ? viewportRestore.referenceTime : REFERENCE_PINNED_END;
        timeline.totalTime(restoredTime, false);
        if (restoredTime <= 0.001) setInitialState();
        ScrollTrigger.update();
        layoutScrollY = window.scrollY;
        layoutReferenceTime = restoredTime;
        updateDebug();
      } else {
        void syncAndReveal();
      }

      const debugTicker = () => updateDebug();
      if (isLocal && debugRequested) gsap.ticker.add(debugTicker);

      runtimeCleanup = () => {
        siteRevealTimeline?.kill();
        siteRevealTimeline = null;
        gsap.ticker.remove(debugTicker);
        ScrollTrigger.removeEventListener("refreshInit", measureHeadline);
        scrollTrigger.kill();
        triggerRef.current = null;
        timelineRef.current = null;
        timeline.kill();
      };
    }, sequence);

    let resizeFrame = 0;
    const rememberScroll = () => {
      // A resize may refresh ScrollTrigger before our resize handler runs. Only
      // record a position while it still belongs to this layout's dimensions.
      if (viewportMatchesLayout()) layoutScrollY = window.scrollY;
    };
    const onResize = () => {
      if (viewportMatchesLayout()) return;
      window.cancelAnimationFrame(resizeFrame);
      viewportRestoreRef.current = {
        referenceTime: layoutReferenceTime,
        afterSequence: layoutScrollY >= layoutStart + layoutDistance
          ? layoutScrollY - layoutStart - layoutDistance : null,
      };
      resizeFrame = window.requestAnimationFrame(() => setLayoutRevision(revision => revision + 1));
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        ScrollTrigger.update();
        const restoredProgress = gsap.utils.clamp(0, 1,
          (window.scrollY - sequence.offsetTop) / Math.max(1, sequence.offsetHeight - window.innerHeight));
        timelineRef.current?.totalTime(referenceTimeAtScrollProgress(restoredProgress), false);
      });
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      disposed = true;
      readinessAbort.abort();
      window.removeEventListener("scroll", rememberScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pageshow", onPageShow);
      window.cancelAnimationFrame(resizeFrame);
      const debugHandleAtCleanup = debugHandle;
      window.requestAnimationFrame(() => {
        if (
          !document.querySelector('[data-testid="liquid-reference-v7-sequence"]') &&
          window.__LIQUID_V7_DEBUG__ === debugHandleAtCleanup
        ) {
          delete window.__LIQUID_V7_DEBUG__;
        }
      });
      stage.dataset.motionReady = "false";
      runtimeCleanup?.();
      context.revert();
    };
  }, [prefersReducedMotion, useSafariMascotVideo, useLiquidModel, layoutRevision, modelAttempt]);

  useEffect(() => {
    if (!V7_MEDIA_RUNTIME_SURFACES.phone) return;
    const states = phoneUiStateRefs.current;
    const videos = phoneTierVideoRefs.current;
    const phone = phoneRef.current;
    const stage = stageRef.current;
    if (states.length !== phoneUiCards.length || videos.length !== 4 || !phone || !stage) return;
    const lease = mediaRuntime.connect({
      kind: "phone",
      states,
      videos,
      phone,
      stage,
      initialActiveTier: activePhoneTierRef.current,
      initialProPhase: proPlaybackPhaseRef.current,
      getReferenceTime: () => timelineRef.current?.time() ?? 0,
      onActiveTier: (tier) => { activePhoneTierRef.current = tier; },
      onProPhase: (phase) => {
        proPlaybackPhaseRef.current = phase;
        setProPlaybackPhase(phase);
      },
    });
    return () => lease.dispose();
  }, [mediaRuntime]);

  useEffect(() => {
    if (V7_MEDIA_RUNTIME_SURFACES.phone) return;
    const states = phoneUiStateRefs.current;
    const tierVideos = phoneTierVideoRefs.current;
    const phoneElement = phoneRef.current;
    const stage = stageRef.current;
    if (states.length !== phoneUiCards.length || tierVideos.length !== 4 || !phoneElement || !stage) return;

    let syncFrame = 0;
    let phoneVisible = false;
    let releaseTimer = 0;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resetVideo = (video: HTMLVideoElement | null, release = false) => {
      if (!video) return;
      video.pause();
      if (release) {
        releaseDeferredVideoSource(video);
        return;
      }
      try { video.currentTime = 0; } catch { /* metadata may not be ready */ }
    };
    const standardPrerollActive = () => stage.dataset.standardPhonePreroll === "true";
    const playVideo = (video: HTMLVideoElement | null, allowOffscreen = false) => {
      if (
        !video
        || (!phoneVisible && !allowOffscreen)
        || preference.matches
        || document.visibilityState !== "visible"
      ) return;
      ensureDeferredVideoSource(video, "auto");
      void video.play().catch(() => { /* muted local preview may still be gated briefly */ });
    };
    const activateTier = (nextTier: number) => {
      if (activePhoneTierRef.current === nextTier) return;
      activePhoneTierRef.current = nextTier;
      const preserveStandardPreroll = nextTier === 1 && standardPrerollActive();
      tierVideos.forEach((video) => {
        if (preserveStandardPreroll && video === tierVideos[1]) return;
        resetVideo(video);
      });

      if (nextTier === 0) playVideo(tierVideos[0]);
      if (nextTier === 1) playVideo(tierVideos[1]);
      if (nextTier === 2) {
        proPlaybackPhaseRef.current = "intro";
        setProPlaybackPhase("intro");
        if (phoneVisible && !preference.matches) ensureDeferredVideoSource(tierVideos[3]!, "metadata");
        playVideo(tierVideos[2]);
      }
      if (standardPrerollActive() && nextTier !== 1) {
        playVideo(tierVideos[1], true);
      }
    };
    const syncTier = () => {
      syncFrame = 0;
      let nextTier = activePhoneTierRef.current;
      let strongestOpacity = 0.5;
      states.forEach((state, index) => {
        if (!state) return;
        const opacity = Number.parseFloat(window.getComputedStyle(state).opacity) || 0;
        if (opacity > strongestOpacity) {
          strongestOpacity = opacity;
          nextTier = index;
        }
      });
      activateTier(nextTier);
    };
    const scheduleSync = () => {
      if (syncFrame) return;
      syncFrame = window.requestAnimationFrame(syncTier);
    };
    const observers = states.map((state) => {
      if (!state) return null;
      const observer = new MutationObserver(scheduleSync);
      observer.observe(state, { attributes: true, attributeFilter: ["style", "class"] });
      return observer;
    });
    const syncVisibility = () => {
      window.clearTimeout(releaseTimer);
      releaseTimer = 0;
      const shouldPrerollStandard = standardPrerollActive();
      if (preference.matches || document.visibilityState === "hidden") {
        tierVideos.forEach((video) => video?.pause());
        return;
      }
      if (shouldPrerollStandard) {
        playVideo(tierVideos[1], true);
      } else if (activePhoneTierRef.current !== 1) {
        resetVideo(tierVideos[1]);
      }
      if (!phoneVisible) {
        tierVideos.forEach((video) => {
          if (shouldPrerollStandard && video === tierVideos[1]) return;
          video?.pause();
        });
        if (useIOSPerformanceMode && !shouldPrerollStandard) {
          releaseTimer = window.setTimeout(() => {
            tierVideos.forEach((video) => {
              if (video) resetVideo(video, true);
            });
          }, 1400);
        }
        return;
      }
      const activeTier = activePhoneTierRef.current;
      if (activeTier === 0) playVideo(tierVideos[0]);
      if (activeTier === 1) playVideo(tierVideos[1]);
      if (activeTier === 2) playVideo(proPlaybackPhaseRef.current === "intro" ? tierVideos[2] : tierVideos[3]);
    };
    const phoneObserver = new IntersectionObserver(([entry]) => {
      phoneVisible = entry.isIntersecting;
      syncVisibility();
    }, { threshold: 0.02 });
    phoneObserver.observe(phoneElement);
    const prerollObserver = new MutationObserver(syncVisibility);
    prerollObserver.observe(stage, {
      attributes: true,
      attributeFilter: ["data-standard-phone-preroll"],
    });

    document.addEventListener("visibilitychange", syncVisibility);
    preference.addEventListener("change", syncVisibility);
    scheduleSync();
    return () => {
      observers.forEach((observer) => observer?.disconnect());
      phoneObserver.disconnect();
      prerollObserver.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      preference.removeEventListener("change", syncVisibility);
      window.clearTimeout(releaseTimer);
      window.cancelAnimationFrame(syncFrame);
      tierVideos.forEach((video) => {
        if (!video) return;
        if (useIOSPerformanceMode) releaseDeferredVideoSource(video);
        else video.pause();
      });
      activePhoneTierRef.current = -1;
    };
  }, [useIOSPerformanceMode]);

  const handleProIntroEnded = () => {
    if (activePhoneTierRef.current !== 2) return;
    const idleVideo = phoneTierVideoRefs.current[3];
    proPlaybackPhaseRef.current = "idle";
    setProPlaybackPhase("idle");
    if (!idleVideo) return;
    ensureDeferredVideoSource(idleVideo, "auto");
    try { idleVideo.currentTime = 0; } catch { /* metadata may not be ready */ }
    void idleVideo.play().catch(() => { /* muted local preview may still be gated briefly */ });
  };

  useEffect(() => {
    if (!V7_MEDIA_RUNTIME_SURFACES.proAtmosphere) return;
    const stage = stageRef.current;
    const scene = coralFieldRef.current;
    const video = proTierAtmosphereVideoRef.current;
    if (!stage || !scene || !video) return;
    const lease = mediaRuntime.connect({
      kind: "pro-atmosphere",
      stage,
      scene,
      video,
      loopLeadSeconds: PRO_MATERIAL_LOOP_LEAD_SECONDS,
      loopRestartSeconds: PRO_MATERIAL_LOOP_RESTART_SECONDS,
      getReferenceTime: () => timelineRef.current?.time() ?? 0,
      onReady: setIsProTierAtmosphereReady,
    });
    return () => lease.dispose();
  }, [mediaRuntime]);

  useEffect(() => {
    if (V7_MEDIA_RUNTIME_SURFACES.proAtmosphere) return;
    const stage = stageRef.current;
    const scene = coralFieldRef.current;
    const video = proTierAtmosphereVideoRef.current;
    if (!stage || !scene || !video) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopLoopBoundaryWatch = watchProMaterialLoopBoundary(video);
    let sceneVisible = false;
    let atmosphereWarmed = false;
    let releaseTimer = 0;
    const syncPlayback = () => {
      const shouldWarm = stage.dataset.proAtmosphereWarm === "true"
        && !motionPreference.matches;
      const shouldPlay = stage.dataset.proAtmosphereActive === "true"
        && sceneVisible
        && !motionPreference.matches
        && document.visibilityState === "visible";
      if (shouldWarm && !atmosphereWarmed) {
        window.clearTimeout(releaseTimer);
        releaseTimer = 0;
        atmosphereWarmed = true;
        ensureDeferredVideoSource(video, "auto");
      } else if (!shouldWarm && atmosphereWarmed) {
        atmosphereWarmed = false;
        video.preload = "none";
        if (useIOSPerformanceMode) {
          releaseTimer = window.setTimeout(() => {
            if (!atmosphereWarmed) releaseDeferredVideoSource(video);
          }, 1600);
        }
      }
      if (!shouldPlay) {
        video.pause();
        return;
      }
      void video.play().catch(() => setIsProTierAtmosphereReady(false));
    };
    const sceneObserver = new IntersectionObserver(([entry]) => {
      sceneVisible = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0.02 });
    const phaseObserver = new MutationObserver(syncPlayback);

    sceneObserver.observe(scene);
    phaseObserver.observe(stage, {
      attributes: true,
      attributeFilter: ["data-pro-atmosphere-active", "data-pro-atmosphere-warm"],
    });
    document.addEventListener("visibilitychange", syncPlayback);
    motionPreference.addEventListener("change", syncPlayback);
    syncPlayback();
    return () => {
      stopLoopBoundaryWatch();
      sceneObserver.disconnect();
      phaseObserver.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      motionPreference.removeEventListener("change", syncPlayback);
      window.clearTimeout(releaseTimer);
      if (useIOSPerformanceMode) releaseDeferredVideoSource(video);
      else video.pause();
    };
  }, [useIOSPerformanceMode]);

  useEffect(() => {
    if (!V7_MEDIA_RUNTIME_SURFACES.headline) return;
    const headlineRig = headlineRigRef.current;
    const headlineVideos = Array.from(
      headlineRig?.querySelectorAll<HTMLVideoElement>(`.${styles.dynamicWord} .${styles.headlineTierVideo}`) ?? [],
    );
    if (!headlineRig || !headlineVideos.length) return;
    const videos: Array<{ tier: "basic" | "standard" | "pro"; video: HTMLVideoElement }> = [];
    headlineVideos.forEach((video) => {
      const tier = video.closest<HTMLElement>(`.${styles.dynamicWord}`)?.dataset.tier;
      if (tier === "basic" || tier === "standard" || tier === "pro") videos.push({ tier, video });
    });
    const lease = mediaRuntime.connect({
      kind: "headline",
      headlineRig,
      videos,
      getReferenceTime: () => timelineRef.current?.time() ?? 0,
    });
    return () => lease.dispose();
  }, [mediaRuntime]);

  useEffect(() => {
    if (V7_MEDIA_RUNTIME_SURFACES.headline) return;
    const headlineRig = headlineRigRef.current;
    const headlineVideos = Array.from(
      headlineRig?.querySelectorAll<HTMLVideoElement>(`.${styles.dynamicWord} .${styles.headlineTierVideo}`) ?? [],
    );
    if (!headlineRig || !headlineVideos.length) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopVideo = window.matchMedia("(min-width: 721px)");
    let syncFrame = 0;
    const syncPlayback = () => {
      syncFrame = 0;
      const shouldPlay = desktopVideo.matches
        && !preference.matches
        && document.visibilityState === "visible"
        && headlineRig.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        });
      const playingTiers = new Set(
        (headlineRig.dataset.playingTiers ?? headlineRig.dataset.activeTier ?? "")
          .split(" ")
          .filter(Boolean),
      );
      headlineVideos.forEach((headlineVideo) => {
        const videoTier = headlineVideo.closest<HTMLElement>(`.${styles.dynamicWord}`)?.dataset.tier;
        if (shouldPlay && videoTier && playingTiers.has(videoTier)) {
          ensureDeferredVideoSource(headlineVideo, "auto");
          void headlineVideo.play().catch(() => { /* static poster remains visible */ });
        }
        else headlineVideo.pause();
      });
    };
    const scheduleSync = () => {
      if (syncFrame) return;
      syncFrame = window.requestAnimationFrame(syncPlayback);
    };
    const stateObserver = new MutationObserver(scheduleSync);
    stateObserver.observe(headlineRig, {
      attributes: true,
      attributeFilter: ["data-active-tier", "data-playing-tiers", "style"],
    });

    preference.addEventListener("change", scheduleSync);
    desktopVideo.addEventListener("change", scheduleSync);
    document.addEventListener("visibilitychange", scheduleSync);
    scheduleSync();
    return () => {
      stateObserver.disconnect();
      preference.removeEventListener("change", scheduleSync);
      desktopVideo.removeEventListener("change", scheduleSync);
      document.removeEventListener("visibilitychange", scheduleSync);
      window.cancelAnimationFrame(syncFrame);
      headlineVideos.forEach(releaseDeferredVideoSource);
    };
  }, []);

  useEffect(() => {
    if (useLiquidModel || !V7_MEDIA_RUNTIME_SURFACES.mascot) return;
    if (useSafariMascotVideo === null) return;
    const baseVideo = videoRef.current;
    const gazeVideo = gazeVideoRef.current;
    if (!baseVideo || !gazeVideo) return;
    const visibleTarget = gazeVideo.closest<HTMLElement>(`.${styles.mascotVisibleCrop}`)
      ?? mascotRef.current
      ?? gazeVideo;
    const lease = mediaRuntime.connect({
      kind: "mascot",
      baseVideo,
      gazeVideo,
      visibleTarget,
      toGazeCrossfadeMs: MASCOT_TO_GAZE_CROSSFADE_MS,
      toBaseCrossfadeMs: MASCOT_TO_BASE_CROSSFADE_MS,
      ...V7_MASCOT_POSE_SPLICE,
      getReferenceTime: () => timelineRef.current?.time() ?? 0,
      onBaseFailed: setVideoFailed,
      onGazeFailed: setGazeVideoFailed,
      onGazeActive: setGazeActive,
      onBridgePhase: setMascotBridgePhase,
    });
    return () => lease.dispose();
  }, [mediaRuntime, useSafariMascotVideo, useLiquidModel]);

  useEffect(() => {
    if (useLiquidModel || V7_MEDIA_RUNTIME_SURFACES.mascot) return;
    if (useSafariMascotVideo === null) {
      videoRef.current?.pause();
      gazeVideoRef.current?.pause();
      return;
    }
    const baseVideo = videoRef.current;
    const gazeVideo = gazeVideoRef.current;
    if (!baseVideo || !gazeVideo) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let gazeTimer = 0;
    let basePlayRetryTimer = 0;
    let baseLoadRequested = baseVideo.readyState !== HTMLMediaElement.HAVE_NOTHING;
    let gazeActivationToken = 0;
    type BoundaryFrameRequest = { id: number; kind: "video" | "animation" };
    let baseFrameRequest: BoundaryFrameRequest | null = null;
    let gazeFrameRequest: BoundaryFrameRequest | null = null;
    let gazeRunActive = false;
    let returnInFlight = false;

    const clearGazeTimer = () => {
      window.clearTimeout(gazeTimer);
      gazeTimer = 0;
    };
    const clearBasePlayRetry = () => {
      window.clearTimeout(basePlayRetryTimer);
      basePlayRetryTimer = 0;
    };
    const requestBoundaryFrame = (
      video: HTMLVideoElement,
      callback: (now: number, mediaTime: number) => void,
    ): BoundaryFrameRequest => {
      if (typeof video.requestVideoFrameCallback === "function") {
        return {
          id: video.requestVideoFrameCallback((now, metadata) => callback(now, metadata.mediaTime)),
          kind: "video",
        };
      }
      return {
        id: window.requestAnimationFrame((now) => callback(now, video.currentTime)),
        kind: "animation",
      };
    };
    const cancelBoundaryFrame = (video: HTMLVideoElement, request: BoundaryFrameRequest | null) => {
      if (!request) return;
      if (request.kind === "video") video.cancelVideoFrameCallback(request.id);
      else window.cancelAnimationFrame(request.id);
    };
    const cancelBaseBoundaryWatch = () => {
      cancelBoundaryFrame(baseVideo, baseFrameRequest);
      baseFrameRequest = null;
    };
    const cancelGazeBoundaryWatch = () => {
      cancelBoundaryFrame(gazeVideo, gazeFrameRequest);
      gazeFrameRequest = null;
    };
    const resumeBaseVideo = () => {
      if (visible && !preference.matches && document.visibilityState === "visible") {
        clearBasePlayRetry();
        if (baseVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          baseVideo.preload = "auto";
          if (!baseLoadRequested) {
            baseLoadRequested = true;
            baseVideo.load();
          }
          return;
        }
        void baseVideo.play().catch(() => {
          if (!visible || preference.matches || document.visibilityState !== "visible") return;
          basePlayRetryTimer = window.setTimeout(resumeBaseVideo, 1200);
        });
      }
    };
    const waitForVideoSeek = (video: HTMLVideoElement, time: number) => new Promise<void>((resolve) => {
      if (Math.abs(video.currentTime - time) <= 0.04) {
        resolve();
        return;
      }

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        video.removeEventListener("seeked", finish);
        resolve();
      };
      const timeout = window.setTimeout(finish, 600);
      video.addEventListener("seeked", finish, { once: true });
      try { video.currentTime = time; } catch { finish(); }
    });
    const handoffStillValid = (activationToken: number) => (
      activationToken === gazeActivationToken
      && visible
      && !preference.matches
      && document.visibilityState === "visible"
    );
    const waitForCrossfade = (duration: number) => new Promise<void>((resolve) => {
      window.setTimeout(resolve, duration);
    });
    const waitForBaseMatch = (activationToken: number) => new Promise<boolean>((resolve) => {
      cancelBaseBoundaryWatch();
      const startedAt = window.performance.now();
      const checkBoundary = (now: number, mediaTime: number) => {
        baseFrameRequest = null;
        if (!handoffStillValid(activationToken)) {
          resolve(false);
          return;
        }

        const duration = baseVideo.duration;
        const currentTime = Number.isFinite(mediaTime) ? mediaTime : baseVideo.currentTime;
        const nearMatch = Number.isFinite(duration)
          && duration > 0
          && currentTime >= MASCOT_BASE_TO_GAZE_MATCH_SECONDS
          && currentTime <= Math.min(duration, MASCOT_BASE_TO_GAZE_MATCH_SECONDS + 0.28);
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
        baseFrameRequest = requestBoundaryFrame(baseVideo, checkBoundary);
      };
      baseFrameRequest = requestBoundaryFrame(baseVideo, checkBoundary);
    });
    let scheduleGaze: (delay?: number) => void = () => undefined;
    const finishGaze = async (activationToken: number) => {
      if (!gazeRunActive || returnInFlight || !handoffStillValid(activationToken)) return;
      gazeRunActive = false;
      returnInFlight = true;
      cancelGazeBoundaryWatch();

      if (Math.abs(baseVideo.currentTime - MASCOT_BASE_MATCH_RESTART_SECONDS) > 0.06) {
        await waitForVideoSeek(baseVideo, MASCOT_BASE_MATCH_RESTART_SECONDS);
      }
      if (!handoffStillValid(activationToken)) {
        returnInFlight = false;
        return;
      }

      try {
        await baseVideo.play();
      } catch {
        setVideoFailed(true);
        returnInFlight = false;
        return;
      }
      if (!handoffStillValid(activationToken)) {
        returnInFlight = false;
        return;
      }

      setMascotBridgePhase("to-base");
      await waitForCrossfade(MASCOT_TO_BASE_CROSSFADE_MS);
      if (!handoffStillValid(activationToken)) {
        returnInFlight = false;
        return;
      }

      setGazeActive(false);
      setMascotBridgePhase("idle");
      gazeVideo.pause();
      returnInFlight = false;
      scheduleGaze(7600);
    };
    const watchGazeReturnBoundary = (activationToken: number) => {
      cancelGazeBoundaryWatch();
      const inspectFrame = (_now: number, mediaTime: number) => {
        gazeFrameRequest = null;
        if (!handoffStillValid(activationToken) || returnInFlight) return;
        if (mediaTime >= MASCOT_GAZE_TO_BASE_MATCH_SECONDS) {
          void finishGaze(activationToken);
          return;
        }
        gazeFrameRequest = requestBoundaryFrame(gazeVideo, inspectFrame);
      };
      gazeFrameRequest = requestBoundaryFrame(gazeVideo, inspectFrame);
    };
    const startGaze = async () => {
      const activationToken = ++gazeActivationToken;
      cancelBaseBoundaryWatch();
      cancelGazeBoundaryWatch();
      gazeRunActive = false;
      returnInFlight = false;
      gazeVideo.pause();
      setGazeActive(false);
      setMascotBridgePhase("idle");

      await waitForVideoSeek(gazeVideo, MASCOT_GAZE_MATCH_START_SECONDS);
      if (!handoffStillValid(activationToken)) return;

      const reachedMatchingBoundary = await waitForBaseMatch(activationToken);
      if (!reachedMatchingBoundary || !handoffStillValid(activationToken)) return;

      try {
        await gazeVideo.play();
        if (!handoffStillValid(activationToken)) return;
        gazeRunActive = true;
        setGazeActive(true);
        setMascotBridgePhase("to-gaze");
        watchGazeReturnBoundary(activationToken);
        await waitForCrossfade(MASCOT_TO_GAZE_CROSSFADE_MS);
        if (!handoffStillValid(activationToken)) return;
        setMascotBridgePhase("idle");
        baseVideo.pause();
        await waitForVideoSeek(baseVideo, MASCOT_BASE_MATCH_RESTART_SECONDS);
      } catch {
        gazeRunActive = false;
        setGazeVideoFailed(true);
        setGazeActive(false);
        setMascotBridgePhase("idle");
        resumeBaseVideo();
      }
    };
    scheduleGaze = (delay = 4200) => {
      clearGazeTimer();
      if (!visible || preference.matches || document.visibilityState !== "visible") return;
      gazeTimer = window.setTimeout(() => {
        gazeTimer = 0;
        if (gazeVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          if (gazeVideo.preload !== "auto") {
            gazeVideo.preload = "auto";
            gazeVideo.load();
          }
          scheduleGaze(1000);
          return;
        }
        resumeBaseVideo();
        void startGaze();
      }, delay);
    };
    const handleGazeTimeUpdate = () => {
      if (gazeVideo.currentTime >= MASCOT_GAZE_TO_BASE_MATCH_SECONDS) {
        void finishGaze(gazeActivationToken);
      }
    };
    const handleGazeEnded = () => { void finishGaze(gazeActivationToken); };
    const stopGaze = () => {
      clearGazeTimer();
      clearBasePlayRetry();
      cancelBaseBoundaryWatch();
      cancelGazeBoundaryWatch();
      gazeActivationToken += 1;
      gazeRunActive = false;
      returnInFlight = false;
      gazeVideo.pause();
      setGazeActive(false);
      setMascotBridgePhase("idle");
      if (preference.matches) {
        try { gazeVideo.currentTime = 0; } catch { /* metadata may not be ready */ }
      }
    };
    const syncPlayback = () => {
      const shouldPlay = visible && !preference.matches && document.visibilityState === "visible";
      if (shouldPlay) {
        resumeBaseVideo();
        scheduleGaze();
      } else {
        stopGaze();
        baseVideo.pause();
        if (preference.matches) {
          try { baseVideo.currentTime = 0; } catch { /* metadata may not be ready */ }
        }
      }
    };
    const visibleTarget = gazeVideo.closest<HTMLElement>(`.${styles.mascotVisibleCrop}`)
      ?? mascotRef.current
      ?? gazeVideo;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0.02 });

    baseVideo.addEventListener("canplay", resumeBaseVideo);
    baseVideo.addEventListener("loadeddata", resumeBaseVideo);
    gazeVideo.addEventListener("timeupdate", handleGazeTimeUpdate);
    gazeVideo.addEventListener("ended", handleGazeEnded);
    const visibleRect = visibleTarget.getBoundingClientRect();
    visible = visibleRect.bottom > 0
      && visibleRect.top < window.innerHeight
      && visibleRect.right > 0
      && visibleRect.left < window.innerWidth;
    observer.observe(visibleTarget);
    preference.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    window.addEventListener("pageshow", syncPlayback);
    window.addEventListener("focus", syncPlayback);
    syncPlayback();
    return () => {
      clearGazeTimer();
      clearBasePlayRetry();
      cancelBaseBoundaryWatch();
      cancelGazeBoundaryWatch();
      gazeActivationToken += 1;
      observer.disconnect();
      preference.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      window.removeEventListener("pageshow", syncPlayback);
      window.removeEventListener("focus", syncPlayback);
      baseVideo.removeEventListener("canplay", resumeBaseVideo);
      baseVideo.removeEventListener("loadeddata", resumeBaseVideo);
      gazeVideo.removeEventListener("timeupdate", handleGazeTimeUpdate);
      gazeVideo.removeEventListener("ended", handleGazeEnded);
      baseVideo.pause();
      gazeVideo.pause();
    };
  }, [useSafariMascotVideo, useLiquidModel]);

  const activeTier = phoneUiCards[activeTierIndex];
  const activeTariff = tariffs[activeTierIndex];
  const mascotRenderer = useLiquidModel
    ? "rigged-3d"
    : prefersReducedMotion === true
    ? "poster"
    : useSafariMascotVideo === true
      ? "safari-packed-alpha"
      : useSafariMascotVideo === false
        ? "alpha-video"
        : "pending";
  const activeTierOverview = v7OverviewByTier[activeTariff.id];
  const activePreparationTools = preparationToolsByTier[activeTariff.id];
  const activeSupportCard = activeSupportCardIndex === null
    ? null
    : supportCardsByTier[activeTierIndex][activeSupportCardIndex];
  const activeSupportDetailId = activeSupportCardIndex === null
    ? undefined
    : `support-detail-${activeTier.id}-${activeSupportCardIndex}`;
  const activeToolPriceContent = activeToolPrice
    ? preparationToolCost(activeToolPrice)
    : null;
  const handleTariffCta = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const origin = serializeRect(event.currentTarget.getBoundingClientRect());
    closeSupportDetail(() => onApply(activeTariff.name, origin));
  };

  return (
    <section
      className={styles.sequence}
      data-testid="liquid-reference-v7-sequence"
      id="hero"
      ref={sequenceRef}
    >
        <div
          className={styles.stage}
          data-motion-mode="pending"
          data-motion-ready="false"
          data-pro-atmosphere-warm="false"
          data-pro-atmosphere-active="false"
          data-pro-proof-wall-active="false"
          data-reveal-state="pending"
          ref={stageRef}
          style={{
            position: "sticky",
            top: 0,
            width: "100%",
            height: "100dvh",
            // Clipping must not create a nested scroll container on iOS.
            overflow: "clip",
            isolation: "isolate",
            background: "url('/media/tier-scene-artwork/basic-material-field.webp') center / cover",
          }}
        >
          <span aria-atomic="true" aria-live="polite" className={styles.srOnly} lang="en" role="status">
            {loadingProgress === 100
              ? "Your lesson space is ready."
              : loadingProblem === "error" ? "Interactive Liquid could not load. Retry or continue without 3D."
                : "Preparing your lesson space and interactive Liquid."}
          </span>
          <div
            className={styles.preinitFrame}
            ref={preinitRef}
            aria-hidden="true"
          >
            <div className={styles.preinitHeader}>
              <b>Хелл оу...</b>
              <span>LEARNING IN MOTION</span>
            </div>
            <div className={styles.loaderArtwork} />
            <div className={styles.loaderFoldMark}>
              {Array.from({ length: 6 }, (_, index) => <i key={`loader-fold-${index}`} />)}
            </div>
            <div className={styles.loaderPanel} lang="en">
              <strong>YOUR ENGLISH<br />TAKES SHAPE.</strong>
              <p>Loading your lesson space and interactive Liquid.</p>
              <div className={styles.loaderStatus}>
                <div className={styles.loaderProgress}>
                  <i style={{ transform: `scaleX(${loadingProgress / 100})` }} />
                </div>
                <small>{loadingProgress}% READY</small>
              </div>
            </div>
          </div>

          {loadingProblem && (loadingProgress < 100 || loadingProblem === "error") && (
            <div className={styles.loadingRecovery} role="status" lang="en">
              <p>{loadingProblem === "error"
                ? "Liquid could not load. Please retry."
                : "Still loading interactive Liquid. The page will open when it is ready."}</p>
              <button type="button" onClick={() => {
                setLoadingProblem(null); setLoadingProgress(0); setModelAttempt(attempt => attempt + 1);
              }}>Retry loading</button>
              <button type="button" onClick={() => {
                setLoadingProblem(null); setLoadingProgress(0); setModelFailed(true);
              }}>Continue without 3D</button>
            </div>
          )}

          <div
            aria-hidden="true"
            className={styles.siteAssembly}
            ref={siteAssemblyRef}
          >
            {Array.from({ length: 6 }, (_, index) => <i key={`site-fold-${index}`} />)}
          </div>

          <div
            className={styles.runtime}
            ref={runtimeRef}
            style={{
              position: "absolute",
              zIndex: 1,
              inset: 0,
              visibility: "hidden",
              opacity: 0,
              pointerEvents: "none",
            }}
          >
            <div className={styles.baseBackground} aria-hidden="true" />
            <div className={styles.openingField} ref={openingFieldRef} aria-hidden="true"><OpeningDepthLayers /></div>
            <div className={styles.structuralWipes} ref={planesRef} aria-hidden="true">
              <span className={styles.planeA} />
              <span className={styles.planeB} />
              <span className={styles.planeC} />
              <span className={styles.planeD} />
            </div>

            <header className={styles.utilityHeader}>
              <a href="#hero" aria-label="На главную — Хелл оу...">Хелл оу...</a>
              <DeviceTiltControl />
              <span lang="en">LEARNING IN MOTION</span>
            </header>

            <div className={styles.openingNote} lang="ru">
              <p>Индивидуально.<br />В вашем темпе.</p>
              <span>Английский для школьников и студентов</span>
            </div>
            <div className={styles.openingHeadlineSystem} ref={headlineRigRef}>
              <div className={styles.headlineHtmlLayer} ref={headlineHtmlRef}>
                <h1
                  aria-label="Choose your pace, format, or plan."
                  className={styles.openingHeadline}
                  lang="en"
                  ref={headlineBaseRef}
                >
                  <span
                    className={`${styles.fixedLine} ${styles.headlineMeasureLine}`}
                    ref={fixedLineRef}
                  >
                    Choose your
                  </span>
                  <span
                    aria-hidden="true"
                    className={styles.dynamicWordViewport}
                    ref={wordViewportRef}
                  >
                    <span className={styles.dynamicWord} data-media-tier={headlineMediaCards[0].id} data-tier="basic" ref={paceWordRef}>
                      <span className={styles.dynamicWordLabel}>pace.</span>
                      <span aria-hidden="true" className={styles.dynamicWordMedia}>
                        <span className={styles.dynamicWordVideoFrame}>
                          <video className={styles.headlineTierVideo} data-video-src={headlineMediaCards[0].loopVideo} loop muted playsInline poster={headlineMediaCards[0].artwork} preload="none" />
                        </span>
                        <span aria-hidden="true" className={styles.materialCurrentEdge} ref={paceMaterialEdgeRef} />
                      </span>
                    </span>
                    <span className={styles.dynamicWord} data-media-tier={headlineMediaCards[1].id} data-tier="standard" ref={formatWordRef}>
                      <span className={styles.dynamicWordLabel}>format.</span>
                      <span aria-hidden="true" className={styles.dynamicWordMedia}>
                        <span className={styles.dynamicWordVideoFrame}>
                          <video className={styles.headlineTierVideo} data-video-src={headlineMediaCards[1].loopVideo} loop muted playsInline poster={headlineMediaCards[1].artwork} preload="none" />
                        </span>
                        <span aria-hidden="true" className={styles.materialCurrentEdge} ref={formatMaterialEdgeRef} />
                      </span>
                    </span>
                    <span className={styles.dynamicWord} data-media-tier={headlineMediaCards[2].id} data-tier="pro" ref={planWordRef}>
                      <span className={styles.dynamicWordLabel}>plan.</span>
                      <span aria-hidden="true" className={styles.dynamicWordMedia}>
                        <span className={styles.dynamicWordVideoFrame}>
                          <video className={styles.headlineTierVideo} data-video-src={headlineMediaCards[2].loopVideo} loop muted playsInline poster={headlineMediaCards[2].artwork} preload="none" />
                        </span>
                        <span aria-hidden="true" className={styles.materialCurrentEdge} ref={planMaterialEdgeRef} />
                      </span>
                    </span>
                    <span className={`${styles.wordMeasurement} ${styles.headlineMeasureLine}`}>
                      plan.
                    </span>
                  </span>
                </h1>
              </div>

              <svg
                aria-hidden="true"
                className={styles.headlineArchitectureSvg}
                preserveAspectRatio="none"
                ref={headlineSvgRef}
              >
                <defs>
                  <mask id={headlineMaskId} maskContentUnits="userSpaceOnUse" maskUnits="userSpaceOnUse">
                    <rect width="100%" height="100%" fill="black" />
                    {["Choose your", "plan."].map((line) => (
                      <text className={styles.headlineMaskLine} fill="white" key={line}>
                        {line}
                      </text>
                    ))}
                  </mask>
                </defs>
                <g className={styles.headlineFloodText} ref={headlineFloodRef}>
                  {["Choose your", "plan."].map((line) => (
                    <text className={styles.headlineFloodLine} key={`flood-${line}`}>
                      {line}
                    </text>
                  ))}
                </g>
                <g mask={`url(#${headlineMaskId})`}>
                  <rect className={styles.maskPaleField} width="100%" height="100%" />
                  <g ref={medallionRootRef}>
                    <g ref={reelCanvasRef}>
                      {medallions.map((item, index) => (
                        <g
                          className={styles.medallion}
                          data-medallion={index}
                          key={item.label}
                          transform={`translate(${item.x} ${item.y})`}
                        >
                          <circle fill={item.color} r={item.r} />
                          <circle className={styles.medallionRing} r={item.r * 0.72} />
                          <text className={styles.medallionLabel} textAnchor="middle" y="12">
                            {item.label}
                          </text>
                        </g>
                      ))}
                    </g>
                  </g>
                </g>
                <g className={styles.headlineMetrics}>
                  {["Choose your", "plan."].map((line) => (
                    <rect className={styles.headlineMetricBox} key={`box-${line}`} />
                  ))}
                  {["Choose your", "plan."].map((line) => (
                    <text className={styles.headlineMetricLine} key={line}>{line}</text>
                  ))}
                </g>
              </svg>
            </div>

            <a
              aria-label="Перейти к выбору тарифа и заявке на урок"
              className={`${styles.openingCta} ${styles.bookingRouteCta} ${styles.bookLessonControl}`}
              data-liquid-model-clearance={useLiquidModel || undefined}
              href="#book-a-lesson"
              lang="ru"
              onClickCapture={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigateToBookingSection();
              }}
              ref={openingCtaRef}
            >
              <span className={styles.bookingRouteCopy}>
                <strong>{bookingRouteLabel}</strong>
                <small>Частные уроки · школьники и студенты</small>
              </span>
            </a>


            <section
              aria-label="Тариф и четыре карточки с подробностями"
              className={styles.fiveCardComposition}
              data-active-tier={phoneUiCards[activeTierIndex].id}
              data-impeccable-target="five-card-composition"
              id="five-card-composition"
              ref={fiveCardCompositionRef}
            >
              <div className={styles.phoneEntryRig} ref={phoneRef}>
                <div className={styles.phoneDepthRig} data-astra-depth="phone">
                <div className={styles.phoneBody} ref={phoneBodyRef}>
                  <div className={styles.minimalPhonePlaceholder}>
                    <div className={styles.phoneChrome}><span lang="en">YOUR LESSON</span><i /></div>
                    {phoneUiCards.map((card, index) => (
                      <div
                        className={styles.phoneUiState}
                        data-tier={card.id}
                        key={card.id}
                        ref={(node) => { phoneUiStateRefs.current[index] = node; }}
                        style={{
                          backgroundImage: `url("${card.artwork}")`,
                          backgroundPosition: card.artworkPosition,
                        }}
                      >
                        {"introVideo" in card ? (
                          <>
                            <video
                              aria-hidden="true"
                              className={`${styles.phoneTierVideo} ${styles.phoneTierProVideo} ${proPlaybackPhase === "intro" ? styles.phoneTierVideoVisible : ""}`}
                              data-video-src={useIOSPerformanceMode ? card.mobileIntroVideo : card.introVideo}
                              key={`pro-intro-${useIOSPerformanceMode ? "ios" : "full"}`}
                              muted
                              onEnded={V7_MEDIA_RUNTIME_SURFACES.phone ? undefined : handleProIntroEnded}
                              playsInline
                              poster={card.artwork}
                              preload="none"
                              ref={(node) => { phoneTierVideoRefs.current[2] = node; }}
                              style={{ objectPosition: card.artworkPosition }}
                            />
                            <video
                              aria-hidden="true"
                              className={`${styles.phoneTierVideo} ${styles.phoneTierProVideo} ${proPlaybackPhase === "idle" ? styles.phoneTierVideoVisible : ""}`}
                              data-video-src={useIOSPerformanceMode ? card.mobileLoopVideo : card.loopVideo}
                              key={`pro-loop-${useIOSPerformanceMode ? "ios" : "full"}`}
                              loop
                              muted
                              playsInline
                              poster={card.artwork}
                              preload="none"
                              ref={(node) => { phoneTierVideoRefs.current[3] = node; }}
                              style={{ objectPosition: card.artworkPosition }}
                            />
                          </>
                        ) : (
                          <video
                            aria-hidden="true"
                            className={styles.phoneTierVideo}
                            data-video-src={useIOSPerformanceMode ? card.mobileLoopVideo : card.loopVideo}
                            key={`${card.id}-${useIOSPerformanceMode ? "ios" : "full"}`}
                            loop
                            muted
                            playsInline
                            poster={card.artwork}
                            preload="none"
                            ref={(node) => { phoneTierVideoRefs.current[index] = node; }}
                            style={{ objectPosition: card.artworkPosition }}
                          />
                        )}
                        <strong className={styles.phoneTierName} lang="en">{card.name}</strong>
                        <em className={styles.phoneAvailability} lang="ru">{availabilityLabels[card.tariffId]}</em>
                        <span>{card.label}</span>
                        <div className={styles.phoneSummary}>
                          <small>{card.detail}</small>
                          <div className={styles.phoneProgress} aria-hidden="true"><i style={{ width: card.progress }} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.paleMaterialWedge} ref={phoneMaterialRef} />
                </div>
                </div>
                <span className={styles.phoneMascotAnchor} ref={phoneAnchorRef} />
              </div>

              <div className={styles.fiveCardScene}>
                {supportCardsByTier[activeTierIndex].map((card, index) => (
                  <div className={`${styles.cardDepthRig} ${styles[`depthCard${index + 1}`]}`} data-astra-depth={`card-${index}`} key={`tier-depth-${index}`}>
                  <button
                    aria-controls={`support-detail-${activeTier.id}-${index}`}
                    aria-expanded={activeSupportCardIndex === index}
                    aria-haspopup="dialog"
                    aria-label={`${card.eyebrow}: ${card.title} Открыть подробности`}
                    className={styles.supportCard}
                    data-visual={card.visual}
                    data-v7-support-card
                    lang="ru"
                    key={`tier-card-${index}`}
                    onClick={(event) => {
                      activeToolPriceRef.current = null;
                      toolPriceTriggerRef.current = null;
                      setActiveToolPrice(null);
                      detailTriggerRef.current = event.currentTarget;
                      detailTriggerRectRef.current = event.currentTarget.getBoundingClientRect();
                      setActiveSupportCardIndex(index);
                    }}
                    ref={(node) => { cardRefs.current[index] = node; }}
                    tabIndex={-1}
                    type="button"
                  >
                    <span>{card.eyebrow}</span>
                    <strong>{card.visual === "price" && card.title === "1 · 4 · 8 занятий." ? <><span className={styles.priceCount}>1 · 4 · 8</span> занятий.</> : card.title}</strong>
                    <small>{card.detail}</small>
                    <div className={styles.cardGlyph} data-length={card.glyph.length} aria-hidden="true">
                      {card.glyph}
                    </div>
                    <b className={styles.cardOpenLabel}>Подробнее</b>
                  </button>
                  </div>
                ))}
              </div>
            </section>

            {activeSupportCard && typeof document !== "undefined" ? createPortal((
              <div
                className={styles.detailBackdrop}
                data-motion-profile={useIOSPerformanceMode ? "ios-efficient" : "full"}
                data-tier={activeTier.id}
                onMouseDown={(event) => {
                  if (!detailPanelRef.current?.contains(event.target as Node)) closeSupportDetail();
                }}
                ref={detailBackdropRef}
              >
                <div aria-hidden="true" className={styles.detailSource}>
                  <span>{activeSupportCard.eyebrow}</span>
                  <strong>{activeSupportCard.title}</strong>
                  <i>{activeSupportCard.glyph}</i>
                </div>
                <div aria-hidden="true" className={styles.detailAssembly}>
                  {Array.from({ length: 6 }, (_, index) => <i key={`detail-fold-${index}`} />)}
                </div>
                <div
                  aria-describedby={`${activeSupportDetailId}-summary`}
                  aria-labelledby={`${activeSupportDetailId}-title`}
                  aria-modal="true"
                  className={styles.supportDetailPanel}
                  data-lenis-prevent
                  id={activeSupportDetailId}
                  ref={detailPanelRef}
                  role="dialog"
                  tabIndex={-1}
                >
                  <button
                    aria-label="Закрыть подробности"
                    className={styles.detailClose}
                    onClick={() => closeSupportDetail()}
                    ref={detailCloseRef}
                    type="button"
                  >
                    ЗАКРЫТЬ <span aria-hidden="true">×</span>
                  </button>
                  <div className={styles.detailHeader}>
                    <span>
                      {activeSupportCard.eyebrow}
                      <small>ТАРИФ {activeTariff.v7Name}</small>
                    </span>
                    <b>{availabilityLabels[activeTariff.id]}</b>
                  </div>
                  <div className={styles.detailBody}>
                    <div>
                      <h2
                        data-compact={activeSupportCard.title.split(/\s+/).some((word) => word.length >= 13) ? "true" : "false"}
                        id={`${activeSupportDetailId}-title`}
                      >
                        {activeSupportCard.title}
                      </h2>
                      <p id={`${activeSupportDetailId}-summary`}>{activeSupportCard.body}</p>
                    </div>
                    <div className={styles.detailHighlights}>
                      <ul>
                        {activeSupportCard.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className={styles.tariffOverview}>
                    <section>
                      <span>КОМУ ПОДХОДИТ</span>
                      <p>{activeTierOverview.fit}</p>
                    </section>
                    <section>
                      <span>ЧТО ВХОДИТ</span>
                      <ul>
                        {activeTierOverview.included.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </section>
                  </div>

                  <section className={styles.packageSection} aria-label={`Стоимость тарифа ${activeTariff.name}`}>
                    <div className={styles.packageHeading}>
                      <span>ДЛИТЕЛЬНОСТЬ · {activeTariff.duration}</span>
                      <b>{activeTariff.packageRule}</b>
                    </div>
                    <div className={styles.packageOptions}>
                      {activeTariff.prices.map((price) => (
                        <div data-lessons={price.lessons} key={price.lessons}>
                          <span>{price.label}</span>
                          <strong>{price.price}</strong>
                          {packageDiscountLabel(activeTariff, price) ? (
                            <small className={styles.packageDiscount}>
                              {packageDiscountLabel(activeTariff, price)}
                            </small>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  {activePreparationTools.length ? (
                    <div
                      className={styles.detailTools}
                      data-has-prices={activePreparationTools.some((tool) => Boolean(preparationToolCost(tool)))}
                    >
                      <span>
                        {activeTariff.id === "basic"
                          ? "ИНСТРУМЕНТЫ BASIC"
                          : "ИНСТРУМЕНТЫ В ПОДГОТОВКЕ И МАТЕРИАЛАХ"}
                      </span>
                      {activeTariff.id !== "basic" ? (
                        <p className={styles.detailToolsTotal}>
                          <span>СТОИМОСТЬ ИСПОЛЬЗУЕМЫХ ПОДПИСОК</span>
                          <strong>{preparationSubscriptionTotal.exact}</strong>
                          <small>{preparationSubscriptionTotal.rounded}</small>
                        </p>
                      ) : null}
                      <div>
                        {activePreparationTools.map((tool) => {
                          const cost = preparationToolCost(tool);
                          const costId = `v7-tool-cost-${activeTariff.id}-${tool.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                          const isActive = activeToolPrice === tool;
                          return (
                            <span
                              className={styles.detailToolToken}
                              data-priced={cost ? "true" : "false"}
                              key={tool}
                            >
                              {cost ? (
                                <button
                                  aria-controls={costId}
                                  aria-expanded={isActive}
                                  onClick={(event) => {
                                    toolPriceTriggerRef.current = event.currentTarget;
                                    if (activeToolPriceRef.current === tool && toolPricePinnedRef.current) {
                                      closeToolPrice(false);
                                      return;
                                    }
                                    // Hover/focus may have previewed this price before the click.
                                    // First activation keeps it open; subsequent activation closes it.
                                    toolPricePinnedRef.current = true;
                                    activeToolPriceRef.current = tool;
                                    setActiveToolPrice(tool);
                                  }}
                                  onFocus={(event) => {
                                    if (toolPriceFocusReturnRef.current) return;
                                    toolPriceTriggerRef.current = event.currentTarget;
                                    if (activeToolPriceRef.current !== tool) toolPricePinnedRef.current = false;
                                    activeToolPriceRef.current = tool;
                                    setActiveToolPrice(tool);
                                  }}
                                  onPointerEnter={(event) => {
                                    toolPriceTriggerRef.current = event.currentTarget;
                                    if (activeToolPriceRef.current !== tool) toolPricePinnedRef.current = false;
                                    activeToolPriceRef.current = tool;
                                    setActiveToolPrice(tool);
                                  }}
                                  type="button"
                                >
                                  {tool}
                                  <span aria-hidden="true">{isActive ? "−" : "₽"}</span>
                                </button>
                              ) : <b>{tool}</b>}
                            </span>
                          );
                        })}
                      </div>
                      {activeToolPriceContent && activeToolPrice ? (
                        <section
                          aria-label={`Стоимость ${activeToolPrice}`}
                          className={styles.detailToolPrice}
                          id={`v7-tool-cost-${activeTariff.id}-${activeToolPrice.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                          role="region"
                        >
                          <span>
                            <small>{activeToolPriceContent.group}</small>
                            <strong>{activeToolPriceContent.price}</strong>
                          </span>
                          <button aria-label="Закрыть стоимость" onClick={() => closeToolPrice()} type="button">
                            <span aria-hidden="true">×</span>
                          </button>
                        </section>
                      ) : null}
                    </div>
                  ) : null}

                  <button
                    aria-haspopup="dialog"
                    className={`${styles.detailCta} ${styles.bookLessonControl}`}
                    data-action={activeTariff.cta.action}
                    data-v7-application-trigger
                    id="v7-detail-application-trigger"
                    lang="ru"
                    onClick={handleTariffCta}
                    type="button"
                  >
                    {applicationButtonLabel}
                  </button>
                </div>
              </div>
            ), document.body) : null}


            <div className={styles.temporaryPhoneOutline} ref={outlineRef} aria-hidden="true">
              <svg viewBox="0 0 500 965" preserveAspectRatio="none">
                <rect
                  className={styles.phoneOutlinePath}
                  height="957"
                  pathLength="1"
                  ref={outlinePathRef}
                  rx="43"
                  width="492"
                  x="4"
                  y="4"
                />
              </svg>
            </div>

            <section className={styles.blockHeadlineScene} ref={blockSceneRef}>
              <h2 className={styles.srOnly} lang="en">SAY WHAT MATTERS.</h2>
              <svg aria-hidden="true" className={styles.blockHeadlineSvg} viewBox="0 0 940 350">
                <defs>
                  <clipPath id={sayMaskId} clipPathUnits="userSpaceOnUse">
                    <rect height="0" ref={sayClipRectRef} width="940" x="0" y="350" />
                  </clipPath>
                </defs>
                <g className={styles.blockGrid} ref={blockGridRef}>
                  {blockCells.map((cell, index) => (
                    <rect
                      className={styles.blockCell}
                      height={cell.height}
                      key={index}
                      rx="10"
                      width={cell.width}
                      x={cell.x}
                      y={cell.y}
                    />
                  ))}
                </g>
                <g className={styles.sayVisual} clipPath={`url(#${sayMaskId})`}>
                  <text textAnchor="middle" x="470" y="145">SAY WHAT</text>
                  <text textAnchor="middle" x="470" y="318">MATTERS.</text>
                </g>
              </svg>
            </section>

            <div className={styles.violetField} ref={violetFieldRef} aria-hidden="true">
              <div className={styles.violetMedallions} ref={violetMedallionsRef}>
                {violetUtilities.map((utility) => (
                  <div
                    className={styles.utilityDepthRig}
                    data-astra-depth={`utility-${utility.id}`}
                    data-utility={utility.id}
                    key={`${utility.value}-${utility.label}`}
                    style={{ "--utility-art": `url("${utility.artwork}")` } as CSSProperties}
                  >
                    <i data-utility={utility.id}>
                      <b>{utility.value}</b>
                      <span>{utility.label}</span>
                    </i>
                  </div>
                ))}
              </div>
            </div>
            <section className={styles.secondHeadline} lang="en" ref={secondHeadlineRef}>
              <h2>TURN YOUR<br />ENGLISH<br />ON</h2>
              <button
                aria-haspopup="dialog"
                className={`${styles.sceneCta} ${styles.bookLessonControl}`}
                data-v7-application-trigger
                id="v7-standard-scene-application-trigger"
                lang="ru"
                onClick={(event) => onApply("Standard", event.currentTarget)}
                ref={secondCtaRef}
                type="button"
              >
                {applicationButtonLabel}
              </button>
            </section>
            <div className={styles.blueField} ref={blueFieldRef} aria-hidden="true" />

            <div className={styles.coralField} ref={coralFieldRef} aria-hidden="true">
              <div className={styles.proTierAtmosphere} ref={proTierAtmosphereRef}>
                <video
                  aria-hidden="true"
                  className={styles.proTierAtmosphereVideo}
                  data-video-src={useIOSPerformanceMode
                    ? "/media/v7-application/pro-application-material-mobile-safari-v1.mp4"
                    : "/media/v7-application/pro-application-material-master-v1-silent.mp4"}
                  data-loop-mode="matched-source-frame"
                  data-ready={isProTierAtmosphereReady ? "true" : "false"}
                  disablePictureInPicture
                  disableRemotePlayback
                  loop
                  muted
                  onCanPlay={() => setIsProTierAtmosphereReady(true)}
                  onError={() => setIsProTierAtmosphereReady(false)}
                  onLoadStart={() => setIsProTierAtmosphereReady(false)}
                  onPlaying={() => setIsProTierAtmosphereReady(true)}
                  playsInline
                  poster="/media/tier-scene-artwork/pro-atmospheric-field.webp"
                  preload="none"
                  ref={proTierAtmosphereVideoRef}
                  tabIndex={-1}
                />
              </div>
              <div
                className={styles.proFocalConvergence}
                data-v7-climax-halo
                ref={proFocalConvergenceRef}
              />
            </div>
            <section
              className={styles.coralHeadline}
              data-v7-climax-headline
              lang="en"
              ref={coralHeadlineRef}
            >
              <h2>LEARN WITH<br />CONFIDENCE</h2>
            </section>
            <div
              className={styles.lessonObject}
              data-v7-climax-object
              ref={lessonObjectRef}
              aria-hidden="true"
            >
              <span>PRO · ПЕРСОНАЛЬНЫЙ ПЛАН</span>
              <b>60<br />МИН</b>
              <small>ПАКЕТЫ · ПОДДЕРЖКА · ПРИОРИТЕТНОЕ ВРЕМЯ</small>
              <i />
              <em className={styles.lessonGlint} />
            </div>

            <section className={styles.proofWall} ref={proofWallRef} aria-label="Подробности тарифа PRO">
              {proofCards.map((card, index) => (
                <div className={styles.proofDepthRig} data-astra-depth={`proof-${index}`} key={`${card.label}-${index}`}>
                  <button
                    aria-controls={`support-detail-pro-${card.detailIndex}`}
                    aria-haspopup="dialog"
                    aria-label={`${card.label}: ${card.value} ${card.detail}. Открыть подробности`}
                    data-v7-proof-card
                    onClick={(event) => {
                      detailTriggerRef.current = event.currentTarget;
                      detailTriggerRectRef.current = event.currentTarget.getBoundingClientRect();
                      setActiveSupportCardIndex(card.detailIndex);
                    }}
                    ref={(node) => { proofCardRefs.current[index] = node; }}
                    style={{ backgroundImage: `url("${card.artwork}")` }}
                    tabIndex={-1}
                    type="button"
                  >
                    <span>{card.label}</span>
                    <strong data-length={card.value.length}>{card.value}</strong>
                    <small>{card.detail}</small>
                    <b className={styles.proofOpenLabel} aria-hidden="true">Подробнее</b>
                  </button>
                </div>
              ))}
            </section>

            <div className={styles.navyField} ref={navyFieldRef} aria-hidden="true" />
            <section className={styles.finalCampaign} lang="en" ref={finalCampaignRef}>
              <span className={styles.finalObject} aria-label="One-to-one lesson">
                <i aria-hidden="true" />
                <span className={styles.finalObjectCopy} aria-hidden="true">
                  <strong>1:1</strong>
                  <small>ONE-TO-ONE<br />LESSON</small>
                </span>
              </span>
              <span className={styles.finalObjectSecondary} aria-label="Lesson booking">
                <i aria-hidden="true" />
                <span className={styles.finalObjectCopy} aria-hidden="true">
                  <strong>AUG</strong>
                  <small>LESSON<br />BOOKING</small>
                </span>
              </span>
              <h2>JUMP INTO<br />ENGLISH</h2>
              <button
                aria-haspopup="dialog"
                className={`${styles.sceneCta} ${styles.bookLessonControl}`}
                data-v7-application-trigger
                id="v7-premium-scene-application-trigger"
                lang="ru"
                onClick={(event) => onApply("Premium", event.currentTarget)}
                ref={finalCtaRef}
                type="button"
              >
                {applicationButtonLabel}
              </button>
            </section>

            <div
              className={styles.mascotStage}
              aria-hidden="true"
              data-mascot-renderer={mascotRenderer}
            >
              <svg className={styles.mascotFilterDefinition} focusable="false">
                <defs>
                  <filter
                    colorInterpolationFilters="sRGB"
                    height="106%"
                    id={mascotEdgeFilterId}
                    width="106%"
                    x="-3%"
                    y="-3%"
                  >
                    <feMorphology in="SourceAlpha" operator="erode" radius="0.75" result="cleanAlpha" />
                    <feComposite in="SourceGraphic" in2="cleanAlpha" operator="in" />
                  </filter>
                </defs>
              </svg>
              <div className={styles.mascotMotionRig} data-liquid-motion-rig ref={mascotRef}>
                <div className={styles.mascotDepthRig} data-astra-depth="mascot">
                <div
                  className={styles.mascotVisibleCrop}
                  data-bridge-phase={mascotBridgePhase}
                  data-gaze-active={gazeActive ? "true" : "false"}
                  data-gaze-failed={gazeVideoFailed ? "true" : "false"}
                  data-gaze-ready={gazeVideoReady ? "true" : "false"}
                  data-mascot-renderer={mascotRenderer}
                  data-video-failed={videoFailed ? "true" : "false"}
                  data-video-ready={videoReady ? "true" : "false"}
                >
                  {useLiquidModel ? <LiquidModel key={modelAttempt} attempt={modelAttempt} onError={handleModelError} /> : (<>
                  <div
                    className={`${styles.mediaCanvas} ${styles.posterCanvas}`}
                    style={mascotRenderer === "alpha-video"
                      ? { filter: `url("#${mascotEdgeFilterId}")` }
                      : undefined}
                  >
                    <Image
                      alt=""
                      className={styles.mascotPoster}
                      fill
                      fetchPriority="high"
                      loading="eager"
                      sizes="(max-width: 899px) 180vw, 68vw"
                      src="/media/mascot/Liquid_cat_poster_alpha_decontaminated.png"
                      unoptimized
                    />
                  </div>
                  <div className={`${styles.mediaCanvas} ${styles.videoCanvas}`}>
                    {prefersReducedMotion === false && useSafariMascotVideo === true ? (
                      <PackedAlphaMascotVideo
                        autoPlay
                        loop
                        mediaRuntime={mediaRuntime}
                        onCanPlay={() => setVideoFailed(false)}
                        onError={() => { setVideoFailed(true); setVideoReady(false); }}
                        onFirstFrame={() => { setVideoFailed(false); setVideoReady(true); }}
                        onLoadStart={() => setVideoReady(false)}
                        preload="auto"
                        src={useIOSPerformanceMode
                          ? "/media/mascot/Liquid_cat_seamless_website_loop_alpha_decontaminated_mobile_safari_packed.mp4"
                          : "/media/mascot/Liquid_cat_seamless_website_loop_alpha_decontaminated_safari_packed.mp4"}
                        testId="liquid-reference-v7-video"
                        videoRef={videoRef}
                      />
                    ) : (
                      <video
                        aria-hidden="true"
                        autoPlay
                        className={styles.mascotVideo}
                        data-testid="liquid-reference-v7-video"
                        loop
                        muted
                        onCanPlay={() => { setVideoFailed(false); setVideoReady(true); }}
                        onLoadedData={() => { setVideoFailed(false); setVideoReady(true); }}
                        onLoadStart={() => setVideoReady(false)}
                        onError={() => { setVideoFailed(true); setVideoReady(false); }}
                        playsInline
                        poster="/media/mascot/Liquid_cat_poster_alpha_decontaminated.png"
                        preload="none"
                        ref={videoRef}
                      >
                        {prefersReducedMotion === false && useSafariMascotVideo === false ? (
                        <source
                          src="/media/mascot/Liquid_cat_seamless_website_loop_alpha_decontaminated.webm"
                          type="video/webm"
                        />
                        ) : null}
                      </video>
                    )}
                  </div>
                  <div className={`${styles.mediaCanvas} ${styles.gazeCanvas}`}>
                    {prefersReducedMotion === false && useSafariMascotVideo === true ? (
                      <PackedAlphaMascotVideo
                        mediaRuntime={mediaRuntime}
                        onCanPlay={() => setGazeVideoFailed(false)}
                        onError={() => {
                          setGazeVideoFailed(true);
                          setGazeVideoReady(false);
                          setGazeActive(false);
                          setMascotBridgePhase("idle");
                        }}
                        onFirstFrame={() => { setGazeVideoFailed(false); setGazeVideoReady(true); }}
                        onLoadStart={() => setGazeVideoReady(false)}
                        preload="none"
                        src={useIOSPerformanceMode
                          ? "/media/mascot/Liquid_gaze_long_alpha_1920x1080_decontaminated_mobile_safari_packed.mp4"
                          : "/media/mascot/Liquid_gaze_long_alpha_1920x1080_decontaminated_safari_packed.mp4"}
                        testId="liquid-reference-v7-gaze-video"
                        videoRef={gazeVideoRef}
                      />
                    ) : (
                      <video
                        aria-hidden="true"
                        className={`${styles.mascotVideo} ${styles.gazeVideo}`}
                        data-testid="liquid-reference-v7-gaze-video"
                        muted
                        onCanPlay={() => { setGazeVideoFailed(false); setGazeVideoReady(true); }}
                        onLoadedData={() => { setGazeVideoFailed(false); setGazeVideoReady(true); }}
                        onLoadStart={() => setGazeVideoReady(false)}
                        onError={() => {
                          setGazeVideoFailed(true);
                          setGazeVideoReady(false);
                          setGazeActive(false);
                          setMascotBridgePhase("idle");
                        }}
                        playsInline
                        poster="/media/mascot/Liquid_cat_poster_alpha_decontaminated.png"
                        preload="none"
                        ref={gazeVideoRef}
                      >
                        {prefersReducedMotion === false && useSafariMascotVideo === false ? (
                        <source
                          src="/media/mascot/Liquid_gaze_long_alpha_1920x1080_decontaminated.webm"
                          type="video/webm"
                        />
                        ) : null}
                      </video>
                    )}
                  </div>
                  </>)}
                </div>
                </div>
              </div>
            </div>

            <div className={styles.scrollCue} ref={cueRef} aria-hidden="true">
              <span>SCROLL</span><i />
            </div>
          </div>
          <pre className={styles.debugOverlay} ref={debugOverlayRef} hidden />
        </div>

        <section
          aria-labelledby="liquid-v7-reduced-details-heading"
          className={`${styles.reducedDetails} ${styles.fiveCardComposition}`}
          data-active-tier={activeTier.id}
        >
          <header lang="en">
            <span>CALM MOTION · FULL DETAIL</span>
            <h2 id="liquid-v7-reduced-details-heading">Explore the lesson details.</h2>
            <p>Choose a format, then open any card for the complete tariff facts.</p>
          </header>
          <div className={styles.reducedTierChoices} role="group" aria-label="Lesson plan for reduced-motion details">
            {phoneUiCards.map((tier, index) => (
              <button
                aria-pressed={activeTierIndex === index}
                data-selected={activeTierIndex === index ? "true" : "false"}
                key={tier.id}
                onClick={() => setActiveTierIndex(index as 0 | 1 | 2)}
                type="button"
              >
                <b>{tier.name}</b>
                <small lang="ru">{availabilityLabels[tier.tariffId]}</small>
              </button>
            ))}
          </div>
          {prefersReducedMotion === true && activeTierIndex === 2 ? (
            <div className={styles.reducedProStage} aria-hidden="true" data-v7-reduced-pro-stage>
              <div
                className={`${styles.lessonObject} ${styles.reducedProLessonObject}`}
                data-v7-reduced-pro-object
              >
                <span>PRO · ПЕРСОНАЛЬНЫЙ ПЛАН</span>
                <b>60<br />МИН</b>
                <small>ПАКЕТЫ · ПОДДЕРЖКА · ПРИОРИТЕТНОЕ ВРЕМЯ</small>
                <i />
              </div>
              <div className={styles.reducedProMascot} data-v7-reduced-pro-mascot>
                <Image
                  alt=""
                  className={styles.reducedProMascotImage}
                  fill
                  sizes="(max-width: 899px) 32vw, 18vw"
                  src="/media/mascot/Liquid_cat_poster_alpha_decontaminated.png"
                  unoptimized
                />
              </div>
            </div>
          ) : null}
          <div className={styles.reducedCardGrid}>
            {supportCardsByTier[activeTierIndex].map((card, index) => (
              <button
                aria-controls={`support-detail-${activeTier.id}-${index}`}
                aria-expanded={activeSupportCardIndex === index}
                aria-haspopup="dialog"
                aria-label={`${card.eyebrow}: ${card.title} Открыть подробности`}
                className={`${styles.supportCard} ${styles.reducedDetailCard}`}
                data-visual={card.visual}
                key={`reduced-tier-card-${index}`}
                onClick={(event) => {
                  detailTriggerRef.current = event.currentTarget;
                  detailTriggerRectRef.current = event.currentTarget.getBoundingClientRect();
                  setActiveSupportCardIndex(index);
                }}
                type="button"
              >
                <span>{card.eyebrow}</span>
                <strong>{card.title}</strong>
                <small>{card.detail}</small>
                <div className={styles.cardGlyph} data-length={card.glyph.length} aria-hidden="true">
                  {card.glyph}
                </div>
                <b className={styles.cardOpenLabel}>ПОДРОБНЕЕ</b>
              </button>
            ))}
          </div>
        </section>
    </section>
  );
}

type V7SubmittedApplication = {
  reference: string;
  createdAt: string;
  parentName: string;
  learnerName: string;
  learnerAgeOrGrade: string;
  englishLevel: string;
  packageLessons: number;
  lessonFormat: "online" | "in-person";
  preferredSchedule: string;
  contactMethod: string;
  contactValue: string;
  goals: string;
};

function V7ContactLinks({ compact = false }: { compact?: boolean }) {
  return (
    <nav
      aria-label="Контакты преподавателя"
      className={styles.verifiedContacts}
      data-compact={compact ? "true" : "false"}
      lang="ru"
    >
      {verifiedContacts.map((contact) => (
        <a aria-label={contact.accessibleName} href={contact.href} key={contact.href}>
          <span>{contact.label}</span>
          <strong>{contact.value}</strong>
        </a>
      ))}
    </nav>
  );
}

function V7ApplicationDialog({
  availabilityLabels,
  mediaRuntime,
  onClose,
  planName,
}: {
  availabilityLabels: AvailabilityLabels;
  mediaRuntime: V7MediaRuntime;
  onClose: () => void;
  planName: TariffName;
}) {
  const setSmoothScrollLocked = useContext(V7SmoothScrollLockContext);
  const idPrefix = V7_APPLICATION_ID_PREFIX;
  const panelRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const proApplicationVideoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const successTitleRef = useRef<HTMLHeadingElement>(null);
  const [submittedApplication, setSubmittedApplication] = useState<V7SubmittedApplication | null>(null);
  const [applicationMessage, setApplicationMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PublicApplicationPayload, string>>>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [isTurnstileLoading, setIsTurnstileLoading] = useState(true);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactMethod, setContactMethod] = useState("telegram");
  const [isProApplicationVideoReady, setIsProApplicationVideoReady] = useState(false);
  const selectedTariff = tariffs.find((tariff) => tariff.name === planName) ?? null;

  const resetTurnstile = useCallback((message: string | null = null) => {
    setTurnstileToken("");
    setTurnstileError(message);
    setIsTurnstileLoading(true);
    setTurnstileResetKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!V7_MEDIA_RUNTIME_SURFACES.applicationPro) return;
    const video = proApplicationVideoRef.current;
    if (!video) return;
    const lease = mediaRuntime.connect({
      kind: "application-pro",
      video,
      loopLeadSeconds: PRO_MATERIAL_LOOP_LEAD_SECONDS,
      loopRestartSeconds: PRO_MATERIAL_LOOP_RESTART_SECONDS,
      onReady: setIsProApplicationVideoReady,
    });
    return () => lease.dispose();
  }, [mediaRuntime, planName]);

  useEffect(() => {
    if (V7_MEDIA_RUNTIME_SURFACES.applicationPro) return;
    const video = proApplicationVideoRef.current;
    if (!video) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopLoopBoundaryWatch = watchProMaterialLoopBoundary(video);
    const syncMotionPreference = () => {
      if (motionPreference.matches) {
        video.pause();
        return;
      }

      void video.play().catch(() => setIsProApplicationVideoReady(false));
    };

    syncMotionPreference();
    motionPreference.addEventListener("change", syncMotionPreference);
    return () => {
      stopLoopBoundaryWatch();
      motionPreference.removeEventListener("change", syncMotionPreference);
    };
  }, [planName]);

  useLayoutEffect(() => {
    if (!planName) return;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const restoreMainInert = inertV7Main();
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    setSmoothScrollLocked(true);
    closeRef.current?.focus({ preventScroll: true });
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (panelRef.current) trapDialogTabKey(event, panelRef.current);
    };
    const handleFocus = (event: FocusEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closeRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", handleKeydown);
    document.addEventListener("focusin", handleFocus);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("focusin", handleFocus);
      document.documentElement.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      restoreMainInert();
      setSmoothScrollLocked(false);
    };
  }, [onClose, planName, setSmoothScrollLocked]);

  useEffect(() => {
    if (submittedApplication) successTitleRef.current?.focus();
  }, [submittedApplication]);

  if (!planName || !selectedTariff || typeof document === "undefined") return null;

  const closeDialog = () => {
    setSubmittedApplication(null);
    setApplicationMessage(null);
    setFieldErrors({});
    setTurnstileToken("");
    setTurnstileError(null);
    setIdempotencyKey(crypto.randomUUID());
    setIsSubmitting(false);
    setIsProApplicationVideoReady(false);
    onClose();
  };
  const revealInvalidField = (field: HTMLElement | null | undefined) => {
    if (!field) return;
    field.focus({ preventScroll: true });
    // This is the fixed, independently scrolling dialog; keep the page underneath still.
    field.scrollIntoView({ block: "center", behavior: "instant" });
  };
  const focusFirstFieldError = (errors: Partial<Record<keyof PublicApplicationPayload, string>>) => {
    const firstFieldName = Object.keys(errors).find((name) => !["turnstileToken", "idempotencyKey", "website"].includes(name));
    if (!firstFieldName) return;
    revealInvalidField(formRef.current?.querySelector<HTMLElement>(`[name="${firstFieldName}"]`));
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      const invalidField = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(":invalid");
      const fieldLabel = invalidField?.dataset.fieldLabel ?? "обязательное поле";
      const errorMessage = `Заполните поле «${fieldLabel}».`;
      if (invalidField?.name) {
        setFieldErrors({ [invalidField.name]: errorMessage });
      }
      setApplicationMessage("Проверьте обязательные поля.");
      revealInvalidField(invalidField);
      return;
    }
    if (!turnstileToken || isTurnstileLoading) {
      setApplicationMessage("Форма ещё не готова к отправке. Обновите проверку и попробуйте снова.");
      return;
    }

    const formData = new FormData(form);
    const payload: PublicApplicationPayload = {
      turnstileToken,
      idempotencyKey,
      website: String(formData.get("website") ?? ""),
      parentName: String(formData.get("parentName") ?? ""),
      learnerName: String(formData.get("learnerName") ?? ""),
      learnerAgeOrGrade: String(formData.get("learnerAgeOrGrade") ?? ""),
      englishLevel: String(formData.get("englishLevel") ?? "") as PublicApplicationPayload["englishLevel"],
      goals: String(formData.get("goals") ?? ""),
      tariffId: selectedTariff.id,
      packageLessons: Number(formData.get("packageLessons")) as 1 | 4 | 8,
      lessonFormat: formData.get("lessonFormat") === "in-person" ? "in-person" : "online",
      preferredSchedule: String(formData.get("preferredSchedule") ?? ""),
      contactMethod: String(formData.get("contactMethod") ?? "") as PublicApplicationPayload["contactMethod"],
      contactValue: String(formData.get("contactValue") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      policyAcknowledged: formData.get("policyAcknowledged") === "on",
      privacyAcknowledged: formData.get("privacyAcknowledged") === "on",
    };

    setIsSubmitting(true);
    setApplicationMessage(null);
    setFieldErrors({});
    try {
      const response = await fetch(applicationApiUrl("/api/applications"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as PublicApplicationSuccess | PublicApplicationFailure;
      if (!response.ok || !body.ok) {
        const failure = body as PublicApplicationFailure;
        setApplicationMessage(failure.message);
        setFieldErrors(failure.errors ?? {});
        focusFirstFieldError(failure.errors ?? {});
        if (failure.errors?.turnstileToken) {
          resetTurnstile("Пройдите защитную проверку ещё раз.");
        }
        return;
      }

      setSubmittedApplication({
        reference: body.reference,
        createdAt: body.createdAt,
        parentName: payload.parentName,
        learnerName: payload.learnerName,
        learnerAgeOrGrade: payload.learnerAgeOrGrade,
        englishLevel: englishLevelOptions.find((option) => option.value === payload.englishLevel)?.label ?? payload.englishLevel,
        packageLessons: payload.packageLessons,
        lessonFormat: payload.lessonFormat,
        preferredSchedule: payload.preferredSchedule,
        contactMethod: contactMethodOptions.find((option) => option.value === payload.contactMethod)?.label ?? payload.contactMethod,
        contactValue: payload.contactValue,
        goals: payload.goals,
      });
    } catch {
      setApplicationMessage("Сеть прервалась, поэтому сохранение не подтверждено. Проверьте подключение и повторите отправку — повтор не создаст дубликат.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldDescription = (fieldName: keyof PublicApplicationPayload) => {
    const error = fieldErrors[fieldName];
    return error ? `${idPrefix}-${fieldName}-error` : undefined;
  };
  const fieldError = (fieldName: keyof PublicApplicationPayload) => fieldErrors[fieldName] ? (
    <small className={styles.applicationFieldError} id={`${idPrefix}-${fieldName}-error`} role="alert">
      {fieldErrors[fieldName]}
    </small>
  ) : null;

  return createPortal((
    <div
      className={styles.applicationBackdrop}
      data-tier={selectedTariff.id === "premium" ? "pro" : selectedTariff.id}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeDialog();
      }}
    >
      <section
        aria-describedby={`${idPrefix}-description`}
        aria-labelledby={`${idPrefix}-title`}
        aria-modal="true"
        className={styles.applicationPanel}
        data-lenis-prevent
        lang="ru"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div
          className={styles.applicationMaterial}
          data-application-pattern={selectedTariff.id === "premium" ? "pro" : selectedTariff.id}
          aria-hidden="true"
        >
          <span className={styles.applicationMaterialTrace} />
          {selectedTariff.id === "premium" ? (
            <video
              aria-hidden="true"
              autoPlay
              className={styles.applicationMaterialVideo}
              data-loop-mode="matched-source-frame"
              data-ready={isProApplicationVideoReady ? "true" : "false"}
              disablePictureInPicture
              disableRemotePlayback
              loop
              muted
              onCanPlay={() => setIsProApplicationVideoReady(true)}
              onError={() => setIsProApplicationVideoReady(false)}
              onLoadStart={() => setIsProApplicationVideoReady(false)}
              onPlaying={() => setIsProApplicationVideoReady(true)}
              playsInline
              poster="/media/tier-scene-artwork/pro-atmospheric-field.webp"
              preload="metadata"
              ref={proApplicationVideoRef}
              tabIndex={-1}
            >
              <source
                media="(max-width: 899px)"
                src="/media/v7-application/pro-application-material-mobile-safari-v1.mp4"
                type="video/mp4"
              />
              <source
                src="/media/v7-application/pro-application-material-master-v1-silent.mp4"
                type="video/mp4"
              />
            </video>
          ) : null}
        </div>
        <button
          aria-label="Закрыть заявку на урок"
          className={styles.applicationClose}
          onClick={closeDialog}
          ref={closeRef}
          type="button"
        >
          ЗАКРЫТЬ <span aria-hidden="true">×</span>
        </button>

        <div className={styles.applicationBody}>
          {submittedApplication ? (
            <div aria-live="polite" className={styles.applicationSuccess}>
            <span aria-hidden="true">✓</span>
            <p>{selectedTariff.v7Name} · <span lang="ru">{availabilityLabels[selectedTariff.id]}</span></p>
            <h2 id={`${idPrefix}-title`} ref={successTitleRef} tabIndex={-1}>
              Заявка сохранена.
            </h2>
            <p className={styles.applicationSuccessDescription} id={`${idPrefix}-description`}>
              Номер подтверждения выдан только после записи в базе. Он подтверждает сохранение заявки, но не оплату и не бронирование времени: первый урок и постоянный слот согласовываются отдельно.
            </p>
            <strong className={styles.applicationReference}>{submittedApplication.reference}</strong>
            <dl className={styles.applicationSummary}>
              <div><dt>Тариф</dt><dd>{selectedTariff.v7Name} · {lessonCountLabel(submittedApplication.packageLessons)}</dd></div>
              <div><dt>Контактное лицо</dt><dd>{submittedApplication.parentName}</dd></div>
              <div><dt>Ученик</dt><dd>{submittedApplication.learnerName} · {submittedApplication.learnerAgeOrGrade}</dd></div>
              <div><dt>Уровень</dt><dd>{submittedApplication.englishLevel}</dd></div>
              <div><dt>Формат</dt><dd>{submittedApplication.lessonFormat === "in-person" ? "Очно · Пенза" : "Онлайн"}</dd></div>
              <div><dt>Контакт</dt><dd>{submittedApplication.contactMethod} · {submittedApplication.contactValue}</dd></div>
              <div className={styles.applicationSummaryWide}><dt>Удобное время</dt><dd>{submittedApplication.preferredSchedule}</dd></div>
              <div className={styles.applicationSummaryWide}><dt>Цель занятий</dt><dd>{submittedApplication.goals}</dd></div>
            </dl>
            <div className={styles.applicationSuccessActions}>
              <button className={`${styles.applicationSubmit} ${styles.bookLessonControl}`} onClick={closeDialog} type="button">
                ВЕРНУТЬСЯ НА САЙТ
              </button>
            </div>
            <p className={styles.applicationCopyStatus}>Для исправления или удаления заявки используйте любой опубликованный контакт и укажите номер подтверждения.</p>
            <V7ContactLinks compact />
            </div>
          ) : (
            <form
            aria-describedby={`${idPrefix}-required-note ${idPrefix}-privacy-note`}
            className={styles.applicationForm}
            noValidate
            onInput={(event) => {
              const name = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).name as keyof PublicApplicationPayload;
              if (fieldErrors[name]) {
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next[name];
                  return next;
                });
              }
              if (applicationMessage) setApplicationMessage(null);
            }}
            onSubmit={(event) => void handleSubmit(event)}
            ref={formRef}
          >
            <header className={styles.applicationHeading}>
              <p>{selectedTariff.v7Name} · <span lang="ru">{availabilityLabels[selectedTariff.id]}</span></p>
              <h2 id={`${idPrefix}-title`} lang="ru">Заявка на урок.</h2>
              <p id={`${idPrefix}-description`}>
                Заполните данные контактного лица и ученика, выберите пакет и удобное время. Сайт сохранит заявку и выдаст номер подтверждения.
              </p>
            </header>
            <p className={styles.applicationRequiredNote} id={`${idPrefix}-required-note`}>
              Все поля, кроме «Комментарий», обязательны. Отправка заявки не означает оплату или автоматическое зачисление.
            </p>
            <aside className={styles.applicationPlanContext} aria-label={`Кому подходит тариф ${selectedTariff.v7Name}`}>
              <strong>{tariffDecisionLine(selectedTariff.id)}</strong>
              {selectedTariff.id === "premium" ? <p>{proDashboardBenefit}</p> : null}
            </aside>
            {applicationMessage ? (
              <p className={styles.applicationValidation} id={`${idPrefix}-validation`} role="alert">{applicationMessage}</p>
            ) : null}

            <div className={styles.applicationTokenState} data-error={turnstileError ? "true" : "false"}>
              <span>{isTurnstileLoading
                ? "ЗАГРУЖАЮ ЗАЩИТНУЮ ПРОВЕРКУ…"
                : turnstileToken
                  ? "ЗАЩИТНАЯ ПРОВЕРКА ПРОЙДЕНА"
                  : "ПРОЙДИТЕ ЗАЩИТНУЮ ПРОВЕРКУ"}</span>
              <TurnstileWidget
                key={turnstileResetKey}
                onError={(message) => {
                  setTurnstileToken("");
                  setTurnstileError(message);
                  setIsTurnstileLoading(false);
                }}
                onReady={() => {
                  setTurnstileError(null);
                  setIsTurnstileLoading(false);
                }}
                onToken={(token) => {
                  setTurnstileToken(token);
                  setTurnstileError(null);
                  setIsTurnstileLoading(false);
                }}
              />
              {turnstileError ? <p>{turnstileError}</p> : null}
              {turnstileError ? (
                <button disabled={isTurnstileLoading} onClick={() => resetTurnstile()} type="button">
                  ПОВТОРИТЬ ПРОВЕРКУ
                </button>
              ) : null}
            </div>

            <div className={styles.applicationFields}>
              <label htmlFor={`${idPrefix}-parentName`}>
                <span>Имя контактного лица</span>
                <input
                  aria-describedby={fieldDescription("parentName")}
                  aria-invalid={Boolean(fieldErrors.parentName)}
                  autoComplete="name"
                  data-field-label="Имя контактного лица"
                  id={`${idPrefix}-parentName`}
                  maxLength={applicationLimits.parentName}
                  name="parentName"
                  placeholder="Например: Анна"
                  required
                />
                {fieldError("parentName")}
              </label>
              <label htmlFor={`${idPrefix}-learnerName`}>
                <span>Имя или инициалы ученика</span>
                <input
                  aria-describedby={fieldDescription("learnerName")}
                  aria-invalid={Boolean(fieldErrors.learnerName)}
                  data-field-label="Имя или инициалы ученика"
                  id={`${idPrefix}-learnerName`}
                  maxLength={applicationLimits.learnerName}
                  name="learnerName"
                  placeholder="Например: Маша или М."
                  required
                />
                {fieldError("learnerName")}
              </label>
              <label htmlFor={`${idPrefix}-learnerAgeOrGrade`}>
                <span>Класс / курс — если применимо</span>
                <input
                  aria-describedby={fieldDescription("learnerAgeOrGrade")}
                  aria-invalid={Boolean(fieldErrors.learnerAgeOrGrade)}
                  data-field-label="Класс или курс — если применимо"
                  id={`${idPrefix}-learnerAgeOrGrade`}
                  maxLength={applicationLimits.learnerAgeOrGrade}
                  name="learnerAgeOrGrade"
                  placeholder="Например: 8 класс или 2 курс"
                  required
                />
                {fieldError("learnerAgeOrGrade")}
              </label>
              <label htmlFor={`${idPrefix}-englishLevel`}>
                <span>Примерный уровень</span>
                <select
                  aria-describedby={fieldDescription("englishLevel")}
                  aria-invalid={Boolean(fieldErrors.englishLevel)}
                  data-field-label="Примерный уровень английского"
                  defaultValue=""
                  id={`${idPrefix}-englishLevel`}
                  name="englishLevel"
                  required
                >
                  <option disabled value="">Выберите уровень</option>
                  {englishLevelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {fieldError("englishLevel")}
              </label>
              <label className={styles.applicationFieldWide} htmlFor={`${idPrefix}-goals`}>
                <span>Цель занятий</span>
                <textarea
                  aria-describedby={fieldDescription("goals")}
                  aria-invalid={Boolean(fieldErrors.goals)}
                  data-field-label="Цель занятий"
                  id={`${idPrefix}-goals`}
                  maxLength={applicationLimits.goals}
                  minLength={10}
                  name="goals"
                  placeholder="Например: разобраться с грамматикой, увереннее говорить и самостоятельно выполнять домашние задания"
                  required
                  rows={3}
                />
                {fieldError("goals")}
              </label>
              <label htmlFor={`${idPrefix}-packageLessons`}>
                <span>Пакет · {selectedTariff.v7Name}</span>
                <select
                  aria-describedby={fieldDescription("packageLessons")}
                  aria-invalid={Boolean(fieldErrors.packageLessons)}
                  data-field-label="Пакет занятий"
                  id={`${idPrefix}-packageLessons`}
                  name="packageLessons"
                  required
                >
                  {packagesByTariff[selectedTariff.id].map((lessons) => {
                    const price = selectedTariff.prices.find((item) => item.lessons === lessons);
                    return <option key={lessons} value={lessons}>{lessonCountLabel(lessons)} · {price?.price}</option>;
                  })}
                </select>
                {fieldError("packageLessons")}
              </label>
              <fieldset className={styles.applicationFieldWide}>
                <legend>Формат занятия</legend>
                <div className={styles.applicationChoices}>
                  <label htmlFor={`${idPrefix}-online`}>
                    <input data-field-label="Формат занятия" defaultChecked id={`${idPrefix}-online`} name="lessonFormat" required type="radio" value="online" />
                    <span>Онлайн</span>
                  </label>
                  <label htmlFor={`${idPrefix}-in-person`}>
                    <input data-field-label="Формат занятия" id={`${idPrefix}-in-person`} name="lessonFormat" required type="radio" value="in-person" />
                    <span>Очно · Пенза</span>
                  </label>
                </div>
                {fieldError("lessonFormat")}
              </fieldset>
              <label className={styles.applicationFieldWide} htmlFor={`${idPrefix}-preferredSchedule`}>
                <span>Предпочтительные дни и время</span>
                <textarea
                  aria-describedby={fieldDescription("preferredSchedule")}
                  aria-invalid={Boolean(fieldErrors.preferredSchedule)}
                  data-field-label="Предпочтительные дни и время"
                  id={`${idPrefix}-preferredSchedule`}
                  maxLength={applicationLimits.preferredSchedule}
                  name="preferredSchedule"
                  placeholder="Например: вторник и четверг после 18:00; суббота до 14:00"
                  required
                  rows={2}
                />
                {fieldError("preferredSchedule")}
              </label>
              <label htmlFor={`${idPrefix}-contactMethod`}>
                <span>Как связаться</span>
                <select
                  aria-describedby={fieldDescription("contactMethod")}
                  aria-invalid={Boolean(fieldErrors.contactMethod)}
                  data-field-label="Способ связи"
                  id={`${idPrefix}-contactMethod`}
                  name="contactMethod"
                  onChange={(event) => setContactMethod(event.target.value)}
                  required
                  value={contactMethod}
                >
                  {contactMethodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {fieldError("contactMethod")}
              </label>
              <label htmlFor={`${idPrefix}-contactValue`}>
                <span>{contactMethodOptions.find((option) => option.value === contactMethod)?.label ?? "Контакт"}</span>
                <input
                  aria-describedby={fieldDescription("contactValue")}
                  aria-invalid={Boolean(fieldErrors.contactValue)}
                  autoComplete={contactMethod === "email" ? "email" : contactMethod === "phone" ? "tel" : "off"}
                  data-field-label="Контакт для связи"
                  id={`${idPrefix}-contactValue`}
                  maxLength={applicationLimits.contactValue}
                  name="contactValue"
                  placeholder={contactMethod === "email" ? "name@example.com" : contactMethod === "phone" ? "+7 900 000-00-00" : "@username"}
                  required
                  type={contactMethod === "email" ? "email" : contactMethod === "phone" ? "tel" : "text"}
                />
                {fieldError("contactValue")}
              </label>
              <label className={styles.applicationFieldWide} htmlFor={`${idPrefix}-notes`}>
                <span>Комментарий <small>необязательно</small></span>
                <textarea
                  aria-describedby={fieldDescription("notes")}
                  aria-invalid={Boolean(fieldErrors.notes)}
                  id={`${idPrefix}-notes`}
                  maxLength={applicationLimits.notes}
                  name="notes"
                  placeholder="Что ещё важно знать перед первым разговором"
                  rows={2}
                />
                {fieldError("notes")}
              </label>
            </div>

            <aside className={styles.applicationPolicy} aria-label="Условия резервирования времени">
              <strong>Перед отправкой · {selectedTariff.v7Name}</strong>
              <p>{reservedSlotPolicy}</p>
              <p><b>{selectedTariff.transferPolicy}</b></p>
              <details>
                <summary>Общие правила расписания</summary>
                <ul>{sharedScheduleRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
              </details>
            </aside>

            <div className={styles.applicationConsent}>
              <label htmlFor={`${idPrefix}-policyAcknowledged`}>
                <input
                  aria-describedby={fieldDescription("policyAcknowledged")}
                  aria-invalid={Boolean(fieldErrors.policyAcknowledged)}
                  id={`${idPrefix}-policyAcknowledged`}
                  name="policyAcknowledged"
                  required
                  type="checkbox"
                />
                <span>Я прочитал(а) и принимаю условия постоянного слота, пропусков и переносов.</span>
              </label>
              {fieldError("policyAcknowledged")}
              <label htmlFor={`${idPrefix}-privacyAcknowledged`}>
                <input
                  aria-describedby={`${idPrefix}-privacy-note ${fieldDescription("privacyAcknowledged") ?? ""}`.trim()}
                  aria-invalid={Boolean(fieldErrors.privacyAcknowledged)}
                  id={`${idPrefix}-privacyAcknowledged`}
                  name="privacyAcknowledged"
                  required
                  type="checkbox"
                />
                <span>Я согласен(на) на хранение и обработку данных этой заявки для обсуждения и организации урока.</span>
              </label>
              {fieldError("privacyAcknowledged")}
              <p id={`${idPrefix}-privacy-note`}>Сохраняются только данные из формы: сведения о контактном лице и ученике, учебная цель, тариф, расписание и контакт. Исправить или удалить заявку можно через опубликованные ниже контакты.</p>
            </div>

            <label className={styles.applicationHoneypot} aria-hidden="true">
              <span>Ваш сайт</span>
              <input autoComplete="off" name="website" tabIndex={-1} type="text" />
            </label>

            <V7ContactLinks compact />

            <footer className={styles.applicationFooter}>
              <small>СОХРАНЕНИЕ В ЗАЩИЩЁННОЙ БАЗЕ · НОМЕР ПОСЛЕ УСПЕХА</small>
              <button
                aria-busy={isSubmitting}
                className={`${styles.applicationSubmit} ${styles.bookLessonControl}`}
                disabled={isSubmitting || isTurnstileLoading || !turnstileToken}
                lang="ru"
                type="submit"
              >
                {isSubmitting ? "СОХРАНЯЮ ЗАЯВКУ…" : "ОТПРАВИТЬ ЗАЯВКУ"}
              </button>
            </footer>
            </form>
          )}
        </div>
      </section>
    </div>
  ), document.body);
}

function FooterBrandMaterial({ mediaRuntime }: { mediaRuntime: V7MediaRuntime }) {
  const brandRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const materialVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!V7_MEDIA_RUNTIME_SURFACES.footerMaterial) return;
    const brand = brandRef.current;
    const canvas = canvasRef.current;
    const video = materialVideoRef.current;
    if (!brand || !canvas || !video) return;
    const renderer = createFooterMaterialRenderer(brand, canvas, video, FOOTER_BRAND_TEXT);
    const lease = mediaRuntime.connect({
      kind: "footer-material",
      brand,
      video,
      renderer,
      onReady: (ready) => { brand.dataset.materialReady = ready ? "true" : "false"; },
    });
    return () => lease.dispose();
  }, [mediaRuntime]);

  useEffect(() => {
    if (V7_MEDIA_RUNTIME_SURFACES.footerMaterial) return;
    const brand = brandRef.current;
    const canvas = canvasRef.current;
    const video = materialVideoRef.current;
    if (!brand || !canvas || !video) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const glyphMaskCanvas = document.createElement("canvas");
    let visible = false;
    let videoFrameRequest = 0;
    let animationFrameRequest = 0;
    let lastCanvasPaint = Number.NEGATIVE_INFINITY;

    const cancelDrawLoop = () => {
      if (videoFrameRequest && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(videoFrameRequest);
      }
      if (animationFrameRequest) window.cancelAnimationFrame(animationFrameRequest);
      videoFrameRequest = 0;
      animationFrameRequest = 0;
    };
    const clearMaterial = () => {
      const context = canvas.getContext("2d");
      if (context) context.clearRect(0, 0, canvas.width, canvas.height);
      brand.dataset.materialReady = "false";
    };

    // Keep one visible glyph layer in every browser. The static HTML lettering
    // remains the failure/reduced-motion fallback and is hidden only after the
    // approved material source has produced a successfully masked frame.
    brand.dataset.materialRenderer = "single-layer";
    brand.dataset.materialMode = "source-video";
    const drawMaterial = () => {
      if (
        preference.matches
        || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        || !video.videoWidth
        || !video.videoHeight
      ) {
        clearMaterial();
        return;
      }

      const bounds = brand.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
      const pixelHeight = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (glyphMaskCanvas.width !== pixelWidth || glyphMaskCanvas.height !== pixelHeight) {
        glyphMaskCanvas.width = pixelWidth;
        glyphMaskCanvas.height = pixelHeight;
      }

      const context = canvas.getContext("2d");
      const glyphMaskContext = glyphMaskCanvas.getContext("2d");
      if (!context || !glyphMaskContext) return;
      const computed = window.getComputedStyle(brand);
      const width = bounds.width;
      const height = bounds.height;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      glyphMaskContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      glyphMaskContext.clearRect(0, 0, width, height);

      glyphMaskContext.font = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
      glyphMaskContext.textAlign = "left";
      glyphMaskContext.textBaseline = "alphabetic";
      const metrics = glyphMaskContext.measureText(FOOTER_BRAND_TEXT);
      const fontAscent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent;
      const fontDescent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent;
      const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 0.84;
      const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
      const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0;
      const baseline = paddingTop + (lineHeight - fontAscent - fontDescent) / 2 + fontAscent;
      const tracking = Number.parseFloat(computed.letterSpacing) || 0;
      const paintGlyphMask = () => {
        glyphMaskContext.fillStyle = "#fff";
        glyphMaskContext.strokeStyle = "#fff";
        glyphMaskContext.lineJoin = "round";
        glyphMaskContext.lineWidth = Math.max(1.25, Number.parseFloat(computed.fontSize) * 0.016);
        let glyphX = paddingLeft - glyphMaskContext.measureText(FOOTER_BRAND_TEXT[0]).actualBoundingBoxLeft;
        Array.from(FOOTER_BRAND_TEXT).forEach((glyph, index, glyphs) => {
          glyphMaskContext.strokeText(glyph, glyphX, baseline);
          glyphMaskContext.fillText(glyph, glyphX, baseline);
          glyphX += glyphMaskContext.measureText(glyph).width;
          if (index < glyphs.length - 1) glyphX += tracking;
        });
      };

      // The approved source diamond sits in the lower-right field. Constraining the
      // crop to this upper-middle band keeps only the liquid light material in view.
      const safeTop = video.videoHeight * 0.14;
      const safeBottom = video.videoHeight * 0.58;
      const safeHeight = safeBottom - safeTop;
      const targetAspect = width / height;
      let sourceWidth = video.videoWidth;
      let sourceHeight = sourceWidth / targetAspect;
      let sourceX = 0;
      let sourceY = safeTop + (safeHeight - sourceHeight) / 2;
      if (sourceHeight > safeHeight) {
        sourceHeight = safeHeight;
        sourceWidth = sourceHeight * targetAspect;
        sourceX = (video.videoWidth - sourceWidth) / 2;
        sourceY = safeTop;
      }

      try {
        // Build the text alpha separately. iOS Safari can ignore source-in when a
        // decoded video is the incoming source; applying a stable offscreen mask
        // after the video frame prevents rectangular leakage without duplicating
        // the live lettering layer.
        paintGlyphMask();
        context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        context.globalCompositeOperation = "destination-in";
        context.drawImage(glyphMaskCanvas, 0, 0, pixelWidth, pixelHeight, 0, 0, width, height);
      } catch {
        clearMaterial();
        return;
      }
      context.globalCompositeOperation = "source-over";
      brand.dataset.materialReady = "true";
    };
    const startDrawLoop = () => {
      cancelDrawLoop();
      if (typeof video.requestVideoFrameCallback === "function") {
        const onVideoFrame: VideoFrameRequestCallback = () => {
          videoFrameRequest = 0;
          drawMaterial();
          if (visible && !preference.matches && !video.paused) {
            videoFrameRequest = video.requestVideoFrameCallback(onVideoFrame);
          }
        };
        videoFrameRequest = video.requestVideoFrameCallback(onVideoFrame);
      } else {
        const onAnimationFrame = (time: number) => {
          animationFrameRequest = 0;
          if (time - lastCanvasPaint >= 1000 / 24) {
            drawMaterial();
            lastCanvasPaint = time;
          }
          if (visible && !preference.matches && !video.paused) {
            animationFrameRequest = window.requestAnimationFrame(onAnimationFrame);
          }
        };
        animationFrameRequest = window.requestAnimationFrame(onAnimationFrame);
      }
    };
    const syncPlayback = () => {
      const shouldPlay = visible && !preference.matches && document.visibilityState === "visible";
      if (!shouldPlay) {
        cancelDrawLoop();
        video.pause();
        if (preference.matches) clearMaterial();
        return;
      }
      ensureDeferredVideoSource(video, "auto");
      void video.play()
        .then(startDrawLoop)
        .catch(clearMaterial);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0.02 });
    const resizeObserver = new ResizeObserver(() => drawMaterial());
    const handleLoadedData = () => {
      drawMaterial();
      syncPlayback();
    };
    const handleError = () => clearMaterial();
    const handlePageShow = () => syncPlayback();
    const handlePageHide = () => {
      cancelDrawLoop();
      video.pause();
    };

    observer.observe(brand);
    resizeObserver.observe(brand);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);
    preference.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);
    syncPlayback();

    return () => {
      cancelDrawLoop();
      observer.disconnect();
      resizeObserver.disconnect();
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
      preference.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
      releaseDeferredVideoSource(video);
    };
  }, []);

  return (
    <div
      className={styles.footerBrand}
      data-material-ready="false"
      data-material-source="premium-tariff-field-seamless"
      ref={brandRef}
    >
      <span className={styles.footerBrandBase}>{FOOTER_BRAND_TEXT}</span>
      <canvas aria-hidden="true" className={styles.footerBrandMaterialCanvas} ref={canvasRef} />
      <video
        aria-hidden="true"
        className={styles.footerBrandMaterialSource}
        data-video-src="/media/premium-tariff-field-seamless.mp4"
        loop
        muted
        playsInline
        preload="none"
        ref={materialVideoRef}
        tabIndex={-1}
      />
    </div>
  );
}

function LiquidReferenceHeroV7NormalFlow({
  availabilityLabels,
  mediaRuntime,
  onApply,
}: {
  availabilityLabels: AvailabilityLabels;
  mediaRuntime: V7MediaRuntime;
  onApply: V7ApplicationHandler;
}) {
  const [selectedPlan, setSelectedPlan] = useState<TariffName>("Standard");
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [activeMaterialToolId, setActiveMaterialToolId] = useState<MaterialTickerToolId | null>(null);
  const flowStorySectionRef = useRef<HTMLElement>(null);
  const tickerSectionRef = useRef<HTMLElement>(null);
  const tickerTrackRefs = useRef<Array<HTMLDivElement | null>>([]);
  const materialToolTriggerRef = useRef<HTMLButtonElement | null>(null);
  const startHereRef = useRef<HTMLElement>(null);
  const faqIdPrefix = V7_FAQ_ID_PREFIX;
  const selectedTariff = tariffs.find((tariff) => tariff.name === selectedPlan) ?? tariffs[1];
  const selectedPhoneCard = phoneUiCards.find((card) => card.tariffId === selectedTariff.id) ?? phoneUiCards[1];
  const selectedPriceSummary = selectedTariff.prices
    .map((price) => packagePriceLine(price, selectedTariff))
    .join(" · ");
  const activeMaterialTool = materialTickerTools.find((tool) => tool.id === activeMaterialToolId) ?? null;
  const closeMaterialTool = useCallback((restoreFocus = true) => {
    setActiveMaterialToolId(null);
    if (restoreFocus) {
      window.setTimeout(() => materialToolTriggerRef.current?.focus({ preventScroll: true }), 0);
    }
  }, []);
  const selectMaterialTool = useCallback((toolId: MaterialTickerToolId, trigger: HTMLButtonElement | null) => {
    materialToolTriggerRef.current = trigger;
    setActiveMaterialToolId(toolId);
  }, []);
  const navigateToSequenceReference = (referenceTime: number, hash: string) => {
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new CustomEvent(V7_SEQUENCE_NAVIGATION_EVENT, {
      detail: { referenceTime },
    }));
  };

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const section = flowStorySectionRef.current;
    if (!section) return;

    const selectStepFromProgress = (progress: number) => {
      const nextIndex = Math.min(
        flowStorySteps.length - 1,
        Math.floor(gsap.utils.clamp(0, 0.999, progress) * flowStorySteps.length),
      );
      setActiveStoryIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);
      section.dataset.storyStep = String(nextIndex + 1);
    };
    const storyTrigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onRefresh: ({ progress }) => selectStepFromProgress(progress),
      onUpdate: ({ progress }) => selectStepFromProgress(progress),
    });

    selectStepFromProgress(storyTrigger.progress);
    return () => storyTrigger.kill();
  }, []);

  useEffect(() => {
    if (!activeMaterialToolId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMaterialTool();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMaterialToolId, closeMaterialTool]);

  useEffect(() => {
    const section = tickerSectionRef.current;
    if (!section) return;

    const routeCloneActivation = (event: MouseEvent) => {
      const clone = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-material-tool-clone][data-tool]")
        : null;
      if (!clone || !section.contains(clone)) return;
      const toolId = clone.dataset.tool as MaterialTickerToolId | undefined;
      if (!toolId || !materialTickerTools.some((tool) => tool.id === toolId)) return;
      const canonicalControl = section.querySelector<HTMLButtonElement>(
        `[data-material-tool-control][data-tool="${toolId}"]`,
      );
      if (!canonicalControl) return;
      selectMaterialTool(toolId, canonicalControl);
    };

    section.addEventListener("click", routeCloneActivation);
    return () => section.removeEventListener("click", routeCloneActivation);
  }, [selectMaterialTool]);

  useEffect(() => {
    const section = tickerSectionRef.current;
    const tracks = tickerTrackRefs.current.filter(
      (track): track is HTMLDivElement => track instanceof HTMLDivElement,
    );
    const rows = tracks.map((track) => ({
      mask: track.parentElement instanceof HTMLDivElement ? track.parentElement : null,
      set: track.querySelector<HTMLElement>(`.${styles.materialTickerSet}`),
      track,
    }));
    if (
      !section
      || rows.length !== 2
      || rows.some((row) => !row.mask || !row.set)
    ) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const BASE_SPEED = 12;
    const INPUT_HOLD_MS = 70;

    let animationFrame = 0;
    let previousTimestamp = performance.now();
    let previousScrollY = window.scrollY;
    let positions = [0, 0];
    let boost = 0;
    let targetBoost = 0;
    let isVisible = false;
    let hasMeasured = false;
    let focusWithin = section.contains(document.activeElement);
    let isReduced = motionPreference.matches;
    let lastInputTimestamp = Number.NEGATIVE_INFINITY;
    let previousScrollTimestamp = performance.now();
    let setWidths = rows.map((row) => row.set?.getBoundingClientRect().width ?? 1);

    const wrapTrackPosition = (position: number, width: number) => {
      let wrapped = position;
      while (wrapped > 0) wrapped -= width;
      while (wrapped < -width) wrapped += width;
      return wrapped;
    };
    const applyPositions = () => {
      rows.forEach((row, index) => {
        row.track.style.transform = `translate3d(${positions[index].toFixed(3)}px, 0, 0)`;
      });
    };

    const revealFocusedTool = (element: Element | null = document.activeElement) => {
      if (isReduced || !(element instanceof HTMLElement)) return;
      rows.forEach((row, index) => {
        if (!row.mask || !row.track.contains(element)) return;
        // Native focus can scroll the overflow mask; the track owns horizontal placement.
        row.mask.scrollLeft = 0;
        const mask = row.mask.getBoundingClientRect();
        const control = element.getBoundingClientRect();
        const inset = 8;
        const shift = control.left < mask.left + inset ? mask.left + inset - control.left
          : control.right > mask.right - inset ? mask.right - inset - control.right : 0;
        positions[index] += shift;
      });
      applyPositions();
    };
    const measure = () => {
      if (isReduced) return;
      setWidths = rows.map((row) => Math.max(row.set?.getBoundingClientRect().width ?? 1, 1));
      if (!hasMeasured) {
        positions = [-setWidths[0], 0];
        hasMeasured = true;
      } else {
        positions = positions.map((position, index) => (
          wrapTrackPosition(position, setWidths[index])
        ));
      }
      applyPositions();
      if (focusWithin) revealFocusedTool();
    };
    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      const timestamp = performance.now();
      if (!isVisible || isReduced) {
        previousScrollY = nextScrollY;
        previousScrollTimestamp = timestamp;
        return;
      }
      const rawElapsedSeconds = (timestamp - previousScrollTimestamp) / 1000;
      const elapsedSeconds = gsap.utils.clamp(1 / 120, 1 / 20, rawElapsedSeconds);
      const scrollDelta = nextScrollY - previousScrollY;
      const scrollVelocity = scrollDelta / elapsedSeconds;
      if (Math.abs(scrollDelta) > 0.05) {
        const desiredDrive = Math.sign(scrollVelocity) * gsap.utils.clamp(
          48,
          96,
          Math.abs(scrollVelocity) * 0.09,
        );
        const currentDrive = BASE_SPEED + boost;
        if (
          Math.sign(currentDrive) !== 0
          && Math.sign(currentDrive) !== Math.sign(desiredDrive)
        ) {
          boost = Math.sign(desiredDrive) * Math.abs(currentDrive) - BASE_SPEED;
        }
        targetBoost = desiredDrive - BASE_SPEED;
        lastInputTimestamp = timestamp;
        section.dataset.scrollDirection = scrollDelta > 0 ? "down" : "up";
      }
      previousScrollY = nextScrollY;
      previousScrollTimestamp = timestamp;
    };
    const tick = (timestamp: number) => {
      animationFrame = 0;
      if (focusWithin || !isVisible || document.visibilityState !== "visible") return;
      const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.05);
      previousTimestamp = timestamp;
      const inputIsActive = timestamp - lastInputTimestamp <= INPUT_HOLD_MS;
      if (!inputIsActive) targetBoost *= Math.exp(-deltaSeconds / 0.42);
      const responseSeconds = inputIsActive ? 0.085 : 0.34;
      boost += (targetBoost - boost) * (1 - Math.exp(-deltaSeconds / responseSeconds));

      const drive = BASE_SPEED + boost;
      const velocities = [drive, -drive];
      positions = positions.map((position, index) => wrapTrackPosition(
        position + velocities[index] * deltaSeconds,
        setWidths[index],
      ));
      applyPositions();
      if (!inputIsActive && Math.abs(boost) < 2.5 && Math.abs(targetBoost) < 2.5) {
        section.dataset.scrollDirection = "idle";
      }
      animationFrame = window.requestAnimationFrame(tick);
    };
    const stopTicker = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };
    const startTicker = () => {
      if (animationFrame || focusWithin || isReduced || !isVisible || document.visibilityState !== "visible") return;
      previousTimestamp = performance.now();
      previousScrollTimestamp = previousTimestamp;
      previousScrollY = window.scrollY;
      animationFrame = window.requestAnimationFrame(tick);
    };
    const handleFocusIn = (event: FocusEvent) => {
      focusWithin = true;
      stopTicker();
      revealFocusedTool(event.target instanceof Element ? event.target : null);
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && section.contains(event.relatedTarget)) return;
      focusWithin = false;
      startTicker();
    };
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          measure();
          startTicker();
        } else {
          stopTicker();
          boost = 0;
          targetBoost = 0;
          section.dataset.scrollDirection = "idle";
        }
      },
      { rootMargin: "0px" },
    );
    const syncDocumentVisibility = () => {
      if (document.visibilityState === "visible") startTicker();
      else stopTicker();
    };
    const syncMotionPreference = () => {
      isReduced = motionPreference.matches;
      boost = 0;
      targetBoost = 0;
      lastInputTimestamp = Number.NEGATIVE_INFINITY;
      section.dataset.scrollDirection = "idle";
      if (isReduced) {
        stopTicker();
        rows.forEach((row) => {
          row.track.style.transform = "";
          if (row.mask) row.mask.scrollLeft = 0;
        });
        return;
      }
      hasMeasured = false;
      positions = [0, 0];
      measure();
      startTicker();
    };
    const resizeObserver = new ResizeObserver(measure);

    if (!isReduced) measure();
    visibilityObserver.observe(section);
    resizeObserver.observe(section);
    rows.forEach((row) => {
      resizeObserver.observe(row.track);
      if (row.mask) resizeObserver.observe(row.mask);
      if (row.set) resizeObserver.observe(row.set);
    });
    section.addEventListener("focusin", handleFocusIn);
    section.addEventListener("focusout", handleFocusOut);
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", syncDocumentVisibility);
    motionPreference.addEventListener("change", syncMotionPreference);

    return () => {
      stopTicker();
      section.removeEventListener("focusin", handleFocusIn);
      section.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", syncDocumentVisibility);
      motionPreference.removeEventListener("change", syncMotionPreference);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      rows.forEach((row) => { row.track.style.transform = ""; });
    };
  }, []);

  useEffect(() => {
    const section = startHereRef.current;
    if (!section) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerPreference = window.matchMedia("(hover: hover) and (pointer: fine)");
    let animationFrame = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const renderDepth = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      section.style.setProperty("--choice-x", currentX.toFixed(4));
      section.style.setProperty("--choice-y", currentY.toFixed(4));
      if (Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002) {
        animationFrame = window.requestAnimationFrame(renderDepth);
      } else {
        animationFrame = 0;
      }
    };
    const requestDepthFrame = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(renderDepth);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (motionPreference.matches || !pointerPreference.matches) return;
      const rect = section.getBoundingClientRect();
      targetX = gsap.utils.clamp(-1, 1, ((event.clientX - rect.left) / rect.width - 0.5) * 2);
      targetY = gsap.utils.clamp(-1, 1, ((event.clientY - rect.top) / rect.height - 0.5) * 2);
      requestDepthFrame();
    };
    const resetDepth = () => {
      targetX = 0;
      targetY = 0;
      requestDepthFrame();
    };
    const syncPreferences = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      currentX = currentY = targetX = targetY = 0;
      section.style.removeProperty("--choice-x");
      section.style.removeProperty("--choice-y");
    };

    section.addEventListener("pointermove", handlePointerMove);
    section.addEventListener("pointerleave", resetDepth);
    section.addEventListener("focusin", resetDepth);
    motionPreference.addEventListener("change", syncPreferences);
    pointerPreference.addEventListener("change", syncPreferences);
    return () => {
      syncPreferences();
      section.removeEventListener("pointermove", handlePointerMove);
      section.removeEventListener("pointerleave", resetDepth);
      section.removeEventListener("focusin", resetDepth);
      motionPreference.removeEventListener("change", syncPreferences);
      pointerPreference.removeEventListener("change", syncPreferences);
    };
  }, []);

  return (
    <div className={styles.normalFlow}>
        <section
          aria-labelledby="liquid-v7-booking-heading"
          className={styles.newsletterSection}
          id="book-a-lesson"
          tabIndex={-1}
        >
          <div lang="ru">
            <span>ВЫБОР ТАРИФА · ЗАЯВКА</span>
            <h2 id="liquid-v7-booking-heading">Частные уроки английского для школьников и студентов.</h2>
            <p>Для родителей школьников и для студентов, которые записываются самостоятельно. Сравните Basic, Standard и PRO, выберите пакет и отправьте заявку на согласование первого урока.</p>
          </div>
          <div className={styles.bookingPrompt} aria-label="Выбор тарифа и подготовка заявки" lang="ru">
            <span>ВЫБЕРИТЕ ТАРИФ</span>
            <div className={styles.bookingTierChoices} role="group" aria-label="Тарифы занятий">
              {tariffs.map((tariff) => (
                <button
                  aria-pressed={selectedPlan === tariff.name}
                  data-selected={selectedPlan === tariff.name ? "true" : "false"}
                  data-tier={tariff.id}
                  key={tariff.id}
                  onClick={() => setSelectedPlan(tariff.name)}
                  type="button"
                >
                  <b>{tariff.v7Name}</b>
                  <small lang="ru">{availabilityLabels[tariff.id]}</small>
                </button>
              ))}
            </div>
            <div aria-live="polite" className={styles.bookingSelectionSummary} lang="ru">
              <strong>{selectedPhoneCard.label} · {selectedTariff.duration}</strong>
              <span>{selectedTariff.fit}</span>
              <span>{tariffDecisionLine(selectedTariff.id)}</span>
              <span>{selectedTariff.reporting}</span>
              <span>{selectedTariff.support}</span>
              <small>{selectedPriceSummary}</small>
            </div>
            <aside className={styles.bookingPolicy} aria-label="Условия резервирования времени">
              <strong>Слот и переносы · {selectedTariff.v7Name}</strong>
              <p>{reservedSlotPolicy}</p>
              <p><b>{selectedTariff.transferPolicy}</b></p>
            </aside>
            <aside className={styles.bookingIntroCall} aria-label="Бесплатный вводный созвон до десяти минут">
              <strong>НУЖНО УТОЧНИТЬ ВЫБОР?</strong>
              <p>{introCallCopy}</p>
              <div>
                {[verifiedContacts[1], verifiedContacts[2]].map((contact) => (
                  <a aria-label={contact.accessibleName} href={contact.href} key={contact.href}>{contact.label}</a>
                ))}
              </div>
            </aside>
            <button
              aria-haspopup="dialog"
              className={`${styles.bookingCta} ${styles.bookLessonControl}`}
              data-v7-application-trigger
              id="v7-booking-application-trigger"
              lang="ru"
              onClick={(event) => onApply(selectedPlan, event.currentTarget)}
              type="button"
            >
              {applicationButtonLabel} · {selectedTariff.v7Name}
            </button>
            <small>Кнопка откроет форму. Номер подтверждения появится только после успешного сохранения заявки.</small>
            <V7ContactLinks compact />
          </div>
        </section>

        <section
          aria-labelledby="liquid-v7-story-heading"
          className={styles.flowStorySection}
          lang="ru"
          ref={flowStorySectionRef}
        >
          <div className={styles.flowStorySticky}>
            <header className={styles.flowStoryHeading}>
              <span>ОТ ЦЕЛИ К ПЕРВОМУ УРОКУ</span>
              <h2 id="liquid-v7-story-heading">Три шага до согласования урока.</h2>
            </header>
            <div className={styles.flowStoryScene}>
              <ol className={styles.flowStorySteps}>
                {flowStorySteps.map((step, index) => (
                  <li
                    aria-current={activeStoryIndex === index ? "step" : undefined}
                    data-active={activeStoryIndex === index ? "true" : "false"}
                    key={step.eyebrow}
                  >
                    <div className={styles.flowStoryStep}>
                      <span>{step.eyebrow}</span>
                      <strong>{step.title}</strong>
                      <div className={styles.flowStorySummary}><p>{step.summary}</p></div>
                    </div>
                  </li>
                ))}
              </ol>
              <div aria-hidden="true" className={styles.flowStoryVisual}>
                {flowStorySteps.map((step, index) => (
                  <figure
                    data-active={activeStoryIndex === index ? "true" : "false"}
                    data-kind={step.visualKind}
                    key={step.visualTitle}
                  >
                    <Image alt="" fill loading="lazy" sizes="(max-width: 899px) 92vw, 48vw" src={step.artwork} />
                    {step.visualKind === "materials" ? (
                      <div className={styles.flowStoryToolField}>
                        {materialTickerTools.map((tool) => (
                          <i data-tool={tool.id} key={tool.id}>
                            <span>{tool.order}</span>
                            <b>{tool.name}</b>
                          </i>
                        ))}
                      </div>
                    ) : null}
                    <figcaption>
                      <strong>{step.visualTitle}</strong>
                      <span>{step.visualMeta}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Preparation and materials tools"
          className={styles.materialTickerSection}
          lang="en"
          ref={tickerSectionRef}
        >
          <header>
            <span>PREPARATION · MATERIALS</span>
            <p>Six tools, moving through one lesson system.</p>
          </header>
          {[materialTickerTools, [...materialTickerTools].reverse()].map((tools, rowIndex) => (
            <div className={styles.materialTickerMask} data-material-tool-row={rowIndex} key={`ticker-row-${rowIndex}`}>
              <div
                className={styles.materialTickerTrack}
                data-direction={rowIndex === 0 ? "right" : "left"}
                ref={(node) => { tickerTrackRefs.current[rowIndex] = node; }}
              >
                {[0, 1].map((copyIndex) => {
                  const semanticCopy = rowIndex === 0 ? copyIndex === 1 : copyIndex === 0;
                  const renderedTools = rowIndex === 1 && semanticCopy
                    ? [...tools.slice(0, 3)].reverse().concat(tools.slice(3))
                    : tools;
                  return (
                    <div
                      className={styles.materialTickerSet}
                      data-copy={copyIndex}
                      data-semantic-copy={semanticCopy ? "true" : "false"}
                      key={`ticker-set-${rowIndex}-${copyIndex}`}
                    >
                      {renderedTools.map((tool, toolIndex) => {
                        const isSemanticControl = semanticCopy && toolIndex < 3;
                        const cardContents = (
                          <>
                            <i aria-hidden="true">{tool.order}</i>
                            <b>{tool.name}</b>
                            <small>PREPARATION · MATERIALS</small>
                          </>
                        );
                        return isSemanticControl ? (
                          <button
                            aria-controls={`v7-material-tool-${tool.id}`}
                            aria-expanded={activeMaterialToolId === tool.id}
                            aria-label={`Показать описание инструмента ${tool.name}`}
                            data-active={activeMaterialToolId === tool.id ? "true" : "false"}
                            data-material-tool-card
                            data-material-tool-control
                            data-tool={tool.id}
                            key={`material-tool-control-${tool.id}`}
                            onClick={(event) => selectMaterialTool(tool.id, event.currentTarget)}
                            type="button"
                          >
                            {cardContents}
                          </button>
                        ) : (
                          <span
                            aria-hidden="true"
                            data-active={activeMaterialToolId === tool.id ? "true" : "false"}
                            data-material-tool-card
                            data-material-tool-clone
                            data-material-tool-pointer-route="canonical"
                            data-tool={tool.id}
                            key={`material-tool-clone-${rowIndex}-${copyIndex}-${tool.id}`}
                          >
                            {cardContents}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {activeMaterialTool ? (
            <article
              aria-labelledby={`v7-material-tool-${activeMaterialTool.id}-title`}
              className={styles.materialToolDisclosure}
              id={`v7-material-tool-${activeMaterialTool.id}`}
              lang="ru"
            >
              <header>
                <span>{activeMaterialTool.order} · ИНСТРУМЕНТ ПОДГОТОВКИ</span>
                <button aria-label="Закрыть описание инструмента" onClick={() => closeMaterialTool()} type="button">
                  <span aria-hidden="true">×</span>
                </button>
              </header>
              <h3 id={`v7-material-tool-${activeMaterialTool.id}-title`}>{activeMaterialTool.name}</h3>
              <strong>{activeMaterialTool.title}</strong>
              <p>{activeMaterialTool.body}</p>
              <footer>
                <span>{activeMaterialTool.meta}</span>
                <b>{activeMaterialTool.cost}</b>
              </footer>
            </article>
          ) : null}
        </section>

        <section
          aria-labelledby="liquid-v7-start-heading"
          className={`${styles.startHereSection} ${lowerStyles.choiceSection}`}
          lang="ru"
          ref={startHereRef}
        >
          <PawTrail />
          <div className={lowerStyles.choiceHeading} data-paw-exclusion>
            <h2 id="liquid-v7-start-heading"><span>Начните с того,</span><span>что важно вам.</span></h2>
          </div>
          <nav aria-label="Навигация по выбору занятия" className={lowerStyles.choiceActions} data-paw-exclusion>
            <a
              href="#hero"
              onClickCapture={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigateToSequenceReference(0, "#hero");
              }}
            >
              <span>Выбрать темп</span><svg aria-hidden="true" viewBox="0 0 32 32"><path d="M6 16h20M17 7l9 9-9 9" /></svg>
            </a>
            <a
              href="#book-a-lesson"
              onClickCapture={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigateToBookingSection();
              }}
            >
              <span>Выбрать тариф</span><svg aria-hidden="true" viewBox="0 0 32 32"><path d="M6 16h20M17 7l9 9-9 9" /></svg>
            </a>
            <button
              aria-haspopup="dialog"
              data-v7-application-trigger
              id="v7-start-here-application-trigger"
              onClick={(event) => onApply(selectedPlan, event.currentTarget)}
              type="button"
            >
              <span>Открыть заявку<small>{selectedTariff.v7Name}</small></span><svg aria-hidden="true" viewBox="0 0 32 32"><path d="M6 16h20M17 7l9 9-9 9" /></svg>
            </button>
          </nav>
        </section>

        <section className={styles.faqSection} aria-labelledby={`${faqIdPrefix}-heading`}>
          <header>
            <span lang="en">LESSON QUESTIONS</span>
            <h2 id={`${faqIdPrefix}-heading`}>Частые вопросы</h2>
            <p>Коротко о форматах, длительности, подготовке, записи, оплате пакетов и переходе на новые тарифы.</p>
          </header>
          <div className={styles.faqList}>
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              const buttonId = `${faqIdPrefix}-button-${index}`;
              const panelId = `${faqIdPrefix}-panel-${index}`;
              return (
                <section data-open={isOpen ? "true" : "false"} key={item.question}>
                  <h3>
                    <button
                      aria-controls={panelId}
                      aria-expanded={isOpen}
                      id={buttonId}
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      type="button"
                    >
                      <span>{item.question}</span>
                      <i aria-hidden="true">{isOpen ? "−" : "+"}</i>
                    </button>
                  </h3>
                  <div
                    aria-hidden={!isOpen}
                    aria-labelledby={buttonId}
                    className={styles.faqAnswer}
                    id={panelId}
                    role="region"
                  >
                    <div><p>{item.answer}</p></div>
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <footer className={styles.footer} lang="ru">
          <FooterBrandMaterial mediaRuntime={mediaRuntime} />
          <div>
            <span>АНГЛИЙСКИЙ В ДВИЖЕНИИ</span>
            <a href="#hero">К НАЧАЛУ</a>
          </div>
          <V7ContactLinks />
          <p lang="en">Choose your pace. Find your voice.</p>
          <section className={styles.footerTeacher} aria-label="О преподавателе">
            <span>ПРЕПОДАВАТЕЛЬ</span>
            <strong>Evgenii Poletaev</strong>
            <p>Преподаю английский с 2016 года — 10 лет опыта.</p>
            <small>Степень магистра лингвистики по программе «Перевод и переводоведение». Работаю в американской компании; дважды получил повышение и сейчас занимаю позицию Product Specialist.</small>
          </section>
        </footer>
    </div>
  );
}

export function LiquidReferenceHeroV7() {
  const [mediaRuntime] = useState(() => createV7MediaRuntime());
  const [applicationPlan, setApplicationPlan] = useState<TariffName | null>(null);
  const [applicationLaunch, setApplicationLaunch] = useState<V7ApplicationLaunch | null>(null);
  const [bookingTransitionPhase, setBookingTransitionPhase] = useState<"idle" | "cover" | "reveal">("idle");
  const [availabilityLabels, setAvailabilityLabels] = useState<AvailabilityLabels>(initialAvailabilityLabels);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(applicationApiUrl("/api/availability"), {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as {
        ok: boolean;
        availability?: {
          tariffs: Record<TariffId, {
            status: "fresh" | "confirmation-required";
            remaining?: number;
            label: string;
          }>;
        };
      };
      if (!response.ok || !body.ok || !body.availability) throw new Error("availability-unavailable");
      setAvailabilityLabels(Object.freeze(Object.fromEntries(
        (["basic", "standard", "premium"] as const).map((tariffId) => {
          const value = body.availability!.tariffs[tariffId];
          return [tariffId, value.status === "fresh"
            ? `СЕЙЧАС ДОСТУПНО: ${value.remaining}`
            : "Нет свежих данных"];
        }),
      )) as AvailabilityLabels);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAvailabilityLabels(Object.freeze({
        basic: "Нет свежих данных",
        standard: "Нет свежих данных",
        premium: "Нет свежих данных",
      }));
    });
    return () => controller.abort();
  }, []);

  // StrictMode replays effects with the same runtime. Dispose only after a real
  // unmount, once a replay has had the chance to reconnect its media surfaces.
  const mediaLifecycleRef = useRef(0);
  useEffect(() => {
    mediaLifecycleRef.current += 1;
    return () => {
      const generation = ++mediaLifecycleRef.current;
      queueMicrotask(() => {
        if (mediaLifecycleRef.current === generation) mediaRuntime.dispose();
      });
    };
  }, [mediaRuntime]);
  const lenisRef = useRef<Lenis | null>(null);
  const smoothScrollLockCountRef = useRef(0);
  const applicationLaunchTimersRef = useRef<number[]>([]);
  const applicationLaunchElementRef = useRef<HTMLElement | null>(null);
  const applicationReturnFocusRef = useRef<HTMLElement | null>(null);
  const applicationReturnFocusIdRef = useRef("");

  const clearApplicationLaunch = useCallback(() => {
    applicationLaunchTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    applicationLaunchTimersRef.current = [];
    applicationLaunchElementRef.current?.removeAttribute("data-application-launching");
    applicationLaunchElementRef.current = null;
    setApplicationLaunch(null);
  }, []);

  const openApplication = useCallback<V7ApplicationHandler>((planName, suppliedOrigin) => {
    clearApplicationLaunch();
    applicationReturnFocusRef.current = suppliedOrigin instanceof HTMLElement
      ? suppliedOrigin
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    applicationReturnFocusIdRef.current = applicationReturnFocusRef.current?.id ?? "";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setApplicationPlan(planName);
      return;
    }

    const tariff = tariffs.find((item) => item.name === planName) ?? tariffs[1];
    const tier: V7ApplicationTier = tariff.id === "premium" ? "pro" : tariff.id;
    const tierChoice = document.querySelector<HTMLElement>(
      `#book-a-lesson .${styles.bookingTierChoices} [data-tier="${tariff.id}"]`,
    );
    const tierChoiceRect = tierChoice?.getBoundingClientRect();
    const tierChoiceIsVisible = Boolean(
      tierChoiceRect
      && tierChoiceRect.bottom > 0
      && tierChoiceRect.top < window.innerHeight
      && tierChoiceRect.right > 0
      && tierChoiceRect.left < window.innerWidth,
    );
    const originElement = tierChoiceIsVisible
      ? tierChoice ?? null
      : suppliedOrigin instanceof HTMLElement
        ? suppliedOrigin
        : null;
    const rawOrigin = originElement
      ? serializeRect(originElement.getBoundingClientRect())
      : suppliedOrigin && !(suppliedOrigin instanceof HTMLElement)
        ? suppliedOrigin
        : { x: window.innerWidth / 2 - 80, y: window.innerHeight / 2 - 44, width: 160, height: 88 };
    const width = Math.min(280, Math.max(96, rawOrigin.width));
    const height = Math.min(124, Math.max(56, rawOrigin.height));
    const origin = {
      x: Math.max(12, Math.min(window.innerWidth - width - 12, rawOrigin.x + (rawOrigin.width - width) / 2)),
      y: Math.max(12, Math.min(window.innerHeight - height - 12, rawOrigin.y + (rawOrigin.height - height) / 2)),
      width,
      height,
    };

    if (originElement) {
      originElement.setAttribute("data-application-launching", "true");
      applicationLaunchElementRef.current = originElement;
    }
    setApplicationLaunch({ tier, origin });
    applicationLaunchTimersRef.current.push(window.setTimeout(() => {
      setApplicationPlan(planName);
    }, 140));
    applicationLaunchTimersRef.current.push(window.setTimeout(() => {
      clearApplicationLaunch();
    }, 520));
  }, [clearApplicationLaunch]);

  useEffect(() => () => clearApplicationLaunch(), [clearApplicationLaunch]);

  const closeApplication = useCallback(() => {
    setApplicationPlan(null);
    window.setTimeout(() => {
      const visibleTrigger = Array.from(
        document.querySelectorAll<HTMLElement>("[data-v7-application-trigger]"),
      ).find((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.bottom > 0
          && rect.top < window.innerHeight
          && rect.right > 0
          && rect.left < window.innerWidth
          && style.visibility !== "hidden"
          && Number.parseFloat(style.opacity) > 0;
      });
      const focusTarget = (applicationReturnFocusIdRef.current
          ? document.getElementById(applicationReturnFocusIdRef.current)
          : null)
        ?? (applicationReturnFocusRef.current?.isConnected ? applicationReturnFocusRef.current : null)
        ?? visibleTrigger;
      focusTarget?.focus({ preventScroll: true });
    }, 220);
  }, []);

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "auto";
    if (!window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}#hero`,
      );
    }

    // Static Pages can restore before React has mounted the tall scroll scene.
    // Restore reloads after that scene exists, before its reveal timeline settles.
    const reloadScrollKey = "liquid-v7-reload-scroll";
    const restorationInputEvents = ["pointerdown", "touchstart", "wheel", "keydown"];
    let restoringReload = false;
    const resumeNativeRestoration = () => {
      if (!restoringReload) return;
      restoringReload = false;
      ScrollTrigger.clearScrollMemory("auto");
      restorationInputEvents.forEach(event => window.removeEventListener(event, resumeNativeRestoration));
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem(reloadScrollKey) ?? "null") as {
        href?: string; y?: number;
      } | null;
      sessionStorage.removeItem(reloadScrollKey);
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      // WebKit may expose Navigation Timing entries only after the load event.
      const isReload = navigation?.type === "reload"
        || (!navigation && performance.navigation?.type === 1);
      if (isReload && saved?.href === window.location.href
        && typeof saved.y === "number" && Number.isFinite(saved.y) && saved.y > 0) {
        // WebKit otherwise applies the empty shell's saved position after load,
        // overwriting this seek. Keep ScrollTrigger's restoration policy in sync
        // through its asynchronous initial history traversal. User input or
        // leaving the page returns ownership to native history without a timer.
        restoringReload = true;
        ScrollTrigger.clearScrollMemory("manual");
        window.scrollTo({ top: saved.y, behavior: "instant" });
        ScrollTrigger.update();
        restorationInputEvents.forEach(event => window.addEventListener(event, resumeNativeRestoration, { passive: true }));
      }
    } catch { /* Native restoration remains available when storage is blocked. */ }
    const rememberReloadScroll = () => {
      resumeNativeRestoration();
      try {
        sessionStorage.setItem(reloadScrollKey, JSON.stringify({ href: window.location.href, y: window.scrollY }));
      } catch { /* Storage is optional. */ }
    };
    window.addEventListener("pagehide", rememberReloadScroll);

    return () => {
      window.removeEventListener("pagehide", rememberReloadScroll);
      restorationInputEvents.forEach(event => window.removeEventListener(event, resumeNativeRestoration));
      ScrollTrigger.clearScrollMemory(previousScrollRestoration);
    };
  }, []);

  const setSmoothScrollLocked = useCallback((locked: boolean) => {
    smoothScrollLockCountRef.current = locked
      ? smoothScrollLockCountRef.current + 1
      : Math.max(0, smoothScrollLockCountRef.current - 1);
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (smoothScrollLockCountRef.current > 0) {
      lenis.stop();
      return;
    }
    lenis.resize();
    lenis.start();
    ScrollTrigger.refresh();
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const documentElement = document.documentElement;
    const documentBody = document.body;
    const previousScrollBehavior = documentElement.style.scrollBehavior;
    const previousHtmlOverscroll = documentElement.style.overscrollBehavior;
    const previousBodyOverscroll = documentBody.style.overscrollBehavior;
    let refreshFrame = 0;
    let tickLenis: ((timeSeconds: number) => void) | null = null;
    let bookingNavigationTimers: number[] = [];

    const handleSequenceNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{
        referenceTime?: number; immediate?: boolean; afterSequence?: number;
      }>).detail;
      const requestedReferenceTime = detail?.referenceTime;
      if (!Number.isFinite(requestedReferenceTime)) return;
      const sequence = document.querySelector<HTMLElement>(
        '[data-testid="liquid-reference-v7-sequence"]',
      );
      if (!sequence) return;
      const referenceTime = gsap.utils.clamp(
        0,
        REFERENCE_PINNED_END,
        requestedReferenceTime ?? 0,
      );
      const targetScroll = sequence.offsetTop
        + scrollProgressAtReferenceTime(referenceTime)
          * Math.max(0, sequence.offsetHeight - window.innerHeight)
        + (detail?.afterSequence ?? 0);
      const lenis = lenisRef.current;
      if (!motionPreference.matches && lenis) {
        if (detail?.immediate) lenis.resize();
        lenis.scrollTo(targetScroll, { duration: 1.05, force: true, immediate: detail?.immediate });
        return;
      }
      window.scrollTo({ top: targetScroll, behavior: "auto" });
    };

    const interruptWheelForKeyboard = (event: KeyboardEvent) => {
      const lenis = lenisRef.current;
      if (event.defaultPrevented || smoothScrollLockCountRef.current > 0
        || lenis?.isScrolling !== "smooth" || lenis.isStopped
        || !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable], [role='slider'], [role='listbox'], [role='combobox']")
        || (event.key === " " && target?.closest("button, [role='button']"))) return;
      // Hand control to the browser's native key action at the actual position.
      // stop/start resets the pending wheel target without consuming that action.
      lenis.stop();
      lenis.start();
    };

    const clearBookingNavigationTimers = () => {
      bookingNavigationTimers.forEach((timer) => window.clearTimeout(timer));
      bookingNavigationTimers = [];
    };
    const revealBookingSection = () => {
      const target = document.getElementById("book-a-lesson");
      if (!target) return;
      ScrollTrigger.refresh();
      const scrollTarget = window.innerWidth <= 899
        ? target.querySelector<HTMLElement>(`.${styles.bookingPrompt}`) ?? target
        : target;
      const lenis = lenisRef.current;
      if (lenis) {
        lenis.scrollTo(scrollTarget, { force: true, immediate: true });
      } else {
        window.scrollTo({
          top: scrollTarget.getBoundingClientRect().top + window.scrollY,
          behavior: "auto",
        });
      }
      target.dataset.bookingArrival = "true";
      target.focus({ preventScroll: true });
      ScrollTrigger.update();
    };
    const handleBookingNavigation = () => {
      clearBookingNavigationTimers();
      if (motionPreference.matches) {
        setBookingTransitionPhase("idle");
        revealBookingSection();
        return;
      }
      setBookingTransitionPhase("cover");
      bookingNavigationTimers.push(window.setTimeout(() => {
        revealBookingSection();
        setBookingTransitionPhase("reveal");
      }, 300));
      bookingNavigationTimers.push(window.setTimeout(() => {
        document.getElementById("book-a-lesson")?.removeAttribute("data-booking-arrival");
        setBookingTransitionPhase("idle");
      }, 880));
    };

    const stopSmoothScroll = () => {
      const lenis = lenisRef.current;
      if (!lenis) return;
      lenis.off("scroll", ScrollTrigger.update);
      if (tickLenis) gsap.ticker.remove(tickLenis);
      lenis.destroy();
      lenisRef.current = null;
      tickLenis = null;
    };
    const syncSmoothScroll = () => {
      stopSmoothScroll();
      documentElement.style.scrollBehavior = "auto";
      documentElement.style.overscrollBehavior = "none";
      documentBody.style.overscrollBehavior = "none";
      if (motionPreference.matches || shouldUseIOSPerformanceMode()) return;
      const lenis = new Lenis({
        anchors: { duration: METAMASK_SCROLL_DURATION_SECONDS },
        autoRaf: false,
        lerp: 0.2,
        smoothWheel: true,
        syncTouch: false,
        touchMultiplier: 1,
        wheelMultiplier: 1,
        overscroll: true,
      });
      lenisRef.current = lenis;
      if (smoothScrollLockCountRef.current > 0) lenis.stop();
      tickLenis = (timeSeconds: number) => lenisRef.current?.raf(timeSeconds * 1000);
      gsap.ticker.add(tickLenis);
      lenis.on("scroll", ScrollTrigger.update);
      refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh());
    };

    syncSmoothScroll();
    window.addEventListener("keydown", interruptWheelForKeyboard);
    window.addEventListener(V7_SEQUENCE_NAVIGATION_EVENT, handleSequenceNavigation);
    window.addEventListener(V7_BOOKING_NAVIGATION_EVENT, handleBookingNavigation);
    motionPreference.addEventListener("change", syncSmoothScroll);
    return () => {
      clearBookingNavigationTimers();
      window.cancelAnimationFrame(refreshFrame);
      window.removeEventListener("keydown", interruptWheelForKeyboard);
      window.removeEventListener(V7_SEQUENCE_NAVIGATION_EVENT, handleSequenceNavigation);
      window.removeEventListener(V7_BOOKING_NAVIGATION_EVENT, handleBookingNavigation);
      motionPreference.removeEventListener("change", syncSmoothScroll);
      stopSmoothScroll();
      documentElement.style.scrollBehavior = previousScrollBehavior;
      documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      documentBody.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  return (
    <V7SmoothScrollLockContext.Provider value={setSmoothScrollLocked}>
      <main
        className={styles.page}
        data-liquid-v7-main
        style={{
          minHeight: "100dvh",
          overflowX: "clip",
          color: "#043d3a",
          background: "#ddffb8",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <AstraExperience />
        <LiquidReferenceHeroV7Sequence availabilityLabels={availabilityLabels} mediaRuntime={mediaRuntime} onApply={openApplication} />
        <LiquidReferenceHeroV7NormalFlow availabilityLabels={availabilityLabels} mediaRuntime={mediaRuntime} onApply={openApplication} />
        <div
          aria-hidden="true"
          className={styles.bookingTransition}
          data-phase={bookingTransitionPhase}
        >
          <span className={styles.bookingTransitionSource} />
          <span className={styles.bookingTransitionSeam} />
          <span className={styles.bookingTransitionDestination} />
          <strong>ТРИ ТАРИФА · ОДИН ВЫБОР</strong>
        </div>
        {applicationPlan ? (
          <V7ApplicationDialog
            availabilityLabels={availabilityLabels}
            key={applicationPlan}
            mediaRuntime={mediaRuntime}
            onClose={closeApplication}
            planName={applicationPlan}
          />
        ) : null}
        {applicationLaunch && typeof document !== "undefined" ? createPortal((
          <div
            aria-hidden="true"
            className={styles.applicationLaunchTransfer}
            data-application-pattern-transfer={applicationLaunch.tier}
            data-tier={applicationLaunch.tier}
            style={{
              "--launch-x": `${applicationLaunch.origin.x}px`,
              "--launch-y": `${applicationLaunch.origin.y}px`,
              "--launch-width": `${applicationLaunch.origin.width}px`,
              "--launch-height": `${applicationLaunch.origin.height}px`,
            } as CSSProperties}
          >
            <span />
            <i />
          </div>
        ), document.body) : null}
      </main>
    </V7SmoothScrollLockContext.Provider>
  );
}
