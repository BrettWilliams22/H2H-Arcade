// Replays every saved recording (with no screen) and checks the scores.
//
//   npm run verify                        checks ./replays
//   npm run verify -- my-folder --times 5
//
// Each file is replayed several times. Every run must give exactly the score
// the live game reached (from expected.json), or this reports a failure.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyReplay } from "../src/index";
import { intFlag, parseArgs } from "./args";
import type { ExpectedEntry } from "./play";

const { flags, rest } = parseArgs();
const dir = rest[0] ?? "replays";
const times = intFlag(flags, "times", 3);

let expected: ExpectedEntry[];
try {
  expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));
} catch {
  console.error(`Could not read ${join(dir, "expected.json")}. Run "npm run simulate" first.`);
  process.exit(1);
}

const failures: string[] = [];
const started = Date.now();

for (const entry of expected) {
  const data: unknown = JSON.parse(readFileSync(join(dir, entry.file), "utf8"));
  for (let run = 1; run <= times; run++) {
    const checked = verifyReplay(data);
    if (!checked.ok) {
      failures.push(`${entry.file}: rejected: ${checked.error}`);
      break;
    }
    if (checked.result.score !== entry.score || checked.result.hash !== entry.hash) {
      failures.push(`${entry.file} run ${run}: expected score ${entry.score}, got ${checked.result.score}`);
    }
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
if (failures.length > 0) {
  console.error(failures.slice(0, 20).join("\n"));
  console.error(`FAILED: ${failures.length} problem(s) in ${expected.length} games.`);
  process.exit(1);
}
console.log(`PASSED: replayed ${expected.length} games ${times} times each (${seconds}s). Every score matched.`);
