"use client";

import { useEffect } from "react";
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
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const writePointer = () => {
      page.style.setProperty("--scene-x", String(current.x));
      page.style.setProperty("--scene-y", String(current.y));
      window.dispatchEvent(new CustomEvent("astra:depth-pointer", { detail: { x: current.x, y: current.y } }));
      page.style.setProperty("--light-x", `${50 + current.x * 45}%`);
      page.style.setProperty("--light-y", `${50 + current.y * 45}%`);
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
      sequence.dataset.astraOpening = time < 0.9 ? "true" : "false";
      page.style.setProperty("--opening-depth-opacity", String(Math.max(0, Math.min(1, (10.7 - time) / 1.5))));
      page.style.setProperty("--opening-travel", String(Math.max(0, Math.min(1, time / 10.7))));
      const travel = time >= 19.85 && time < 23 ? (time - 21.5) * 0.55
        : time >= 25.34 && time < 27.75 ? (time - 26.45) * 0.75 : 0;
      page.style.setProperty("--scene-travel", String(Math.max(-1, Math.min(1, travel))));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onPointer = (event: PointerEvent) => {
      if (motion.matches || !finePointer.matches || !sceneVisible || document.hidden || event.pointerType === "touch") return;
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      target.x = clamp(event.clientX / window.innerWidth * 2 - 1);
      target.y = clamp(event.clientY / window.innerHeight * 2 - 1);
      if (!pointerFrame) pointerFrame = requestAnimationFrame(animatePointer);
    };
    const onPointerOut = (event: PointerEvent) => { if (!event.relatedTarget) resetPointer(); };
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
      motion.removeEventListener("change", resetPointer);
      finePointer.removeEventListener("change", resetPointer);
      document.removeEventListener("visibilitychange", resetPointer);
      document.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", resetPointer);
      for (const property of ["--scene-x", "--scene-y", "--scene-travel", "--opening-depth-opacity", "--opening-travel", "--light-x", "--light-y"]) page.style.removeProperty(property);
    };
  }, []);

  return null;
}
