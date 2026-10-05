// Seeded random numbers.
//
// The same seed always produces the same sequence on every device, because
// everything here uses 32-bit integer math only (no floating point).

/** Scrambles a 32-bit number. Used to turn related inputs into unrelated seeds. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Makes a new seed from a base seed and a label number. For example, wave 3 of
 * a match uses deriveSeed(matchSeed, 3), so its layout does not depend on how
 * much randomness earlier waves used.
 */
export function deriveSeed(seed: number, salt: number): number {
  return fmix32((seed ^ fmix32((salt + 0x9e3779b9) | 0)) >>> 0);
}

/** Small, fast seeded generator (Mulberry32). */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Next whole number from 0 to 4,294,967,295. */
  nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Whole number from 0 to n - 1. */
  int(n: number): number {
    return this.nextU32() % n;
  }

  /** Whole number from lo to hi, including both. */
  range(lo: number, hi: number): number {
    return lo + this.int(hi - lo + 1);
  }

  /** True `percent` times out of 100. */
  chance(percent: number): boolean {
    return this.int(100) < percent;
  }
}
