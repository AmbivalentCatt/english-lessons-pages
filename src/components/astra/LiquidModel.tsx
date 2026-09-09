import { useEffect, useRef } from "react";
import styles from "@/styles/liquid-reference-v7.module.css";

type ModelHandle = { dispose(): void };
type ModelModule = {
  mountLiquidModel(element: HTMLElement, options: { onError(error: unknown): void }): ModelHandle;
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
    const runtimeUrl = new URL("/media/liquid-3d/runtime.js?v=web6", window.location.href).href;
    host.dataset.loadState = "importing";
    host.dataset.loadProgress = "2";
    const attemptUrl = attempt ? `${runtimeUrl}&retry=${attempt}` : runtimeUrl;
    const fail = () => {
      if (!disposed) { host.dataset.error = "true"; onError(); }
    };
    void (import(/* @vite-ignore */ attemptUrl) as Promise<ModelModule>)
      .then(({ mountLiquidModel }) => {
        if (!disposed) model = mountLiquidModel(host, { onError: fail });
      })
      .catch(fail);
    return () => { disposed = true; model?.dispose(); };
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
