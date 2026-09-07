"use client";

import { useEffect, useRef } from "react";

type Paw = { x: number; y: number; angle: number; born: number; side: number };

/** A short alternating walking trail, confined to the approved closing section. */
export function PawTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest("section");
    const context = canvas?.getContext("2d");
    if (!canvas || !section || !context) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)");
    const paws: Paw[] = [];
    let frame = 0;
    let side = 1;
    let previous: { x: number; y: number } | null = null;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(section.clientWidth * dpr);
      canvas.height = Math.round(section.clientHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      paws.length = 0;
      previous = null;
    };
    const drawPaw = (paw: Paw, age: number) => {
      const landing = Math.min(1, age / 110);
      const fading = Math.max(0, 1 - Math.max(0, age - 340) / 780);
      context.save();
      context.translate(paw.x, paw.y - (1 - landing) * 7);
      context.rotate(paw.angle);
      context.scale(.84 + landing * .16, .84 + landing * .16);
      context.globalAlpha = .65 * Math.min(1, age / 50) * fading * fading;
      context.shadowColor = "rgba(65, 94, 68, .24)";
      context.shadowBlur = 4;
      context.shadowOffsetY = 2;
      context.fillStyle = "#f0f2bd";
      context.strokeStyle = "rgba(77, 116, 83, .23)";
      context.lineWidth = .7;
      context.beginPath();
      context.moveTo(0, -2);
      context.bezierCurveTo(-4, -7, -10, 0, -10, 5);
      context.bezierCurveTo(-10, 11, -4, 8, 0, 9);
      context.bezierCurveTo(4, 8, 10, 11, 10, 5);
      context.bezierCurveTo(10, 0, 4, -7, 0, -2);
      context.fill(); context.stroke();
      for (const [x, y, rx, ry, angle] of [[-10, -6, 3.4, 4.5, -.55], [-4, -12, 3.6, 4.8, -.16], [4, -12, 3.6, 4.8, .16], [10, -6, 3.4, 4.5, .55]]) {
        context.beginPath(); context.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); context.fill(); context.stroke();
      }
      context.restore();
    };
    const draw = (now: number) => {
      frame = 0;
      context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      while (paws.length && now - paws[0].born > 1120) paws.shift();
      // Recompute the protected areas as the heading and links move with depth.
      // Clip every stamp, including its shadow and previously placed paw prints.
      context.save();
      const sectionRect = section.getBoundingClientRect();
      for (const element of section.querySelectorAll<HTMLElement>("[data-paw-exclusion]")) {
        const rect = element.getBoundingClientRect();
        const padding = 12;
        context.beginPath();
        context.rect(0, 0, canvas.width / dpr, canvas.height / dpr);
        context.rect(rect.left - sectionRect.left - padding, rect.top - sectionRect.top - padding,
          rect.width + padding * 2, rect.height + padding * 2);
        // Intersect successive clips so overlapping protected areas stay clear.
        context.clip("evenodd");
      }
      paws.forEach((paw) => drawPaw(paw, now - paw.born));
      context.restore();
      canvas.dataset.visiblePaws = String(paws.length);
      if (paws.length) frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      if (preference.matches || event.pointerType === "touch") return;
      const rect = section.getBoundingClientRect();
      const next = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (!previous) { previous = next; return; }
      const dx = next.x - previous.x; const dy = next.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 32) return;
      const angle = Math.atan2(dy, dx);
      // Interpolate large pointer jumps, but cap work for a single event.
      const count = Math.min(5, Math.floor(distance / 32));
      for (let i = 1; i <= count; i += 1) {
        const travel = i * 32;
        side *= -1;
        paws.push({ x: previous.x + dx / distance * travel - Math.sin(angle) * side * 10, y: previous.y + dy / distance * travel + Math.cos(angle) * side * 10, angle: angle + Math.PI / 2, born: performance.now(), side });
      }
      previous = next;
      if (paws.length > 24) paws.splice(0, paws.length - 24);
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const leave = () => { previous = null; };
    const clear = () => { cancelAnimationFrame(frame); frame = 0; resize(); canvas.dataset.visiblePaws = "0"; };
    const observer = new ResizeObserver(resize);
    observer.observe(section);
    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", leave);
    preference.addEventListener("change", clear);
    window.addEventListener("blur", clear);
    resize();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      section.removeEventListener("pointermove", move); section.removeEventListener("pointerleave", leave);
      preference.removeEventListener("change", clear); window.removeEventListener("blur", clear);
    };
  }, []);
  return <canvas ref={canvasRef} data-paw-trail aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }} />;
}
