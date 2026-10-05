// Brick layouts.
//
// Each wave's layout comes only from (match seed, wave number). Both players in
// a match get the same seed, so they see the same bricks in every wave, no
// matter how fast or slow they reach it.

import {
  BRICK_CELLS,
  BRICK_CELL_H,
  BRICK_CELL_W,
  BRICK_COLS,
  BRICK_H,
  BRICK_LEFT,
  BRICK_ROWS,
  BRICK_TOP,
  BRICK_W,
} from "./constants";
import { Rng, deriveSeed } from "./rng";

export const BrickType = {
  None: 0,
  /** Breaks in 1 hit. */
  Basic: 1,
  /** Breaks in 2 hits. */
  Tough: 2,
  /** Breaks in 3 hits. */
  Armored: 3,
  /** Breaks in 1 hit, worth a lot. */
  Gold: 4,
  /** Breaks in 1 hit and destroys every brick touching it. */
  Bomb: 5,
} as const;

/** Hits needed to break each brick type, indexed by BrickType. */
export const BRICK_HP: readonly number[] = [0, 1, 2, 3, 1, 1];

/** Points for breaking each brick type (before the multiplier), indexed by BrickType. */
export const BRICK_POINTS: readonly number[] = [0, 10, 30, 60, 150, 20];

/** Where the brick in a grid cell is drawn, in whole pixels. */
export function brickRect(index: number): { x: number; y: number; w: number; h: number; row: number; col: number } {
  const row = Math.floor(index / BRICK_COLS);
  const col = index % BRICK_COLS;
  return { x: col * BRICK_CELL_W + BRICK_LEFT, y: BRICK_TOP + row * BRICK_CELL_H, w: BRICK_W, h: BRICK_H, row, col };
}

const MIN_BRICKS = 16;
const MAX_ATTEMPTS = 8;

/** Number of brick rows in a wave. Starts at 4 and grows by one each wave. */
export function waveRows(wave: number): number {
  return Math.min(BRICK_ROWS, 3 + wave);
}

function pickRowType(rng: Rng, wave: number): number {
  const tough = Math.min(45, 15 + 5 * wave);
  const armored = Math.min(40, 10 * (wave - 1));
  const roll = rng.int(100 + tough + armored);
  if (roll < 100) return BrickType.Basic;
  if (roll < 100 + tough) return BrickType.Tough;
  return BrickType.Armored;
}

/**
 * Builds the bricks for one wave. Returns one brick type per grid cell, row by
 * row from the top. Layouts are mirrored left-to-right so they look designed.
 */
export function generateWave(seed: number, wave: number): number[] {
  const rng = new Rng(deriveSeed(seed, wave));
  const rows = waveRows(wave);
  const half = BRICK_COLS / 2;
  let cells: number[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    cells = new Array<number>(BRICK_CELLS).fill(BrickType.None);
    let count = 0;

    for (let r = 0; r < rows; r++) {
      const rowType = pickRowType(rng, wave);
      const sparse = rng.chance(25);
      const checkered = rng.chance(20);
      const emptyChance = sparse ? 40 : 10;

      for (let c = 0; c < half; c++) {
        let type: number = rowType;
        if (checkered && (r + c) % 2 === 1) {
          type = BrickType.None;
        } else if (rng.chance(emptyChance)) {
          type = BrickType.None;
        } else {
          const special = rng.int(100);
          if (special < 3) type = BrickType.Gold;
          else if (special < 8) type = BrickType.Bomb;
        }
        cells[r * BRICK_COLS + c] = type;
        cells[r * BRICK_COLS + (BRICK_COLS - 1 - c)] = type;
        if (type !== BrickType.None) count += 2;
      }
    }

    if (count >= MIN_BRICKS) return cells;
  }

  // Practically unreachable, but a wave must never be empty.
  for (let c = 0; c < BRICK_COLS; c++) {
    if (cells[c] === BrickType.None) cells[c] = BrickType.Basic;
  }
  return cells;
}
