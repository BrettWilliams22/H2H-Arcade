import { FIELD_W, MAX_MOVE, PADDLE_W } from "@h2h/game";
import { describe, expect, it } from "vitest";
import { type ControlState, inputFor, moveFor } from "../src/game/controls";

const idle: ControlState = { left: false, right: false, launchKey: false, pointerX: null, pointerDown: false };

describe("moveFor", () => {
  it("moves at full speed while an arrow key is held", () => {
    expect(moveFor(100, { ...idle, left: true })).toBe(-MAX_MOVE);
    expect(moveFor(100, { ...idle, right: true })).toBe(MAX_MOVE);
    expect(moveFor(100, { ...idle, left: true, right: true })).toBe(0);
  });

  it("follows the pointer without overshooting", () => {
    const paddleX = 100;
    const center = paddleX + PADDLE_W / 2;
    expect(moveFor(paddleX, { ...idle, pointerX: center })).toBe(0);
    expect(moveFor(paddleX, { ...idle, pointerX: center + 3 })).toBe(3);
    expect(moveFor(paddleX, { ...idle, pointerX: center - 2.4 })).toBe(-2);
    expect(moveFor(paddleX, { ...idle, pointerX: FIELD_W + 50 })).toBe(MAX_MOVE);
    expect(moveFor(paddleX, { ...idle, pointerX: -50 })).toBe(-MAX_MOVE);
  });

  it("lets keys win over the pointer", () => {
    expect(moveFor(100, { ...idle, pointerX: 0, right: true })).toBe(MAX_MOVE);
  });

  it("always produces a whole-number move the recorder accepts", () => {
    for (let x = -20; x <= FIELD_W + 20; x += 0.37) {
      const move = moveFor(57, { ...idle, pointerX: x });
      expect(Number.isInteger(move) && Math.abs(move) <= MAX_MOVE).toBe(true);
    }
  });
});

describe("inputFor", () => {
  it("launches with the launch key or a touch", () => {
    expect(inputFor(100, { ...idle, launchKey: true }).action).toBe(true);
    expect(inputFor(100, { ...idle, pointerDown: true }).action).toBe(true);
    expect(inputFor(100, idle).action).toBe(false);
  });
});
