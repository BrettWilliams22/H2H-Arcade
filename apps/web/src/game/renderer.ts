// Draws the game. Only reads the game state; never changes it.

import {
  BALL_SIZE,
  BrickType,
  FIELD_H,
  FIELD_W,
  FP,
  FPS,
  type GameState,
  PADDLE_H,
  PADDLE_W,
  PADDLE_Y,
  brickRect,
  framesLeft,
  multiplier,
} from "@h2h/game";
import type { Effects } from "./effects";
import { COLORS, brickColor, shade } from "./palette";

export const HUD_H = 26;
export const VIEW_W = FIELD_W;
export const VIEW_H = FIELD_H + HUD_H;
export const FONT = '"Press Start 2P", ui-monospace, monospace';

export interface Overlay {
  /** Seconds left in the countdown (0 shows "GO!"), or null. */
  countdown: number | null;
  /** Small blinking hint near the bottom, or null. */
  hint: string | null;
  /** Big text in the middle of the field, or null. */
  center: string | null;
  /** Small tag in the top-left corner of the field, or null. */
  tag: string | null;
}

export const NO_OVERLAY: Overlay = { countdown: null, hint: null, center: null, tag: null };

const MULT_COLORS = ["", COLORS.dim, "#3ee0d0", "#9be564", "#ff9f43", "#ff7ac8"];

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText(value, x + size / 8, y + size / 8);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function clock(state: GameState): string {
  const seconds = Math.ceil(framesLeft(state) / FPS);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, HUD_H - 1, VIEW_W, 1);

  text(ctx, "SCORE", 5, 10, 5, COLORS.dim);
  text(ctx, String(state.score).padStart(6, "0"), 5, 21, 8, COLORS.text);

  const mult = multiplier(state);
  text(ctx, "MULT", 100, 10, 5, COLORS.dim, "center");
  text(ctx, `x${mult}`, 100, 21, 8, MULT_COLORS[mult], "center");

  text(ctx, "WAVE", 150, 10, 5, COLORS.dim, "center");
  text(ctx, String(state.wave), 150, 21, 8, COLORS.text, "center");

  const left = framesLeft(state);
  const urgent = left > 0 && left <= 10 * FPS;
  const blinkOff = urgent && Math.floor(time / 250) % 2 === 1;
  text(ctx, "TIME", 235, 10, 5, COLORS.dim, "right");
  text(ctx, clock(state), 235, 21, 8, urgent ? (blinkOff ? "#ff9aa6" : "#ff4d5e") : COLORS.text, "right");
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  g.addColorStop(0, COLORS.background);
  g.addColorStop(1, COLORS.backgroundLow);
  ctx.fillStyle = g;
  // A little extra around the edges so screen shake never shows a gap.
  ctx.fillRect(-8, -8, FIELD_W + 16, FIELD_H + 16);
  ctx.fillStyle = COLORS.grid;
  for (let x = 0; x < FIELD_W; x += 12) ctx.fillRect(x, 0, 1, FIELD_H);
  for (let y = 0; y < FIELD_H; y += 12) ctx.fillRect(0, y, FIELD_W, 1);
}

function drawCrack(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
  ctx.fillStyle = "rgba(10,10,30,0.65)";
  const offset = variant === 0 ? 6 : 14;
  ctx.fillRect(x + offset, y + 1, 1, 3);
  ctx.fillRect(x + offset + 1, y + 4, 1, 2);
  ctx.fillRect(x + offset, y + 6, 1, 3);
}

function drawBrick(ctx: CanvasRenderingContext2D, index: number, type: number, hp: number, time: number): void {
  const { x, y, w, h, row } = brickRect(index);
  const base = brickColor(type, row);

  ctx.fillStyle = shade(base, -0.45);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = base;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = shade(base, 0.45);
  ctx.fillRect(x + 1, y + 1, w - 2, 2);
  ctx.fillStyle = shade(base, -0.25);
  ctx.fillRect(x + 1, y + h - 3, w - 2, 2);

  if (type === BrickType.Tough) {
    ctx.fillStyle = shade(base, -0.35);
    ctx.fillRect(x + 4, y + 4, w - 8, 2);
    if (hp < 2) drawCrack(ctx, x, y, 1);
  } else if (type === BrickType.Armored) {
    ctx.fillStyle = shade(base, 0.6);
    for (const rx of [x + 3, x + w - 5]) ctx.fillRect(rx, y + 4, 2, 2);
    if (hp < 3) drawCrack(ctx, x, y, 0);
    if (hp < 2) drawCrack(ctx, x, y, 1);
  } else if (type === BrickType.Gold) {
    const shine = Math.floor((time / 30) % 60) - 10;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < h - 2; i++) {
      const sx = x + shine - i;
      if (sx >= x + 1 && sx < x + w - 2) ctx.fillRect(sx, y + 1 + i, 2, 1);
    }
  } else if (type === BrickType.Bomb) {
    ctx.fillStyle = "#2a0710";
    ctx.fillRect(x + 8, y + 3, 6, 5);
    ctx.fillRect(x + 9, y + 2, 4, 7);
    ctx.fillStyle = Math.floor(time / 180) % 2 === 0 ? "#ffd23f" : "#ffffff";
    ctx.fillRect(x + 13, y + 1, 2, 2);
  }
}

function drawPaddle(ctx: CanvasRenderingContext2D, state: GameState): void {
  const x = state.paddleX;
  ctx.fillStyle = "rgba(199,146,255,0.18)";
  ctx.fillRect(x - 2, PADDLE_Y - 2, PADDLE_W + 4, PADDLE_H + 4);
  ctx.fillStyle = shade(COLORS.paddle, -0.4);
  ctx.fillRect(x, PADDLE_Y, PADDLE_W, PADDLE_H);
  ctx.fillStyle = COLORS.paddle;
  ctx.fillRect(x + 1, PADDLE_Y, PADDLE_W - 2, PADDLE_H - 1);
  ctx.fillStyle = COLORS.paddleLight;
  ctx.fillRect(x + 2, PADDLE_Y + 1, PADDLE_W - 4, 1);
  ctx.fillStyle = shade(COLORS.paddle, -0.2);
  ctx.fillRect(x + PADDLE_W / 2 - 1, PADDLE_Y + 2, 2, 2);
}

function drawBall(ctx: CanvasRenderingContext2D, state: GameState, fx: Effects): void {
  fx.trail.forEach((p, i) => {
    const alpha = ((i + 1) / (fx.trail.length + 1)) * 0.35;
    ctx.fillStyle = `rgba(160,220,255,${alpha})`;
    ctx.fillRect(p.x, p.y, BALL_SIZE, BALL_SIZE);
  });
  const x = state.ballX / FP;
  const y = state.ballY / FP;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x - 1, y - 1, BALL_SIZE + 2, BALL_SIZE + 2);
  ctx.fillStyle = COLORS.ball;
  ctx.fillRect(x, y, BALL_SIZE, BALL_SIZE);
}

function drawEffects(ctx: CanvasRenderingContext2D, fx: Effects): void {
  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const p of fx.popups) {
    ctx.globalAlpha = Math.min(1, p.life / 300);
    text(ctx, p.text, p.x, p.y, 5, p.color, "center");
  }
  ctx.globalAlpha = 1;
}

function drawOverlay(ctx: CanvasRenderingContext2D, fx: Effects, overlay: Overlay, time: number): void {
  if (fx.banner) {
    ctx.globalAlpha = Math.min(1, fx.banner.life / 300);
    ctx.fillStyle = "rgba(11,13,31,0.6)";
    ctx.fillRect(0, 186, FIELD_W, 26);
    text(ctx, fx.banner.text, FIELD_W / 2, 204, 10, "#9be564", "center");
    ctx.globalAlpha = 1;
  }
  if (overlay.tag) text(ctx, overlay.tag, 4, FIELD_H - 6, 5, COLORS.dim);
  if (overlay.hint && Math.floor(time / 500) % 2 === 0) {
    text(ctx, overlay.hint, FIELD_W / 2, 270, 6, COLORS.text, "center");
  }
  if (overlay.countdown !== null) {
    ctx.fillStyle = "rgba(11,13,31,0.45)";
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    text(ctx, overlay.countdown > 0 ? String(overlay.countdown) : "GO!", FIELD_W / 2, 200, 24, "#ffd23f", "center");
  }
  if (overlay.center) {
    ctx.fillStyle = "rgba(11,13,31,0.55)";
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    text(ctx, overlay.center, FIELD_W / 2, 200, 16, "#ffd23f", "center");
  }
}

/** Draws one complete picture. `scale` is device pixels per game pixel; `time` is real milliseconds. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  scale: number,
  state: GameState,
  fx: Effects,
  overlay: Overlay,
  time: number,
): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawHud(ctx, state, time);

  const shakeX = fx.shake > 0 ? Math.round(Math.sin(time * 0.09) * fx.shake) : 0;
  const shakeY = fx.shake > 0 ? Math.round(Math.cos(time * 0.11) * fx.shake) : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_H, FIELD_W, FIELD_H);
  ctx.clip();
  ctx.translate(shakeX, HUD_H + shakeY);

  drawBackground(ctx);
  state.bricks.forEach((type, i) => {
    if (type !== BrickType.None) drawBrick(ctx, i, type, state.brickHp[i], time);
  });
  drawPaddle(ctx, state);
  drawBall(ctx, state, fx);
  drawEffects(ctx, fx);
  drawOverlay(ctx, fx, overlay, time);

  if (fx.flash > 0) {
    ctx.globalAlpha = fx.flash;
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(-8, -8, FIELD_W + 16, FIELD_H + 16);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
