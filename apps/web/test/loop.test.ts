// The game loop must keep real time on any screen, including browsers that
// report frame times rounded to whole milliseconds (Safari on iPhone).

import { afterEach, describe, expect, it, vi } from "vitest";
import { FixedLoop } from "../src/game/loop";

/** Drives FixedLoop with fake screen refreshes. Returns game frames per refresh. */
function simulate(refreshMs: number, seconds: number, timestamp: (t: number) => number): number[] {
  let pending: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pending = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(performance, "now").mockReturnValue(0);

  const perRefresh: number[] = [];
  let steps = 0;
  const loop = new FixedLoop(
    () => {
      steps++;
      return true;
    },
    () => {
      perRefresh.push(steps);
      steps = 0;
    },
  );
  loop.start();
  for (let t = refreshMs; t <= seconds * 1000; t += refreshMs) {
    const cb = pending as FrameRequestCallback | null;
    pending = null;
    cb?.(timestamp(t));
  }
  loop.stop();
  return perRefresh;
}

const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FixedLoop", () => {
  for (const hz of [60, 120, 144, 30]) {
    it(`runs 5,400 game frames in 90 s at ${hz} Hz, even with whole-millisecond times`, () => {
      const frames = simulate(1000 / hz, 90, Math.floor);
      expect(Math.abs(total(frames) - 5400)).toBeLessThanOrEqual(2);
    });
  }

  it("runs exactly one game frame per refresh on a jittery 60 Hz screen", () => {
    let i = 0;
    const jitter = (t: number) => t + (((i++ * 7919) % 61) / 100 - 0.3); // ±0.3 ms
    const frames = simulate(1000 / 60, 10, jitter);
    expect(frames.slice(1).every((n) => n === 1)).toBe(true);
  });
});
