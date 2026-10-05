import { describe, expect, it } from "vitest";
import { Rng, deriveSeed } from "../src/index";

describe("Rng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it("matches known values, so it can never silently change", () => {
    const rng = new Rng(1);
    expect([rng.nextU32(), rng.nextU32(), rng.nextU32()]).toEqual([2693262067, 11749833, 2265367787]);
  });

  it("gives different sequences for different seeds", () => {
    expect(new Rng(1).nextU32()).not.toBe(new Rng(2).nextU32());
  });

  it("keeps int() and range() inside their bounds", () => {
    const rng = new Rng(99);
    for (let i = 0; i < 10_000; i++) {
      const n = rng.int(7);
      expect(n >= 0 && n < 7 && Number.isInteger(n)).toBe(true);
      const r = rng.range(-3, 3);
      expect(r >= -3 && r <= 3 && Number.isInteger(r)).toBe(true);
    }
  });
});

describe("deriveSeed", () => {
  it("is stable and spreads nearby inputs apart", () => {
    expect(deriveSeed(42, 1)).toBe(deriveSeed(42, 1));
    const seeds = new Set<number>();
    for (let i = 0; i < 1000; i++) seeds.add(deriveSeed(42, i));
    expect(seeds.size).toBe(1000);
  });
});
