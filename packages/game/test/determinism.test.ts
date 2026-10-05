// The Milestone 1 test: replaying 1,000 recorded games gives identical scores every time.

import { describe, expect, it } from "vitest";
import { GameSession, type GameState, verifyReplay } from "../src/index";
import { createBot } from "../tools/bot";
import { batchGame, playBotGame } from "../tools/play";

const GAMES = 1000;
const BATCH_SEED = 0x5eed;

/** Every number in the game state must be a whole number. Fractions are where devices disagree. */
function findNonInteger(value: unknown, path = "state"): string | null {
  if (typeof value === "number") return Number.isSafeInteger(value) ? null : `${path} = ${value}`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const bad = findNonInteger(value[i], `${path}[${i}]`);
      if (bad) return bad;
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [key, v] of Object.entries(value)) {
      const bad = findNonInteger(v, `${path}.${key}`);
      if (bad) return bad;
    }
  }
  return null;
}

describe("determinism", () => {
  it(`replays ${GAMES} recorded games with identical scores every time`, () => {
    const mismatches: string[] = [];
    const scores = new Set<number>();

    for (let i = 0; i < GAMES; i++) {
      const { seed, skill } = batchGame(BATCH_SEED, i);
      const game = playBotGame(seed, skill);
      scores.add(game.live.score);

      // Send the recording through JSON, like it will travel to the server.
      const wire = JSON.stringify(game.replay);
      for (let run = 1; run <= 2; run++) {
        const checked = verifyReplay(JSON.parse(wire));
        if (!checked.ok) {
          mismatches.push(`game ${i}: rejected (${checked.error})`);
        } else if (checked.result.score !== game.live.score || checked.result.hash !== game.live.hash) {
          mismatches.push(`game ${i} run ${run}: live ${game.live.score}, replay ${checked.result.score}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
    // Sanity check that the games were real games, not all the same.
    expect(scores.size).toBeGreaterThan(GAMES / 4);
  }, 300_000);

  it("keeps every number in the game state a whole number", () => {
    for (let i = 0; i < 10; i++) {
      const { seed, skill } = batchGame(BATCH_SEED, i);
      const session = new GameSession(seed);
      const bot = createBot({ skill, seed: i });
      while (!session.over) {
        session.tick(bot(session.state));
        const bad = findNonInteger(session.state satisfies GameState);
        if (bad) throw new Error(`frame ${session.state.frame}: ${bad}`);
      }
    }
  });
});
