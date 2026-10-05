// Regenerates test/fixtures/golden.json: saved games with their exact scores.
// The golden test fails if any code change alters those scores, and the
// browser's Device Check replays them to prove a device scores identically.
//
// Only run this (npm run golden:update) after an intended rules change, and
// bump RULES_VERSION in src/constants.ts when you do.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { GameSession, type Input, MAX_MOVE, RULES_VERSION, type Replay, type ReplayResult, deriveSeed } from "../src/index";
import { coverageOf, coverageProblems } from "./coverage";
import { type BotGame, batchGame, playBotGame } from "./play";

const GOLDEN_BATCH_SEED = 0x601d;
const SKILLS = [0, 20, 40, 60, 75, 85, 90, 95, 100, 100];
const WAVE_3_GAMES = 2;
const MAX_SEARCH = 20_000;

/** Plays a match with a scripted input pattern instead of the simulated player. */
function scripted(seed: number, inputFor: (frame: number) => Input): { replay: Replay; live: ReplayResult } {
  const session = new GameSession(seed);
  while (!session.over) session.tick(inputFor(session.state.frame));
  return { replay: session.replay(), live: session.result() };
}

/** Reaching wave 3 is rare (about 2% of the best simulated player's games), so search for a few. */
function findWave3Games(): BotGame[] {
  const found: BotGame[] = [];
  for (let i = 0; i < MAX_SEARCH && found.length < WAVE_3_GAMES; i++) {
    const game = playBotGame(deriveSeed(GOLDEN_BATCH_SEED, 1000 + i), 100);
    if (game.live.wave >= 3) found.push(game);
  }
  return found;
}

const games = [
  ...SKILLS.map((skill, i) => playBotGame(batchGame(GOLDEN_BATCH_SEED, i).seed, skill)),
  ...findWave3Games(),
  // Never touches anything: every serve is automatic.
  scripted(11, () => ({ move: 0, action: false })),
  // Sweeps side to side but never presses launch: automatic serves while moving.
  scripted(12, (f) => ({ move: Math.floor(f / 45) % 2 === 0 ? MAX_MOVE : -MAX_MOVE, action: false })),
  // Holds launch for the whole match and drifts: serves the moment each lock ends.
  scripted(13, (f) => ({ move: (Math.floor(f / 90) % 3) - 1, action: true })),
];

const problems = coverageProblems(coverageOf(games.map((g) => g.replay)));
if (problems.length > 0) {
  console.error(`Not writing golden.json, because ${problems.join("; ")}.`);
  console.error("The simulated player may need adjusting for the new rules. golden.json was left unchanged.");
  process.exit(1);
}

const cases = games.map((g) => ({ score: g.live.score, hash: g.live.hash, replay: g.replay }));
const path = join(import.meta.dirname, "../test/fixtures/golden.json");
writeFileSync(path, `${JSON.stringify({ rules: RULES_VERSION, cases })}\n`);
console.log(`Wrote ${cases.length} golden games to ${path}`);
console.log(`Scores: ${cases.map((c) => c.score).join(", ")}`);
