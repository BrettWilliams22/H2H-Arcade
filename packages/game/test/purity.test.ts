// Guards against the things that break determinism: Math.random, the real
// clock, and math functions whose results can differ between browsers.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { verifyReplay } from "../src/index";
import { playBotGame } from "../tools/play";

const SRC = join(import.meta.dirname, "../src");

const BANNED: [RegExp, string][] = [
  [/Math\.random/, "Math.random"],
  [/\bDate\b/, "the clock (Date)"],
  [/\bperformance\b/, "the clock (performance)"],
  [/\b(setTimeout|setInterval|requestAnimationFrame)\b/, "timers"],
  [/Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot)\b/, "inexact math"],
  [/\*\*/, "the ** power operator"],
  [/\b(window|document|navigator|localStorage|fetch|crypto|process)\b/, "browser or system APIs"],
];

function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("game logic purity", () => {
  for (const file of readdirSync(SRC).filter((f) => f.endsWith(".ts"))) {
    it(`${file} uses no randomness, clock, or inexact math`, () => {
      const code = withoutComments(readFileSync(join(SRC, file), "utf8"));
      for (const [pattern, what] of BANNED) {
        expect(pattern.test(code), `${file} uses ${what}`).toBe(false);
      }
    });
  }

  it("plays and replays a game without ever calling Math.random or the clock", () => {
    const game = playBotGame(31337, 85);
    const trap = () => {
      throw new Error("game logic used randomness or the clock");
    };
    vi.spyOn(Math, "random").mockImplementation(trap);
    vi.spyOn(Date, "now").mockImplementation(trap);
    vi.spyOn(performance, "now").mockImplementation(trap);
    let score: number | null = null;
    try {
      const again = playBotGame(31337, 85);
      const checked = verifyReplay(again.replay);
      score = checked.ok ? checked.result.score : null;
    } finally {
      vi.restoreAllMocks();
    }
    expect(score).toBe(game.live.score);
  });
});
