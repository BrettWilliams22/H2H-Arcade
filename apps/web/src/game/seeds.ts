import { deriveSeed } from "@h2h/game";

/** A fresh random layout for practice. Browser randomness is fine here: it only picks the seed. */
export function randomSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0];
}

/** Today's date in UTC as YYYY-MM-DD, so everyone in the world shares the same daily layout. */
export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The same layout for everyone on a given day. */
export function dailySeed(day = todayKey()): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 0x01000193);
  return deriveSeed(h >>> 0, 0xda11);
}

/** Reads a seed typed by the player. Returns null if it isn't a whole number from 0 to 4294967295. */
export function parseSeed(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,10}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= 0xffffffff ? value : null;
}
