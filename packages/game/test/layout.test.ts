import { describe, expect, it } from "vitest";
import { BRICK_CELLS, BRICK_COLS, BrickType, generateWave, waveRows } from "../src/index";

describe("generateWave", () => {
  it("gives both players the same bricks for the same seed and wave", () => {
    for (let wave = 1; wave <= 10; wave++) {
      expect(generateWave(777, wave)).toEqual(generateWave(777, wave));
    }
  });

  it("gives different layouts for different seeds", () => {
    expect(generateWave(1, 1)).not.toEqual(generateWave(2, 1));
  });

  it("never makes an empty wave and stays inside the rows for the wave", () => {
    for (let seed = 0; seed < 300; seed++) {
      for (let wave = 1; wave <= 8; wave++) {
        const cells = generateWave(seed, wave);
        expect(cells).toHaveLength(BRICK_CELLS);
        expect(cells.filter((t) => t !== BrickType.None).length).toBeGreaterThan(0);
        const lastRow = waveRows(wave) - 1;
        cells.forEach((type, i) => {
          if (type !== BrickType.None) expect(Math.floor(i / BRICK_COLS)).toBeLessThanOrEqual(lastRow);
        });
      }
    }
  });

  it("is mirrored left to right", () => {
    const cells = generateWave(2024, 3);
    for (let r = 0; r < cells.length / BRICK_COLS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        expect(cells[r * BRICK_COLS + c]).toBe(cells[r * BRICK_COLS + (BRICK_COLS - 1 - c)]);
      }
    }
  });
});
