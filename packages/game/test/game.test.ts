import { describe, expect, it } from "vitest";
import {
  AUTO_SERVE_FRAMES,
  BALL_SIZE,
  BALL_SPEED_MAX,
  BRICK_COLS,
  BRICK_HP,
  BRICK_POINTS,
  BrickType,
  FIELD_H,
  FIELD_W,
  FP,
  type GameState,
  type Input,
  MATCH_FRAMES,
  MAX_MOVE,
  NO_INPUT,
  PADDLE_W,
  PADDLE_Y,
  SERVE_LOCK_FRAMES,
  STREAK_PER_MULT,
  WAVE_CLEAR_BONUS,
  createGame,
  isOver,
  multiplier,
  normalizeInput,
  step,
} from "../src/index";

/** A game with no bricks, the ball flying freely at the given spot and speed (pixels; speed in 1/256 px). */
function freeBall(x: number, y: number, vx: number, vy: number): GameState {
  const state = createGame(1);
  state.bricks.fill(BrickType.None);
  state.brickHp.fill(0);
  state.bricksLeft = 0;
  state.ballHeld = false;
  state.ballX = x * FP;
  state.ballY = y * FP;
  state.ballVX = vx;
  state.ballVY = vy;
  return state;
}

function putBrick(state: GameState, row: number, col: number, type: number): number {
  const index = row * BRICK_COLS + col;
  state.bricks[index] = type;
  state.brickHp[index] = BRICK_HP[type];
  state.bricksLeft++;
  return index;
}

function stepUntil(state: GameState, done: (s: GameState) => boolean, input: Input = NO_INPUT, limit = 600): void {
  for (let i = 0; i < limit && !done(state); i++) step(state, input);
  if (!done(state)) throw new Error("condition never happened");
}

describe("paddle", () => {
  it("moves at most MAX_MOVE pixels per frame and stays on the field", () => {
    const state = createGame(1);
    const start = state.paddleX;
    step(state, { move: 100, action: false });
    expect(state.paddleX).toBe(start + MAX_MOVE);
    for (let i = 0; i < 100; i++) step(state, { move: MAX_MOVE, action: false });
    expect(state.paddleX).toBe(FIELD_W - PADDLE_W);
    for (let i = 0; i < 100; i++) step(state, { move: -MAX_MOVE, action: false });
    expect(state.paddleX).toBe(0);
  });

  it("cleans up bad inputs", () => {
    expect(normalizeInput({ move: Number.NaN, action: false })).toEqual({ move: 0, action: false });
    expect(normalizeInput({ move: 3.9, action: true })).toEqual({ move: 3, action: true });
    expect(normalizeInput({ move: -1e9, action: false })).toEqual({ move: -MAX_MOVE, action: false });
    expect(normalizeInput({ move: Infinity, action: "yes" as unknown as boolean })).toEqual({ move: 0, action: false });
  });
});

describe("serving", () => {
  it("keeps the ball on the paddle until the player launches it", () => {
    const state = createGame(1);
    step(state, { move: -4, action: false });
    expect(state.ballHeld).toBe(true);
    expect(state.ballX).toBe((state.paddleX + (PADDLE_W - BALL_SIZE) / 2) * FP);
    step(state, { move: 0, action: true });
    expect(state.ballHeld).toBe(false);
    expect(state.ballVY).toBeLessThan(0);
    expect(state.stats.serves).toBe(1);
  });

  it("angles the serve in the direction the paddle is moving", () => {
    const left = createGame(1);
    step(left, { move: -2, action: true });
    expect(left.ballVX).toBeLessThan(0);
    const right = createGame(1);
    step(right, { move: 2, action: true });
    expect(right.ballVX).toBeGreaterThan(0);
  });

  it("launches by itself if the player waits too long", () => {
    const state = createGame(1);
    for (let i = 0; i < AUTO_SERVE_FRAMES - 1; i++) step(state, NO_INPUT);
    expect(state.ballHeld).toBe(true);
    step(state, NO_INPUT);
    expect(state.ballHeld).toBe(false);
  });
});

describe("ball", () => {
  it("bounces off the side walls and the ceiling", () => {
    const state = freeBall(2, 150, -1024, -256);
    stepUntil(state, (s) => s.ballVX > 0);
    expect(state.ballX).toBeGreaterThanOrEqual(0);

    const top = freeBall(100, 3, 0, -1024);
    stepUntil(top, (s) => s.ballVY > 0);
    expect(top.ballY).toBeGreaterThanOrEqual(0);
  });

  it("bounces off the paddle, and the edge of the paddle sends it out at a sharper angle", () => {
    const center = freeBall(0, 250, 0, 1024);
    center.ballX = (center.paddleX + PADDLE_W / 2 - BALL_SIZE / 2) * FP;
    stepUntil(center, (s) => s.ballVY < 0);
    expect(center.stats.paddleHits).toBe(1);

    const edge = freeBall(0, 250, 0, 1024);
    edge.ballX = (edge.paddleX + PADDLE_W - 1) * FP;
    stepUntil(edge, (s) => s.ballVY < 0);
    expect(edge.ballVX).toBeGreaterThan(0);
    expect(Math.abs(edge.ballVX)).toBeGreaterThan(Math.abs(center.ballVX));
    expect(Math.abs(edge.ballVX)).toBeGreaterThan(Math.abs(edge.ballVY));
  });

  it("never goes faster than the top speed, however long the rally", () => {
    const state = freeBall(0, 250, 0, 1024);
    state.ballX = (state.paddleX + PADDLE_W / 2 - BALL_SIZE / 2) * FP;
    state.rallyHits = 1000;
    stepUntil(state, (s) => s.ballVY < 0);
    // The steepest angle is mostly vertical, so the vertical speed is close to the full speed.
    expect(Math.abs(state.ballVY)).toBeLessThanOrEqual(BALL_SPEED_MAX);
    expect(Math.abs(state.ballVY)).toBeGreaterThan(BALL_SPEED_MAX * 0.95);
  });

  it("is lost below the paddle, which resets the streak and puts the ball back on the paddle", () => {
    const state = freeBall(5, PADDLE_Y + 2, 0, 1024);
    state.streak = 20;
    stepUntil(state, (s) => s.ballHeld);
    expect(state.stats.ballsLost).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.serveLock).toBe(SERVE_LOCK_FRAMES);
    expect(state.ballY).toBeLessThan(FIELD_H * FP);
  });
});

describe("bricks and scoring", () => {
  it("breaks a basic brick in one hit and bounces the ball back", () => {
    const state = freeBall(105, 80, 0, -512);
    const index = putBrick(state, 0, 4, BrickType.Basic);
    putBrick(state, 8, 0, BrickType.Basic); // keeps the wave from ending
    stepUntil(state, (s) => s.ballVY > 0);
    expect(state.bricks[index]).toBe(BrickType.None);
    expect(state.score).toBe(BRICK_POINTS[BrickType.Basic]);
    expect(state.streak).toBe(1);
  });

  it("needs three hits for an armored brick", () => {
    const state = freeBall(105, 80, 0, -512);
    const index = putBrick(state, 0, 4, BrickType.Armored);
    putBrick(state, 8, 0, BrickType.Basic);
    for (let hit = 1; hit <= 3; hit++) {
      stepUntil(state, (s) => s.ballVY > 0);
      expect(state.brickHp[index]).toBe(3 - hit);
      state.ballY = 80 * FP;
      state.ballVY = -512;
    }
    expect(state.bricks[index]).toBe(BrickType.None);
    expect(state.score).toBe(BRICK_POINTS[BrickType.Armored]);
  });

  it("multiplies points by the streak", () => {
    const state = freeBall(105, 80, 0, -512);
    putBrick(state, 0, 4, BrickType.Basic);
    putBrick(state, 8, 0, BrickType.Basic);
    state.streak = STREAK_PER_MULT;
    expect(multiplier(state)).toBe(2);
    stepUntil(state, (s) => s.ballVY > 0);
    expect(state.score).toBe(2 * BRICK_POINTS[BrickType.Basic]);
  });

  it("chains bomb explosions", () => {
    const state = freeBall(105, 100, 0, -512);
    const bomb = putBrick(state, 2, 4, BrickType.Bomb);
    const second = putBrick(state, 1, 5, BrickType.Bomb);
    const nearFirst = putBrick(state, 1, 3, BrickType.Armored);
    const nearSecond = putBrick(state, 0, 6, BrickType.Tough);
    const farAway = putBrick(state, 8, 0, BrickType.Basic);
    stepUntil(state, (s) => s.ballVY > 0);
    for (const i of [bomb, second, nearFirst, nearSecond]) expect(state.bricks[i]).toBe(BrickType.None);
    expect(state.bricks[farAway]).toBe(BrickType.Basic);
    expect(state.stats.bricksBroken).toBe(4);
  });

  it("starts the next wave with a bonus when the last brick breaks", () => {
    const state = freeBall(105, 80, 0, -512);
    putBrick(state, 0, 4, BrickType.Basic);
    stepUntil(state, (s) => s.wave === 2);
    expect(state.score).toBe(BRICK_POINTS[BrickType.Basic] + WAVE_CLEAR_BONUS);
    expect(state.stats.wavesCleared).toBe(1);
    expect(state.ballHeld).toBe(true);
    expect(state.bricksLeft).toBeGreaterThan(0);
  });
});

describe("match length", () => {
  it("ends after exactly MATCH_FRAMES frames and then stops changing", () => {
    const state = createGame(5);
    for (let i = 0; i < MATCH_FRAMES; i++) {
      expect(isOver(state)).toBe(false);
      step(state, { move: i % 7 === 0 ? 3 : -2, action: true });
    }
    expect(isOver(state)).toBe(true);
    const snapshot = JSON.stringify(state);
    step(state, { move: 5, action: true });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
