// A simulated player, used to generate lots of realistic recorded games for
// testing. Not part of the game itself. Skill 0 plays badly, 100 plays well.
//
// It uses the seeded Rng (never Math.random), so a bot with the same settings
// always plays the same way. That makes test failures reproducible.

import {
  BALL_SIZE,
  FIELD_W,
  FP,
  type GameState,
  type Input,
  MAX_MOVE,
  PADDLE_W,
  PADDLE_Y,
  Rng,
} from "../src/index";

export interface BotOptions {
  /** 0 to 100. */
  skill: number;
  /** Seed for the bot's own decisions (separate from the match seed). */
  seed: number;
}

export type Bot = (state: GameState) => Input;

/** Where the ball's center will be (in 1/256 px) when it reaches the paddle, ignoring bricks. */
function predictLandingX(state: GameState): number {
  const half = (BALL_SIZE / 2) * FP;
  const centerX = state.ballX + half;
  if (state.ballVY <= 0) return centerX;
  const distance = (PADDLE_Y - BALL_SIZE) * FP - state.ballY;
  const frames = Math.max(0, Math.floor(distance / state.ballVY));
  // Fold the straight-line path back into the field to account for wall bounces.
  const span = (FIELD_W - BALL_SIZE) * FP;
  let p = (centerX - half + state.ballVX * frames) % (2 * span);
  if (p < 0) p += 2 * span;
  if (p > span) p = 2 * span - p;
  return p + half;
}

export function createBot({ skill, seed }: BotOptions): Bot {
  const rng = new Rng(seed);
  const reactEvery = 1 + Math.floor(((100 - skill) * 10) / 100);
  const maxError = Math.floor((100 - skill) / 3) + 1;

  let move = 0;
  let action = false;
  let aim = 0;
  let error = 0;
  let serveDelay = 0;
  let lastRally = -1;
  let wasHeld = false;

  return (state) => {
    // Pick a new aim point each time the ball comes off the paddle or is served.
    if (state.ballHeld && !wasHeld) {
      serveDelay = rng.int(50);
      aim = rng.range(-12, 12);
    }
    if (state.rallyHits !== lastRally) {
      lastRally = state.rallyHits;
      aim = rng.range(-(PADDLE_W / 2 - 3), PADDLE_W / 2 - 3);
      error = rng.range(-maxError, maxError);
    }
    wasHeld = state.ballHeld;

    if (state.frame % reactEvery !== 0) return { move, action };

    const paddleCenter = state.paddleX + PADDLE_W / 2;
    let target: number;
    if (state.ballHeld) {
      target = FIELD_W / 2 + aim;
      action = state.serveLock === 0 && state.heldFrames >= serveDelay;
    } else {
      action = false;
      const usePrediction = state.ballVY > 0 && rng.int(100) < skill + 10;
      const ballX = usePrediction ? predictLandingX(state) : state.ballX + (BALL_SIZE / 2) * FP;
      target = Math.floor(ballX / FP) - aim + error;
    }

    const diff = target - paddleCenter;
    move = Math.max(-MAX_MOVE, Math.min(MAX_MOVE, Math.trunc(diff / reactEvery)));
    return { move, action };
  };
}
