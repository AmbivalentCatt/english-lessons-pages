import { createBrowserV7MediaAdapter } from "@/lib/v7-media-runtime/browser-adapters";
import {
  connectImplementedSurface,
  type V7ImplementedMediaSurfaceSpec,
} from "@/lib/v7-media-runtime/surfaces";
import type { V7MediaAdapter, V7MediaLease } from "@/lib/v7-media-runtime/runtime";
export {
  V7_MASCOT_GAZE_INTENT_EVENT,
  V7_MASCOT_POSE_SPLICE,
  V7_MASCOT_RECORDED_LOOKS,
  type V7MascotGazeDirection,
  type V7MascotGazeIntent,
} from "@/lib/v7-media-runtime/mascot-pose-splice";

export type V7MediaSurfaceSpec = V7ImplementedMediaSurfaceSpec;

export interface V7MediaRuntime {
  connect(spec: V7MediaSurfaceSpec): V7MediaLease;
  dispose(): void;
}

export function createV7MediaRuntime(
  adapterFactory: () => V7MediaAdapter = createBrowserV7MediaAdapter,
): V7MediaRuntime {
  let adapter: V7MediaAdapter | null = null;
  let disposed = false;
  const leases = new Set<V7MediaLease>();
  const getAdapter = () => {
    if (!adapter) adapter = adapterFactory();
    return adapter;
  };

  return {
    connect(spec) {
      if (disposed) throw new Error("V7 media runtime is disposed");
      const lease = connectImplementedSurface(getAdapter(), spec);
      const trackedLease: V7MediaLease = {
        role: lease.role,
        state: lease.state,
        invalidate: lease.invalidate,
        dispose: () => {
          if (!leases.delete(trackedLease)) return;
          lease.dispose();
        },
      };
      leases.add(trackedLease);
      return trackedLease;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      Array.from(leases).reverse().forEach((lease) => lease.dispose());
      leases.clear();
    },
  };
}
