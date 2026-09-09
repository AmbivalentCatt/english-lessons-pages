"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./device-tilt.module.css";

type OrientationAPI = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** Optional sensor input; the existing scene and mascot controllers own motion. */
export function DeviceTiltControl() {
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<"off" | "pending" | "on" | "denied">("off");
  const request = useRef(0);

  useEffect(() => {
    const invalidateRequest = () => { request.current++; };
    const touch = matchMedia("(pointer: coarse)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const supported = isSecureContext && "DeviceOrientationEvent" in window && touch.matches && !reduced.matches;
      setAvailable(supported);
      if (!supported) { invalidateRequest(); setState("off"); }
    };
    sync();
    touch.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    return () => {
      invalidateRequest();
      touch.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (state !== "on" || !available) return;
    let origin: { beta: number; gamma: number } | null = null;
    const emit = (x: number, y: number, active: boolean) => {
      window.dispatchEvent(new CustomEvent("astra:device-tilt", { detail: { x, y, active } }));
    };
    const reset = () => { origin = null; emit(0, 0, false); };
    const orient = (event: DeviceOrientationEvent) => {
      if (document.hidden || typeof event.beta !== "number" || typeof event.gamma !== "number"
        || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      origin ??= { beta: event.beta, gamma: event.gamma };
      const delta = (value: number, initial: number) => ((value - initial + 540) % 360) - 180;
      const dx = delta(event.gamma, origin.gamma), dy = delta(event.beta, origin.beta);
      const angle = (screen.orientation?.angle ?? Number((window as Window & { orientation?: number }).orientation ?? 0)) * Math.PI / 180;
      const limit = (value: number) => Math.max(-0.65, Math.min(0.65, value / 28));
      emit(limit(dx * Math.cos(angle) + dy * Math.sin(angle)), limit(dy * Math.cos(angle) - dx * Math.sin(angle)), true);
    };
    window.addEventListener("deviceorientation", orient, { passive: true });
    window.addEventListener("orientationchange", reset);
    screen.orientation?.addEventListener("change", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("deviceorientation", orient);
      window.removeEventListener("orientationchange", reset);
      screen.orientation?.removeEventListener("change", reset);
      document.removeEventListener("visibilitychange", reset);
      reset();
    };
  }, [state, available]);

  const toggle = async () => {
    if (state === "on") { setState("off"); return; }
    const generation = ++request.current;
    setState("pending");
    try {
      const api = window.DeviceOrientationEvent as OrientationAPI;
      // Safari requires this call directly inside the visitor's button gesture.
      const permission = api.requestPermission ? await api.requestPermission() : "granted";
      if (generation === request.current) setState(permission === "granted" ? "on" : "denied");
    } catch {
      if (generation === request.current) setState("denied");
    }
  };

  if (!available) return null;
  return <button type="button" className={styles.control} onClick={toggle}
    aria-label="Наклон устройства" aria-pressed={state === "on"} disabled={state === "pending"}
    title={state === "denied" ? "Доступ к движению не разрешён. Можно повторить запрос." : "Наклоняйте телефон: Liquid, фон и карточки мягко следуют за движением."}
    data-device-tilt-control={state} lang="ru">
    {state === "on" ? "Наклон включён" : state === "pending" ? "Разрешить наклон…" : state === "denied" ? "Наклон недоступен" : "Включить наклон"}
  </button>;
}
