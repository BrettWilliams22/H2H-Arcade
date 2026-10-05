import { dailySeed, randomSeed, todayKey } from "./game/seeds";

/** Everything needed to start a game. */
export interface GameSetup {
  seed: number;
  kind: "practice" | "daily" | "custom";
  /** For daily games: the UTC date of the layout. */
  day: string | null;
  /** Shown above the game. */
  title: string;
  /** Shown in small text inside the field. */
  tag: string;
}

export function practiceSetup(seed = randomSeed()): GameSetup {
  return { seed, kind: "practice", day: null, title: "PRACTICE", tag: `SEED ${seed}` };
}

export function dailySetup(day = todayKey()): GameSetup {
  return { seed: dailySeed(day), kind: "daily", day, title: `DAILY ${day}`, tag: `DAILY ${day}` };
}

export function customSetup(seed: number): GameSetup {
  return { seed, kind: "custom", day: null, title: `SEED ${seed}`, tag: `SEED ${seed}` };
}

/** The same game again, as a fresh object so the play screen restarts. */
export function againSetup(setup: GameSetup): GameSetup {
  return { ...setup };
}
