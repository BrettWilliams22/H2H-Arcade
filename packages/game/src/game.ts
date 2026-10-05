// Brickstorm game rules.
//
// Rules that keep the game deterministic (same seed + same inputs = same score
// on every device):
//   - Only whole-number math. Positions are in 1/256ths of a pixel.
//   - No Math.random, no clock, no trig functions. The only randomness is the
//     brick layout, which comes from the seed (see layout.ts).
//   - The game advances one fixed frame at a time through step().
//
// This file must never touch the screen, the keyboard, or the network.

import {
  AUTO_SERVE_FRAMES,
  BALL_SIZE,
  BALL_SPEED_MAX,
  BALL_SPEED_PER_HIT,
  BALL_SPEED_PER_WAVE,
  BALL_SPEED_START,
  BRICK_CELL_H,
  BRICK_CELL_W,
  BRICK_COLS,
  BRICK_H,
  BRICK_LEFT,
  BRICK_ROWS,
  BRICK_TOP,
  BRICK_W,
  FIELD_H,
  FIELD_W,
  FP,
  MATCH_FRAMES,
  MAX_MOVE,
  MAX_MULTIPLIER,
  PADDLE_START_X,
  PADDLE_W,
  PADDLE_Y,
  SERVE_LOCK_FRAMES,
  STREAK_PER_MULT,
  WAVE_CLEAR_BONUS,
  WAVE_LOCK_FRAMES,
} from "./constants";
import { BRICK_HP, BRICK_POINTS, BrickType, generateWave } from "./layout";

/** What the player is doing during one frame. */
export interface Input {
  /** Paddle movement in pixels this frame, from -MAX_MOVE (left) to MAX_MOVE (right). */
  move: number;
  /** Launch button held. */
  action: boolean;
}

export const NO_INPUT: Readonly<Input> = { move: 0, action: false };

/** Things that happened during a frame, for the drawing and sound code. Never used for scoring. */
export const GameEventType = {
  BrickHit: 1,
  BrickBroken: 2,
  Explosion: 3,
  PaddleHit: 4,
  WallHit: 5,
  BallLost: 6,
  WaveCleared: 7,
  Serve: 8,
} as const;

export interface GameEvent {
  type: number;
  /** Brick cell index for brick events, angle level for paddle hits. */
  index: number;
  /** Points awarded, if any. */
  value: number;
}

export interface GameStats {
  bricksBroken: number;
  ballsLost: number;
  wavesCleared: number;
  paddleHits: number;
  maxStreak: number;
  serves: number;
}

export interface GameState {
  readonly seed: number;
  /** Frames played so far. The match ends at MATCH_FRAMES. */
  frame: number;
  score: number;
  wave: number;
  /** Paddle left edge, in whole pixels. */
  paddleX: number;
  /** Ball top-left corner, in 1/256 pixel. */
  ballX: number;
  ballY: number;
  /** Ball speed, in 1/256 pixel per frame. Negative Y is up. */
  ballVX: number;
  ballVY: number;
  /** True while the ball sits on the paddle waiting to be launched. */
  ballHeld: boolean;
  /** Frames the ball has been ready to launch. */
  heldFrames: number;
  /** Frames left before the ball may be launched. */
  serveLock: number;
  /** Brick type per grid cell (BrickType.None if empty), row by row. */
  bricks: number[];
  /** Hits left per grid cell. */
  brickHp: number[];
  bricksLeft: number;
  /** Bricks broken in a row without losing the ball. Drives the multiplier. */
  streak: number;
  /** Paddle hits since the last serve. Makes the ball speed up. */
  rallyHits: number;
  stats: GameStats;
  /** Things that happened during the last step. Cleared at the start of every step. */
  events: GameEvent[];
}

// Ball directions, measured from straight up: 10, 20, 30, 40, 50 and 60 degrees.
// These are sin and cos times 1024, typed in by hand so the game never calls
// Math.sin or Math.cos (their last digits can differ between browsers).
const DIR_X = [178, 350, 512, 658, 784, 887];
const DIR_Y = [1008, 962, 887, 784, 658, 512];
const DIR_LEVELS = DIR_X.length;
const DIR_SHIFT = 10;

// Sizes converted to 1/256 pixel.
const BALL_FP = BALL_SIZE * FP;
const FIELD_W_FP = FIELD_W * FP;
const FIELD_H_FP = FIELD_H * FP;
const PADDLE_Y_FP = PADDLE_Y * FP;
const PADDLE_W_FP = PADDLE_W * FP;
const GRID_TOP_FP = BRICK_TOP * FP;
const CELL_W_FP = BRICK_CELL_W * FP;
const CELL_H_FP = BRICK_CELL_H * FP;
const BRICK_W_FP = BRICK_W * FP;
const BRICK_H_FP = BRICK_H * FP;
const BRICK_LEFT_FP = BRICK_LEFT * FP;
const GRID_BOTTOM_FP = GRID_TOP_FP + BRICK_ROWS * CELL_H_FP;
/** How far the ball center can be from the paddle center while still touching it. */
const PADDLE_REACH_FP = ((PADDLE_W + BALL_SIZE) / 2) * FP;

/** The ball moves in small slices (at most 2 pixels) so it can't skip through a brick. */
const SUBSTEP_SHIFT = 9;
const SUBSTEP = 1 << SUBSTEP_SHIFT;

/** Starts a new match. */
export function createGame(seed: number): GameState {
  const state: GameState = {
    seed: seed >>> 0,
    frame: 0,
    score: 0,
    wave: 0,
    paddleX: PADDLE_START_X,
    ballX: 0,
    ballY: 0,
    ballVX: 0,
    ballVY: 0,
    ballHeld: true,
    heldFrames: 0,
    serveLock: 0,
    bricks: [],
    brickHp: [],
    bricksLeft: 0,
    streak: 0,
    rallyHits: 0,
    stats: {
      bricksBroken: 0,
      ballsLost: 0,
      wavesCleared: 0,
      paddleHits: 0,
      maxStreak: 0,
      serves: 0,
    },
    events: [],
  };
  startWave(state, 1, 0);
  return state;
}

export function isOver(state: GameState): boolean {
  return state.frame >= MATCH_FRAMES;
}

export function framesLeft(state: GameState): number {
  return Math.max(0, MATCH_FRAMES - state.frame);
}

/** Current score multiplier, from 1 to MAX_MULTIPLIER. */
export function multiplier(state: GameState): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(state.streak / STREAK_PER_MULT));
}

/** Turns any input into a legal one: a whole-number move within the speed limit, and a true/false action. */
export function normalizeInput(input: Input): Input {
  const raw = Number.isFinite(input.move) ? Math.trunc(input.move) : 0;
  return {
    move: Math.max(-MAX_MOVE, Math.min(MAX_MOVE, raw)),
    action: input.action === true,
  };
}

/** Advances the game by exactly one frame. Does nothing once the match is over. */
export function step(state: GameState, input: Input): void {
  if (isOver(state)) return;
  state.events.length = 0;

  const { move, action } = normalizeInput(input);
  state.paddleX = Math.max(0, Math.min(FIELD_W - PADDLE_W, state.paddleX + move));

  if (state.ballHeld) {
    placeBallOnPaddle(state);
    if (state.serveLock > 0) {
      state.serveLock--;
    } else {
      state.heldFrames++;
      if (action || state.heldFrames >= AUTO_SERVE_FRAMES) serve(state, move);
    }
  } else {
    moveBall(state);
  }

  state.frame++;
}

function emit(state: GameState, type: number, index = 0, value = 0): void {
  state.events.push({ type, index, value });
}

function startWave(state: GameState, wave: number, lock: number): void {
  state.wave = wave;
  state.bricks = generateWave(state.seed, wave);
  state.brickHp = state.bricks.map((type) => BRICK_HP[type]);
  state.bricksLeft = state.bricks.filter((type) => type !== BrickType.None).length;
  holdBall(state, lock);
}

function holdBall(state: GameState, lock: number): void {
  state.ballHeld = true;
  state.heldFrames = 0;
  state.serveLock = lock;
  state.rallyHits = 0;
  state.ballVX = 0;
  state.ballVY = 0;
  placeBallOnPaddle(state);
}

function placeBallOnPaddle(state: GameState): void {
  state.ballX = (state.paddleX + (PADDLE_W - BALL_SIZE) / 2) * FP;
  state.ballY = (PADDLE_Y - BALL_SIZE) * FP;
}

function ballSpeed(state: GameState): number {
  return Math.min(
    BALL_SPEED_MAX,
    BALL_SPEED_START + (state.wave - 1) * BALL_SPEED_PER_WAVE + state.rallyHits * BALL_SPEED_PER_HIT,
  );
}

/** Sends the ball upward. side is -1 (left) or 1 (right); level picks the angle (0 = steepest). */
function launchBall(state: GameState, side: number, level: number): void {
  const speed = ballSpeed(state);
  state.ballVX = side * ((DIR_X[level] * speed) >> DIR_SHIFT);
  state.ballVY = -((DIR_Y[level] * speed) >> DIR_SHIFT);
}

/** Launches the ball from the paddle. Moving while serving angles the shot. */
function serve(state: GameState, move: number): void {
  state.ballHeld = false;
  state.stats.serves++;
  launchBall(state, move < 0 ? -1 : 1, move === 0 ? 0 : 2);
  emit(state, GameEventType.Serve);
}

function moveBall(state: GameState): void {
  const ax = Math.abs(state.ballVX);
  const ay = Math.abs(state.ballVY);
  const steps = Math.max(1, (Math.max(ax, ay) + SUBSTEP - 1) >> SUBSTEP_SHIFT);

  for (let i = 0; i < steps; i++) {
    // Split the move into nearly equal whole-number slices that add up exactly.
    const dx = Math.floor((ax * (i + 1)) / steps) - Math.floor((ax * i) / steps);
    const dy = Math.floor((ay * (i + 1)) / steps) - Math.floor((ay * i) / steps);

    if (dx !== 0) {
      moveBallX(state, state.ballVX > 0 ? dx : -dx);
      if (state.ballHeld) return;
    }
    if (dy !== 0) {
      moveBallY(state, state.ballVY > 0 ? dy : -dy);
      if (state.ballHeld) return;
    }
  }
}

function moveBallX(state: GameState, dx: number): void {
  state.ballX += dx;

  const hits = overlappingBricks(state);
  if (hits.length > 0) {
    state.ballX -= dx;
    state.ballVX = -state.ballVX;
    hitBricks(state, hits);
    return;
  }

  if (state.ballX < 0) {
    state.ballX = -state.ballX;
    state.ballVX = Math.abs(state.ballVX);
    emit(state, GameEventType.WallHit);
  } else if (state.ballX + BALL_FP > FIELD_W_FP) {
    state.ballX = 2 * (FIELD_W_FP - BALL_FP) - state.ballX;
    state.ballVX = -Math.abs(state.ballVX);
    emit(state, GameEventType.WallHit);
  }
}

function moveBallY(state: GameState, dy: number): void {
  state.ballY += dy;

  const hits = overlappingBricks(state);
  if (hits.length > 0) {
    state.ballY -= dy;
    state.ballVY = -state.ballVY;
    hitBricks(state, hits);
    return;
  }

  if (state.ballY < 0) {
    state.ballY = -state.ballY;
    state.ballVY = Math.abs(state.ballVY);
    emit(state, GameEventType.WallHit);
    return;
  }

  const bottom = state.ballY + BALL_FP;
  const wasAbovePaddle = bottom - dy <= PADDLE_Y_FP;
  if (state.ballVY > 0 && bottom > PADDLE_Y_FP && wasAbovePaddle) {
    const paddleLeft = state.paddleX * FP;
    if (state.ballX < paddleLeft + PADDLE_W_FP && state.ballX + BALL_FP > paddleLeft) {
      bounceOffPaddle(state, paddleLeft);
      return;
    }
  }

  if (state.ballY >= FIELD_H_FP) loseBall(state);
}

/**
 * Where the ball lands on the paddle sets its new angle: the middle sends it
 * nearly straight up, the edges send it out at a sharp angle.
 */
function bounceOffPaddle(state: GameState, paddleLeft: number): void {
  const offset = state.ballX + BALL_FP / 2 - (paddleLeft + PADDLE_W_FP / 2);
  const level = Math.min(DIR_LEVELS - 1, Math.floor((Math.abs(offset) * DIR_LEVELS) / PADDLE_REACH_FP));
  const side = offset < 0 ? -1 : offset > 0 ? 1 : state.ballVX < 0 ? -1 : 1;

  state.ballY = PADDLE_Y_FP - BALL_FP;
  state.rallyHits++;
  state.stats.paddleHits++;
  launchBall(state, side, level);
  emit(state, GameEventType.PaddleHit, level, side);
}

function loseBall(state: GameState): void {
  state.streak = 0;
  state.stats.ballsLost++;
  emit(state, GameEventType.BallLost);
  holdBall(state, SERVE_LOCK_FRAMES);
}

/** Grid cells whose brick overlaps the ball, top row first, left to right. */
function overlappingBricks(state: GameState): number[] {
  const left = state.ballX;
  const top = state.ballY;
  const right = left + BALL_FP;
  const bottom = top + BALL_FP;
  if (bottom <= GRID_TOP_FP || top >= GRID_BOTTOM_FP) return [];

  const r0 = Math.max(0, Math.floor((top - GRID_TOP_FP) / CELL_H_FP));
  const r1 = Math.min(BRICK_ROWS - 1, Math.floor((bottom - 1 - GRID_TOP_FP) / CELL_H_FP));
  const c0 = Math.max(0, Math.floor(left / CELL_W_FP));
  const c1 = Math.min(BRICK_COLS - 1, Math.floor((right - 1) / CELL_W_FP));

  const hits: number[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const index = r * BRICK_COLS + c;
      if (state.bricks[index] === BrickType.None) continue;
      const bx = c * CELL_W_FP + BRICK_LEFT_FP;
      const by = GRID_TOP_FP + r * CELL_H_FP;
      if (left < bx + BRICK_W_FP && right > bx && top < by + BRICK_H_FP && bottom > by) {
        hits.push(index);
      }
    }
  }
  return hits;
}

function hitBricks(state: GameState, hits: number[]): void {
  for (const index of hits) {
    if (state.bricks[index] === BrickType.None) continue; // already destroyed by an explosion
    state.brickHp[index]--;
    if (state.brickHp[index] > 0) {
      emit(state, GameEventType.BrickHit, index);
    } else {
      breakBrick(state, index);
    }
  }
  if (state.bricksLeft === 0) clearWave(state);
}

/** Destroys a brick. Bombs also destroy every brick around them, which can set off more bombs. */
function breakBrick(state: GameState, start: number): void {
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const index = queue[q];
    const type = state.bricks[index];
    if (type === BrickType.None) continue;

    state.bricks[index] = BrickType.None;
    state.brickHp[index] = 0;
    state.bricksLeft--;

    const points = BRICK_POINTS[type] * multiplier(state);
    state.score += points;
    state.streak++;
    state.stats.bricksBroken++;
    state.stats.maxStreak = Math.max(state.stats.maxStreak, state.streak);
    emit(state, GameEventType.BrickBroken, index, points);

    if (type === BrickType.Bomb) {
      emit(state, GameEventType.Explosion, index);
      const row = Math.floor(index / BRICK_COLS);
      const col = index % BRICK_COLS;
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          if (r < 0 || r >= BRICK_ROWS || c < 0 || c >= BRICK_COLS) continue;
          const neighbor = r * BRICK_COLS + c;
          if (state.bricks[neighbor] !== BrickType.None) queue.push(neighbor);
        }
      }
    }
  }
}

function clearWave(state: GameState): void {
  const bonus = WAVE_CLEAR_BONUS * state.wave;
  state.score += bonus;
  state.stats.wavesCleared++;
  emit(state, GameEventType.WaveCleared, state.wave, bonus);
  startWave(state, state.wave + 1, WAVE_LOCK_FRAMES);
}
