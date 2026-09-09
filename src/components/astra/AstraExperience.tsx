"use client";

import { useEffect } from "react";
import styles from "@/styles/liquid-reference-v7.module.css";
import { referenceTimeAtScrollProgress } from "@/lib/v7-sequence-contract";
/** Pointer wrappers own depth; GSAP retains exclusive ownership of scroll transforms. */
export function AstraExperience() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>("[data-liquid-v7-main]");
    const sequence = document.querySelector<HTMLElement>('[data-testid="liquid-reference-v7-sequence"]');
    if (!page || !sequence) return;
    let frame = 0;
    let pointerFrame = 0;
    let lastFrame = 0;
    const target = { x: 0, y: 0 };
    const current = { ...target };
    let sceneVisible = true;
    let openingVisible = true;
    const depthSurfaces = Array.from(page.querySelectorAll<HTMLElement>([
      styles.baseBackground, styles.openingHeadlineSystem, styles.phoneDepthRig,
      styles.cardDepthRig, styles.utilityDepthRig, styles.proofDepthRig, styles.blueField,
    ].map(name => `.${name}`).join(",") + ",[data-depth-kind]"));
    const lightSurfaces = Array.from(page.querySelectorAll<HTMLElement>(`.${styles.openingField}, .${styles.proofWall} button`));
    const setProperty = (element: HTMLElement, name: string, value: string) => {
      if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const writePointer = () => {
      // Scope changing custom properties to their consumers. Inheriting them
      // from <main> invalidated every scene, SVG and booking field on each tick.
      for (const surface of depthSurfaces) {
        setProperty(surface, "--scene-x", current.x.toFixed(4));
        setProperty(surface, "--scene-y", current.y.toFixed(4));
      }
      window.dispatchEvent(new CustomEvent("astra:depth-pointer", {
        detail: { x: current.x, y: current.y, active: openingVisible && sceneVisible },
      }));
      for (const surface of lightSurfaces) {
        setProperty(surface, "--light-x", `${(50 + current.x * 45).toFixed(2)}%`);
        setProperty(surface, "--light-y", `${(50 + current.y * 45).toFixed(2)}%`);
      }
    };
    const animatePointer = (now: number) => {
      pointerFrame = 0;
      const delta = lastFrame ? Math.min(50, now - lastFrame) : 16;
      lastFrame = now;
      const blend = 1 - Math.exp(-delta / 120);
      let unsettled = false;
      for (const key of ["x", "y"] as const) {
        current[key] += (target[key] - current[key]) * blend;
        if (Math.abs(target[key] - current[key]) < 0.0005) current[key] = target[key];
        else unsettled = true;
      }
      writePointer();
      if (unsettled) pointerFrame = requestAnimationFrame(animatePointer);
      else lastFrame = 0;
    };
    const resetPointer = () => {
      Object.assign(target, { x: 0, y: 0 });
      if (motion.matches || !finePointer.matches || document.hidden || !sceneVisible) {
        cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
        lastFrame = 0;
        Object.assign(current, target);
        writePointer();
      } else if (!pointerFrame) pointerFrame = requestAnimationFrame(animatePointer);
    };
    const update = () => {
      frame = 0;
      const distance = Math.max(1, sequence.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, (window.scrollY - sequence.offsetTop) / distance));
      const time = referenceTimeAtScrollProgress(progress);
      const inBooking = window.scrollY >= sequence.offsetTop + distance;
      sceneVisible = !inBooking && window.scrollY + window.innerHeight > sequence.offsetTop;
      if (!sceneVisible) resetPointer();
      const nextOpeningVisible = time < 10.7 && sceneVisible;
      if (openingVisible !== nextOpeningVisible) { openingVisible = nextOpeningVisible; writePointer(); }
      const openingState = time < 0.9 ? "true" : "false";
      if (sequence.dataset.astraOpening !== openingState) sequence.dataset.astraOpening = openingState;
      const travel = time >= 19.85 && time < 23 ? (time - 21.5) * 0.55
        : time >= 25.34 && time < 27.75 ? (time - 26.45) * 0.75 : 0;
      // Only desktop side cards consume this scroll offset. Updating it on
      // <main> during touch scrolling restyled the entire page for no visual gain.
      for (const card of page.querySelectorAll<HTMLElement>(`.${styles.cardDepthRig}`)) {
        setProperty(card, "--scene-travel", finePointer.matches ? String(Math.max(-1, Math.min(1, travel))) : "0");
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onPointer = (event: PointerEvent) => {
      if (motion.matches || !finePointer.matches || !sceneVisible || document.hidden || event.pointerType === "touch") return;
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      target.x = clamp(event.clientX / window.innerWidth * 2 - 1);
      target.y = clamp(event.clientY / window.innerHeight * 2 - 1);
      if (!pointerFrame) pointerFrame = requestAnimationFrame(animatePointer);
    };
    const onTilt = (event: Event) => {
      const input = (event as CustomEvent<{ x: number; y: number; active: boolean }>).detail;
      const active = input?.active && !motion.matches && !finePointer.matches && sceneVisible && !document.hidden;
      const tiltState = String(Boolean(active));
      if (page.dataset.deviceTilt !== tiltState) page.dataset.deviceTilt = tiltState;
      if (!active) { resetPointer(); return; }
      target.x = input.x; target.y = input.y;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(animatePointer);
    };
    window.addEventListener("astra:device-tilt", onTilt);
    const onPointerOut = (event: PointerEvent) => {
      // Touch generates pointerout at the end of each gesture; it is not the
      // mouse leaving the page and must not reset the current device tilt.
      if (event.pointerType !== "touch" && !event.relatedTarget) resetPointer();
    };
    motion.addEventListener("change", resetPointer);
    finePointer.addEventListener("change", resetPointer);
    document.addEventListener("visibilitychange", resetPointer);
    document.addEventListener("pointerout", onPointerOut);
    window.addEventListener("blur", resetPointer);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("pageshow", schedule);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pointerFrame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("astra:device-tilt", onTilt);
      delete page.dataset.deviceTilt;
      motion.removeEventListener("change", resetPointer);
      finePointer.removeEventListener("change", resetPointer);
      document.removeEventListener("visibilitychange", resetPointer);
      document.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", resetPointer);
      for (const surface of [...depthSurfaces, ...lightSurfaces]) {
        for (const property of ["--scene-x", "--scene-y", "--scene-travel", "--light-x", "--light-y"]) surface.style.removeProperty(property);
      }
    };
  }, []);

  return null;
}
