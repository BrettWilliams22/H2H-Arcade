// All tuning numbers for Brickstorm live here.
//
// Changing any number that affects play changes scores, so it must come with a
// RULES_VERSION bump. Old replays are tied to the rules version they were played on.

export const GAME_ID = "brickstorm";
export const RULES_VERSION = 1;

// Time. The game always advances in fixed steps of 1/60 of a second ("frames").
export const FPS = 60;
export const MATCH_SECONDS = 90;
export const MATCH_FRAMES = FPS * MATCH_SECONDS;

// Fixed-point math. Positions and speeds are whole numbers measured in
// 1/256ths of a pixel, so the game never needs fractions (which can round
// differently on different devices).
export const FP_SHIFT = 8;
export const FP = 1 << FP_SHIFT;

// Playing field, in pixels. Portrait shape for phones.
export const FIELD_W = 240;
export const FIELD_H = 320;

// Paddle, in whole pixels.
export const PADDLE_W = 40;
export const PADDLE_H = 6;
export const PADDLE_Y = 296;
export const PADDLE_START_X = (FIELD_W - PADDLE_W) / 2;
/** Fastest the paddle can move, in pixels per frame. Inputs are capped to this. */
export const MAX_MOVE = 8;

// Ball. Size in pixels; speeds in 1/256 pixel per frame.
export const BALL_SIZE = 4;
export const BALL_SPEED_START = 1024;
export const BALL_SPEED_PER_WAVE = 64;
export const BALL_SPEED_PER_HIT = 8;
export const BALL_SPEED_MAX = 1536;

// Brick grid, in pixels.
export const BRICK_COLS = 10;
export const BRICK_ROWS = 9;
export const BRICK_CELL_W = 24;
export const BRICK_CELL_H = 12;
export const BRICK_W = 22;
export const BRICK_H = 10;
export const BRICK_LEFT = 1;
export const BRICK_TOP = 40;
export const BRICK_CELLS = BRICK_COLS * BRICK_ROWS;

// Serving.
/** Frames the ball must sit on the paddle after it is lost before it can be launched. */
export const SERVE_LOCK_FRAMES = 30;
/** Same, after a wave is cleared. */
export const WAVE_LOCK_FRAMES = 45;
/** The ball launches by itself after sitting this long. */
export const AUTO_SERVE_FRAMES = 120;

// Scoring.
/** Every this many bricks broken in a row (without losing the ball) adds +1 to the multiplier. */
export const STREAK_PER_MULT = 8;
export const MAX_MULTIPLIER = 5;
/** Bonus for clearing a wave, multiplied by the wave number. */
export const WAVE_CLEAR_BONUS = 250;
