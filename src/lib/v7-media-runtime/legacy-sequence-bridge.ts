import type { V7MediaAdapter } from "@/lib/v7-media-runtime/runtime";

export type V7HeadlineTier = "basic" | "standard" | "pro";

export function readLegacyPhoneVisualTier(
  adapter: V7MediaAdapter,
  states: readonly (HTMLElement | null)[],
  currentTier: number,
) {
  let nextTier = currentTier;
  let strongestOpacity = 0.5;
  states.forEach((state, index) => {
    if (!state) return;
    const opacity = adapter.computedOpacity(state);
    if (opacity > strongestOpacity) {
      strongestOpacity = opacity;
      nextTier = index;
    }
  });
  return nextTier;
}

export function readLegacyHeadlinePlayingTiers(headlineRig: HTMLElement) {
  return new Set(
    (headlineRig.dataset.playingTiers ?? headlineRig.dataset.activeTier ?? "")
      .split(" ")
      .filter(Boolean) as V7HeadlineTier[],
  );
}

export function readLegacyStandardPhonePreroll(stage: HTMLElement) {
  return stage.dataset.standardPhonePreroll === "true";
}

export function readLegacyProAtmosphereDemand(stage: HTMLElement) {
  return readLegacyProAtmosphereState(stage).demand;
}

export function readLegacyProAtmosphereState(stage: HTMLElement) {
  const warm = stage.dataset.proAtmosphereWarm === "true";
  const active = stage.dataset.proAtmosphereActive === "true";
  return {
    warm,
    active,
    demand: active ? "play" as const : warm ? "warm" as const : "cold" as const,
  };
}
