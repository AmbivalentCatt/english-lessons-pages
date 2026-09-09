/** Readiness is a rendered 3D frame, not elapsed time or a downloaded poster. */
export async function prepareLiquidScene(stage: HTMLElement, options: {
  imageUrls: readonly string[];
  needsModel: boolean;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
  onSlow: () => void;
}) {
  const { signal, onProgress } = options;
  let completed = 0;
  let modelProgress = 0;
  let degraded = false;
  const total = options.imageUrls.length + 1;
  const report = () => {
    if (!signal.aborted) onProgress(Math.min(99, Math.round(options.needsModel
      ? completed / total * 25 + modelProgress * 74 : completed / total * 99)));
  };
  const slow = window.setTimeout(options.onSlow, 12_000);
  const aborted = () => new DOMException("Scene loading cancelled", "AbortError");
  const settleAsset = async (task: Promise<unknown>) => {
    try { await task; } catch (error) {
      if (signal.aborted) throw error;
      degraded = true;
    }
    completed++; report();
  };
  const waitForImage = (url: string) => new Promise<void>((resolve, reject) => {
    const image = new Image();
    const finish = (error?: Error) => {
      image.onload = image.onerror = null;
      signal.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve();
    };
    const cancel = () => { finish(aborted()); image.src = ""; };
    signal.addEventListener("abort", cancel, { once: true });
    image.onload = () => { void image.decode().then(() => finish(), () => finish()); };
    image.onerror = () => finish(new Error("Opening artwork unavailable"));
    if (signal.aborted) cancel(); else image.src = url;
  });
  const waitForModel = () => new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      observer.disconnect(); signal.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve();
    };
    const cancel = () => finish(aborted());
    const inspect = () => {
      const model = stage.querySelector<HTMLElement>("[data-liquid-model]");
      if (model?.dataset.error === "true") { finish(new Error("Interactive Liquid unavailable")); return; }
      if (model?.dataset.ready === "true") { modelProgress = 1; report(); finish(); return; }
      modelProgress = Math.max(modelProgress, Number(model?.dataset.loadProgress ?? 0) / 100);
      report();
    };
    const observer = new MutationObserver(inspect);
    observer.observe(stage, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["data-ready", "data-error", "data-load-progress"] });
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel(); else inspect();
  });
  try {
    await Promise.all([
      settleAsset("fonts" in document ? document.fonts.ready : Promise.resolve()),
      ...options.imageUrls.map(url => settleAsset(waitForImage(url))),
      ...(options.needsModel ? [waitForModel()] : []),
    ]);
    if (signal.aborted) throw aborted();
    return degraded;
  } finally {
    window.clearTimeout(slow);
  }
}
