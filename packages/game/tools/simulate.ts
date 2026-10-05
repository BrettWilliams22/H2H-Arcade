// Plays many games with simulated players and saves each recording to disk.
//
//   npm run simulate                      1,000 games into ./replays
//   npm run simulate -- --games 50 --out my-folder --seed 7
//
// Also writes expected.json: the score each live game reached. `npm run verify`
// replays every file and checks it gets the same scores.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { intFlag, parseArgs } from "./args";
import { type ExpectedEntry, batchGame, playBotGame } from "./play";

const { flags } = parseArgs();
const games = intFlag(flags, "games", 1000);
const batchSeed = intFlag(flags, "seed", 1);
const out = flags.out ?? "replays";

mkdirSync(out, { recursive: true });
const expected: ExpectedEntry[] = [];
const started = Date.now();

for (let i = 0; i < games; i++) {
  const { seed, skill } = batchGame(batchSeed, i);
  const game = playBotGame(seed, skill);
  const file = `game-${String(i + 1).padStart(4, "0")}.json`;
  writeFileSync(join(out, file), JSON.stringify(game.replay));
  expected.push({ file, seed, skill, score: game.live.score, hash: game.live.hash });
}

writeFileSync(join(out, "expected.json"), JSON.stringify(expected, null, 2));

const scores = expected.map((e) => e.score).sort((a, b) => a - b);
const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
console.log(`Played ${games} games in ${((Date.now() - started) / 1000).toFixed(1)}s and saved them to ${out}/`);
console.log(`Scores: lowest ${scores[0]}, median ${scores[Math.floor(scores.length / 2)]}, highest ${scores[scores.length - 1]}, average ${average}`);
console.log(`Next: npm run verify${out === "replays" ? "" : ` -- ${out}`}`);
