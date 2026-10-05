// Saved games with known scores. If this fails, a code change altered how the
// game plays. If that was intended, bump RULES_VERSION and run `npm run golden:update`.
// If it was not intended, it is a bug: old matches would replay to different scores.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RULES_VERSION, verifyReplay } from "../src/index";

const golden = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/golden.json"), "utf8")) as {
  rules: number;
  cases: { score: number; hash: number; replay: unknown }[];
};

describe("golden replays", () => {
  it("were recorded for the current rules version", () => {
    expect(golden.rules).toBe(RULES_VERSION);
  });

  golden.cases.forEach((c, i) => {
    it(`game ${i + 1} still scores exactly ${c.score}`, () => {
      const checked = verifyReplay(c.replay);
      expect(checked.ok).toBe(true);
      if (checked.ok) {
        expect(checked.result.score).toBe(c.score);
        expect(checked.result.hash).toBe(c.hash);
      }
    });
  });
});
