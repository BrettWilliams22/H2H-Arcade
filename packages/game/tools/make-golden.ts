// Regenerates test/fixtures/golden.json: a few saved games with their exact
// scores. The golden test fails if any code change alters those scores.
//
// Only run this (npm run golden:update) after an intended rules change, and
// bump RULES_VERSION in src/constants.ts when you do.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { RULES_VERSION } from "../src/index";
import { batchGame, playBotGame } from "./play";

const GOLDEN_BATCH_SEED = 0x601d;
const SKILLS = [0, 20, 40, 60, 75, 85, 90, 95, 100, 100];

const cases = SKILLS.map((skill, i) => {
  const { seed } = batchGame(GOLDEN_BATCH_SEED, i);
  const game = playBotGame(seed, skill);
  return { score: game.live.score, hash: game.live.hash, replay: game.replay };
});

const path = join(import.meta.dirname, "../test/fixtures/golden.json");
writeFileSync(path, `${JSON.stringify({ rules: RULES_VERSION, cases })}\n`);
console.log(`Wrote ${cases.length} golden games to ${path}`);
console.log(`Scores: ${cases.map((c) => c.score).join(", ")}`);
