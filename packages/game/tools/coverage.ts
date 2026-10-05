import { GameEventType, type Replay, ReplayPlayer } from "../src/index";

export interface Coverage {
  /** Highest wave any game reached. */
  maxWave: number;
  /** Serves that happened by themselves (launch not pressed). */
  autoServes: number;
  /** Serves made while the paddle was moving. */
  movingServes: number;
}

/** What a set of recordings exercises, so the golden set can't quietly lose coverage. */
export function coverageOf(replays: Replay[]): Coverage {
  const coverage: Coverage = { maxWave: 0, autoServes: 0, movingServes: 0 };
  for (const replay of replays) {
    const player = new ReplayPlayer(replay);
    let next = 0;
    let move = 0;
    let action = false;
    while (!player.done) {
      const event = replay.inputs[next];
      if (event !== undefined && event[0] === player.state.frame) {
        move = event[1];
        action = event[2] === 1;
        next++;
      }
      player.advance();
      if (player.state.events.some((e) => e.type === GameEventType.Serve)) {
        if (!action) coverage.autoServes++;
        if (move !== 0) coverage.movingServes++;
      }
    }
    coverage.maxWave = Math.max(coverage.maxWave, player.state.wave);
  }
  return coverage;
}

/** Problems with a coverage report, as sentences. Empty if it's good enough. */
export function coverageProblems(c: Coverage): string[] {
  const problems: string[] = [];
  if (c.maxWave < 3) problems.push(`no game reaches wave 3 (best was wave ${c.maxWave})`);
  if (c.autoServes === 0) problems.push("no game has an automatic serve");
  if (c.movingServes === 0) problems.push("no game serves while moving");
  return problems;
}
