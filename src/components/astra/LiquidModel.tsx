import { useEffect, useRef } from "react";
import styles from "@/styles/liquid-reference-v7.module.css";

type ModelHandle = { dispose(): void };
type ModelModule = {
  mountLiquidModel(element: HTMLElement, options: { onError(error: unknown): void; prefetchedModel: { url: string; response: Promise<Response> } }): ModelHandle;
};

// Render inside the existing GSAP mascot rig; this component never owns its route.
export function LiquidModel({ onError, attempt }: { onError: () => void; attempt: number }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let model: ModelHandle | undefined;
    // Absolute URL keeps the self-contained module on Vite's static-asset route.
    const runtimeUrl = new URL("/media/liquid-3d/runtime.js?v=web7", window.location.href).href;
    // Fetch alongside the module graph. Passing the same response to the
    // renderer avoids Safari downloading a fetch-preloaded model a second time.
    const download = new AbortController();
    const modelUrl = new URL(`Liquid-animated-mobile-v2.glb${typeof DecompressionStream !== "undefined" ? ".gz" : ""}`, runtimeUrl).href;
    const prefetchedModel = { url: modelUrl, response: fetch(modelUrl, { signal: download.signal, priority: "high" }) };
    void prefetchedModel.response.catch(() => {}); // handled by the renderer, or cancelled on module failure
    host.dataset.loadState = "importing";
    host.dataset.loadProgress = "2";
    const attemptUrl = attempt ? `${runtimeUrl}&retry=${attempt}` : runtimeUrl;
    const fail = () => {
      if (!disposed) { download.abort(); host.dataset.error = "true"; onError(); }
    };
    void (import(/* @vite-ignore */ attemptUrl) as Promise<ModelModule>)
      .then(({ mountLiquidModel }) => {
        if (!disposed) model = mountLiquidModel(host, { onError: fail, prefetchedModel });
      })
      .catch(fail);
    return () => { disposed = true; download.abort(); model?.dispose(); };
  }, [onError, attempt]);

  return (
    <div className={styles.liquidModel} data-liquid-model data-ready="false" ref={hostRef}>
      <img
        alt=""
        className={styles.liquidModelFallback}
        src="/media/mascot/Liquid_cat_poster_alpha_decontaminated.png"
      />
    </div>
  );
}
