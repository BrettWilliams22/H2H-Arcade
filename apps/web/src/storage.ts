// Small things remembered on this device only (best scores, sound setting).
// Storage can be unavailable (private browsing, blocked cookies), so every
// read and write is allowed to fail quietly, and bests are also kept in memory
// so they stay right for the rest of the visit even if they can't be saved.

import { RULES_VERSION } from "@h2h/game";

/** Bests belong to a rules version: scores made under different rules can't be compared. */
const BEST_KEY = `brickstorm.best.rules${RULES_VERSION}`;
const MUTED_KEY = "brickstorm.muted";
const DAYS_KEPT = 7;

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
    // Not saved; the in-memory copy still works for this visit.
  }
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function loadFromStorage(): Bests {
  try {
    const parsed = JSON.parse(read(BEST_KEY) ?? "null") as Partial<Bests> | null;
    const daily: Record<string, number> = {};
    if (parsed?.daily && typeof parsed.daily === "object") {
      for (const [day, score] of Object.entries(parsed.daily)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(day) && isScore(score)) daily[day] = score;
      }
    }
    return { practice: isScore(parsed?.practice) ? parsed.practice : 0, daily };
  } catch {
    return { practice: 0, daily: {} };
  }
}

let cache: Bests | null = null;

export function loadBests(): Bests {
  cache ??= loadFromStorage();
  return { practice: cache.practice, daily: { ...cache.daily } };
}

/** Saves a finished score. `day` is set for daily layouts. Returns true if it is a new best. */
export function recordScore(score: number, day: string | null): boolean {
  const bests = loadBests();
  let isBest = false;
  if (day) {
    if (score > (bests.daily[day] ?? 0)) {
      bests.daily[day] = score;
      isBest = true;
    }
    const days = Object.keys(bests.daily).sort().slice(-DAYS_KEPT);
    bests.daily = Object.fromEntries(days.map((d) => [d, bests.daily[d]]));
  } else if (score > bests.practice) {
    bests.practice = score;
    isBest = true;
  }
  cache = bests;
  write(BEST_KEY, JSON.stringify(bests));
  return isBest;
}

export function loadMuted(): boolean {
  return read(MUTED_KEY) === "1";
}

export function saveMuted(muted: boolean): void {
  write(MUTED_KEY, muted ? "1" : "0");
}
