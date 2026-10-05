// Saved games with known scores. If this fails, a code change altered how the
// game plays. If that was intended, bump RULES_VERSION and run `npm run golden:update`.
// If it was not intended, it is a bug: old matches would replay to different scores.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GameEventType, RULES_VERSION, type Replay, ReplayPlayer, validateReplay, verifyReplay } from "../src/index";

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

  it("cover later waves and automatic serves, so Device Check tests those paths too", () => {
    let maxWave = 0;
    let autoServes = 0;
    let movingServes = 0;
    for (const c of golden.cases) {
      const checked = validateReplay(c.replay);
      if (!checked.ok) throw new Error(checked.error);
      const replay: Replay = checked.replay;
      const player = new ReplayPlayer(replay);
      let next = 0;
      let action = false;
      let move = 0;
      while (!player.done) {
        const event = replay.inputs[next];
        if (event !== undefined && event[0] === player.state.frame) {
          [, move] = event;
          action = event[2] === 1;
          next++;
        }
        player.advance();
        if (player.state.events.some((e) => e.type === GameEventType.Serve)) {
          if (!action) autoServes++;
          if (move !== 0) movingServes++;
        }
      }
      maxWave = Math.max(maxWave, player.state.wave);
    }
    expect(maxWave).toBeGreaterThanOrEqual(3);
    expect(autoServes).toBeGreaterThan(0);
    expect(movingServes).toBeGreaterThan(0);
  });
});
