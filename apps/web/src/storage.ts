// Small things remembered on this device only (best scores, sound setting).
// Storage can be unavailable (private browsing, blocked cookies), so every
// read and write is allowed to fail quietly.

const BEST_KEY = "brickstorm.best.v1";
const MUTED_KEY = "brickstorm.muted";

export interface Bests {
  practice: number;
  /** Best score on each daily layout, by date (YYYY-MM-DD). Only the last few days are kept. */
  daily: Record<string, number>;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved; that's fine.
  }
}

export function loadBests(): Bests {
  try {
    const parsed = JSON.parse(read(BEST_KEY) ?? "null") as Partial<Bests> | null;
    return {
      practice: typeof parsed?.practice === "number" ? parsed.practice : 0,
      daily: parsed?.daily && typeof parsed.daily === "object" ? parsed.daily : {},
    };
  } catch {
    return { practice: 0, daily: {} };
  }
}

/** Saves a finished score. Returns true if it is a new best. */
export function recordScore(score: number, daily: string | null): boolean {
  const bests = loadBests();
  let isBest = false;
  if (daily) {
    if (score > (bests.daily[daily] ?? 0)) {
      bests.daily[daily] = score;
      isBest = true;
    }
    const days = Object.keys(bests.daily).sort().slice(-7);
    bests.daily = Object.fromEntries(days.map((d) => [d, bests.daily[d]]));
  } else if (score > bests.practice) {
    bests.practice = score;
    isBest = true;
  }
  write(BEST_KEY, JSON.stringify(bests));
  return isBest;
}

export function loadMuted(): boolean {
  return read(MUTED_KEY) === "1";
}

export function saveMuted(muted: boolean): void {
  write(MUTED_KEY, muted ? "1" : "0");
}
