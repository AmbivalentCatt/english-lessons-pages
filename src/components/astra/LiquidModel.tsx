import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import styles from "@/styles/liquid-reference-v7.module.css";

type ModelHandle = { dispose(): void };
type ModelModule = {
  mountLiquidModel(element: HTMLElement, options: { onError(error: unknown): void }): ModelHandle;
};

// Render inside the existing GSAP mascot rig; this component never owns its route.
export function LiquidModel({ onError }: { onError: Dispatch<SetStateAction<boolean>> }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let model: ModelHandle | undefined;
    // Absolute URL keeps the self-contained module on Vite's static-asset route.
    const runtimeUrl = new URL("/media/liquid-3d/runtime-framing2.js", window.location.href).href;
    const fail = () => { if (!disposed) onError(true); };
    void (import(/* @vite-ignore */ runtimeUrl) as Promise<ModelModule>)
      .then(({ mountLiquidModel }) => {
        if (!disposed) model = mountLiquidModel(host, { onError: fail });
      })
      .catch(fail);
    return () => { disposed = true; model?.dispose(); };
  }, [onError]);

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
