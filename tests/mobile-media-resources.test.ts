import { expect, it } from "vitest";
import { createDeterministicMediaElement, DeterministicV7MediaAdapter } from "../src/lib/v7-media-runtime/deterministic-adapter";
import { connectPhoneSurface } from "../src/lib/v7-media-runtime/surfaces";

it("iOS releases departed tier decoders and can replay every tier when scrolling back", () => {
  const adapter = new DeterministicV7MediaAdapter("ios-webkit");
  adapter.setViewport(375, 634, 3);
  const videos = Array.from({length:4}, createDeterministicMediaElement);
  const states = Array.from({length:3}, () => ({dataset:{}} as HTMLElement));
  const phone = {dataset:{}} as HTMLElement;
  const stage = {dataset:{standardPhonePreroll:"false"}} as unknown as HTMLElement;
  let referenceTime = 21.8;
  const lease = connectPhoneSurface(adapter, { kind:"phone", states, videos, phone, stage,
    initialActiveTier:-1, initialProPhase:"intro", getReferenceTime:()=>referenceTime,
    onActiveTier:()=>{}, onProPhase:()=>{} });
  const scene = (time:number, tier:number) => {
    referenceTime=time;
    states.forEach((state,index)=>adapter.setComputedOpacity(state,index===tier?1:0));
    adapter.mutate(states[tier]);
    adapter.flushAnimationFrames();
  };
  adapter.setIntersection(phone,true);
  scene(21.8,0);
  expect(videos[0].dataset.sourceState).toBe("attached");
  scene(26.6,1);
  expect(videos[0].dataset.sourceState).toBe("detached");
  expect(videos[1].dataset.sourceState).toBe("attached");
  scene(31.4,2);
  expect(videos[1].dataset.sourceState).toBe("detached");
  expect(videos[2].dataset.sourceState).toBe("attached");
  adapter.emit(videos[2],"ended");
  expect(videos[2].dataset.sourceState).toBe("detached");
  expect(videos[3].dataset.sourceState).toBe("attached");
  scene(21.8,0);
  expect(videos[0].dataset.sourceState).toBe("attached");
  expect(videos[3].dataset.sourceState).toBe("detached");
  lease.dispose();
  expect(adapter.activeObserverCount).toBe(0);
  expect(adapter.activeTimerCount).toBe(0);
});
