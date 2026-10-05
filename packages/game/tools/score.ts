// Replays one recording, the way the server will, and prints its score.
//
//   npm run score -- brickstorm-123.json
//
// Use it on a recording downloaded from the browser's results screen: the score
// printed here should match the score the browser showed.

import { readFileSync } from "node:fs";
import { verifyReplay } from "../src/index";
import { parseArgs } from "./args";

const { rest } = parseArgs();
if (!rest[0]) {
  console.error("Usage: npm run score -- <recording.json>");
  process.exit(1);
}

const checked = verifyReplay(JSON.parse(readFileSync(rest[0], "utf8")));
if (!checked.ok) {
  console.error(`REJECTED: ${checked.error}`);
  process.exit(1);
}
const { score, wave, stats } = checked.result;
console.log(`Score ${score}`);
console.log(
  `Reached wave ${wave}. Bricks ${stats.bricksBroken}, waves cleared ${stats.wavesCleared}, ` +
    `balls lost ${stats.ballsLost}, best streak ${stats.maxStreak}, paddle hits ${stats.paddleHits}.`,
);
