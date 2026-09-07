"use client";

import { useEffect, useRef } from "react";
import Image from "@/components/StaticImage";
import styles from "./opening-depth.module.css";

export function LessonDepthObject({ kind }: { kind: "duration" | "materials" }) {
  return (
    <div className={styles.cardObject} data-depth-kind={kind} aria-hidden="true">
      <Image alt="" src={kind === "duration" ? "/media/astra-depth/lesson-timer.png" : "/media/astra-depth/lesson-notebook.png"} width={1254} height={1254} loading="eager" />
    </div>
  );
}

/** One registered source image: depth never exposes a cutout or a different plate. */
export function OpeningDepthLayers() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return; // The identical CSS artwork remains underneath.
    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Opening depth shader unavailable");
      return shader;
    };
    const program = gl.createProgram()!;
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    let disposed = false;
    let ready = false;
    let pointer = [0, 0];
    let fit = [1, 1];
    try {
      gl.attachShader(program, compile(gl.VERTEX_SHADER, `
        attribute vec2 a_position; varying vec2 v_uv;
        void main() { v_uv = a_position * vec2(.5,-.5) + .5; gl_Position = vec4(a_position,0.,1.); }
      `));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `
        precision highp float;
        uniform sampler2D u_art; uniform vec2 u_pointer; uniform vec2 u_fit;
        varying vec2 v_uv;
        float island(vec2 uv, vec2 center, vec2 radius) {
          return 1. - smoothstep(.60, 1.18, length((uv-center)/radius));
        }
        void main() {
          vec2 uv = (v_uv-.5)*u_fit+.5;
          float hat = island(uv,vec2(.065,.12),vec2(.20,.29));
          float nearLily = island(uv,vec2(.81,.935),vec2(.16,.17));
          float farLily = island(uv,vec2(.98,.82),vec2(.15,.16));
          // A continuous depth field keeps every original contour and avoids
          // seams, duplicate silhouettes and regenerated colour differences.
          float depth = -3. + max(hat*8.,max(nearLily*12.,farLily*8.));
          vec2 edge = smoothstep(vec2(0.),vec2(.028),uv) * smoothstep(vec2(0.),vec2(.028),1.-uv);
          uv -= u_pointer * vec2(1./1672.,1./941.) * depth * edge.x * edge.y;
          gl_FragColor = texture2D(u_art,uv);
        }
      `));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Opening depth unavailable");
    } catch {
      shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.deleteTexture(texture);
      return;
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const pointerUniform = gl.getUniformLocation(program, "u_pointer");
    const fitUniform = gl.getUniformLocation(program, "u_fit");
    const draw = () => {
      if (!ready || disposed || document.hidden) return;
      gl.uniform2f(pointerUniform, pointer[0], pointer[1]);
      gl.uniform2f(fitUniform, fit[0], fit[1]);
      gl.drawArrays(gl.TRIANGLES,0,6);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1,Math.round(rect.width*dpr)); canvas.height = Math.max(1,Math.round(rect.height*dpr));
      gl.viewport(0,0,canvas.width,canvas.height);
      const ratio = rect.width / Math.max(1,rect.height), source = 1672/941;
      fit = ratio > source ? [1,source/ratio] : [ratio/source,1];
      draw();
    };
    const onPointer = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
      pointer = [detail.x, detail.y]; draw();
    };
    const onLost = (event: Event) => { event.preventDefault(); ready = false; canvas.dataset.ready = "false"; };
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
      ready = true; resize(); canvas.dataset.ready = "true";
    };
    image.src = "/media/v7-generated/frog-opening-field.png";
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    window.addEventListener("astra:depth-pointer",onPointer);
    document.addEventListener("visibilitychange",draw);
    canvas.addEventListener("webglcontextlost",onLost);
    return () => {
      disposed = true; image.onload = null; observer.disconnect();
      window.removeEventListener("astra:depth-pointer",onPointer);
      document.removeEventListener("visibilitychange",draw);
      canvas.removeEventListener("webglcontextlost",onLost);
      shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.deleteTexture(texture);
    };
  }, []);
  return <div className={styles.depthField} aria-hidden="true"><canvas ref={canvasRef} data-astra-depth="original-artwork" /><div className={styles.tint} /></div>;
}
