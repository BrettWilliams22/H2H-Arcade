// Regenerates test/fixtures/golden.json: saved games with their exact scores.
// The golden test fails if any code change alters those scores, and the
// browser's Device Check replays them to prove a device scores identically.
//
// Only run this (npm run golden:update) after an intended rules change, and
// bump RULES_VERSION in src/constants.ts when you do.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { GameSession, type Input, MAX_MOVE, RULES_VERSION, type Replay, type ReplayResult } from "../src/index";
import { batchGame, playBotGame } from "./play";

const GOLDEN_BATCH_SEED = 0x601d;
const SKILLS = [0, 20, 40, 60, 75, 85, 90, 95, 100, 100];
/** Seeds where the strongest simulated player reaches wave 3 (found by searching), for coverage of later waves. */
const WAVE_3_SEEDS = [2023402234, 144729890];

/** Plays a match with a scripted input pattern instead of the simulated player. */
function scripted(seed: number, inputFor: (frame: number) => Input): { replay: Replay; live: ReplayResult } {
  const session = new GameSession(seed);
  while (!session.over) session.tick(inputFor(session.state.frame));
  return { replay: session.replay(), live: session.result() };
}

const games = [
  ...SKILLS.map((skill, i) => playBotGame(batchGame(GOLDEN_BATCH_SEED, i).seed, skill)),
  ...WAVE_3_SEEDS.map((seed) => playBotGame(seed, 100)),
  // Never touches anything: every serve is automatic.
  scripted(11, () => ({ move: 0, action: false })),
  // Sweeps side to side but never presses launch: automatic serves while moving.
  scripted(12, (f) => ({ move: Math.floor(f / 45) % 2 === 0 ? MAX_MOVE : -MAX_MOVE, action: false })),
  // Holds launch for the whole match and drifts: serves the moment each lock ends.
  scripted(13, (f) => ({ move: Math.floor(f / 90) % 3 - 1, action: true })),
];

const cases = games.map((g) => ({ score: g.live.score, hash: g.live.hash, replay: g.replay }));
const path = join(import.meta.dirname, "../test/fixtures/golden.json");
writeFileSync(path, `${JSON.stringify({ rules: RULES_VERSION, cases })}\n`);
console.log(`Wrote ${cases.length} golden games to ${path}`);
console.log(`Scores: ${cases.map((c) => c.score).join(", ")}`);
