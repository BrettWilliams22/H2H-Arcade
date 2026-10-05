import { describe, expect, it } from "vitest";
import { dailySeed, parseSeed, todayKey } from "../src/game/seeds";

describe("seeds", () => {
  it("gives everyone the same daily seed, and a different one each day", () => {
    expect(dailySeed("2026-10-05")).toBe(dailySeed("2026-10-05"));
    expect(dailySeed("2026-10-05")).not.toBe(dailySeed("2026-10-06"));
  });

  it("uses the UTC date", () => {
    expect(todayKey(new Date("2026-10-05T23:30:00-05:00"))).toBe("2026-10-06");
  });

  it("accepts only whole numbers from 0 to 4294967295", () => {
    expect(parseSeed(" 42 ")).toBe(42);
    expect(parseSeed("4294967295")).toBe(4294967295);
    expect(parseSeed("4294967296")).toBeNull();
    expect(parseSeed("-1")).toBeNull();
    expect(parseSeed("1.5")).toBeNull();
    expect(parseSeed("abc")).toBeNull();
    expect(parseSeed("")).toBeNull();
  });
});
