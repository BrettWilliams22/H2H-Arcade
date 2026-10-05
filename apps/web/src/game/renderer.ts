// Draws the game. Only reads the game state; never changes it.
//
// Everything is drawn in game pixels, then snapped to whole screen pixels, so
// edges stay sharp at any screen size.

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
  /** Small tag in the bottom-left corner of the field, or null. */
  tag: string | null;
}

export const NO_OVERLAY: Overlay = { countdown: null, hint: null, center: null, tag: null };

const MULT_COLORS = ["", COLORS.dim, "#3ee0d0", "#9be564", "#ff9f43", "#ff7ac8"];

const reducedMotionQuery =
  typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

/** True when the player has asked their device for less motion: no shaking, softer flashes, no blinking. */
export function reducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false;
}

/** Draws in game pixels, snapped to whole screen pixels. */
class Painter {
  /** Offset added to every position, in game pixels. */
  ox = 0;
  oy = 0;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly scale: number,
  ) {}

  private snap(v: number): number {
    return Math.round(v * this.scale);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    const x0 = this.snap(x + this.ox);
    const y0 = this.snap(y + this.oy);
    const x1 = this.snap(x + w + this.ox);
    const y1 = this.snap(y + h + this.oy);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  }

  text(value: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left"): void {
    const ctx = this.ctx;
    const px = Math.max(1, Math.round(size * this.scale));
    const shadow = Math.max(1, Math.round(px / 8));
    ctx.font = `${px}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    const sx = this.snap(x + this.ox);
    const sy = this.snap(y + this.oy);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(value, sx + shadow, sy + shadow);
    ctx.fillStyle = color;
    ctx.fillText(value, sx, sy);
  }

  alpha(a: number): void {
    this.ctx.globalAlpha = a;
  }
}

function clock(state: GameState): string {
  const seconds = Math.ceil(framesLeft(state) / FPS);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function drawHud(p: Painter, state: GameState, time: number, calm: boolean): void {
  p.rect(0, 0, VIEW_W, HUD_H, COLORS.hud);
  p.rect(0, HUD_H - 1, VIEW_W, 1, "rgba(255,255,255,0.08)");

  p.text("SCORE", 5, 10, 6, COLORS.dim);
  p.text(String(state.score).padStart(6, "0"), 5, 21, 8, COLORS.text);

  const mult = multiplier(state);
  p.text("MULT", 100, 10, 6, COLORS.dim, "center");
  p.text(`x${mult}`, 100, 21, 8, MULT_COLORS[mult], "center");

  p.text("WAVE", 150, 10, 6, COLORS.dim, "center");
  p.text(String(state.wave), 150, 21, 8, COLORS.text, "center");

  const left = framesLeft(state);
  const urgent = left > 0 && left <= 10 * FPS;
  const blinkOff = urgent && !calm && Math.floor(time / 250) % 2 === 1;
  p.text("TIME", 235, 10, 6, COLORS.dim, "right");
  p.text(clock(state), 235, 21, 8, urgent ? (blinkOff ? "#ff9aa6" : "#ff4d5e") : COLORS.text, "right");
}

function drawBackground(p: Painter): void {
  const ctx = p.ctx;
  const g = ctx.createLinearGradient(0, p.oy * p.scale, 0, (p.oy + FIELD_H) * p.scale);
  g.addColorStop(0, COLORS.background);
  g.addColorStop(1, COLORS.backgroundLow);
  // A little extra around the edges so screen shake never shows a gap.
  ctx.fillStyle = g;
  ctx.fillRect(Math.round((p.ox - 8) * p.scale), Math.round((p.oy - 8) * p.scale), Math.ceil((FIELD_W + 16) * p.scale), Math.ceil((FIELD_H + 16) * p.scale));
  for (let x = 0; x < FIELD_W; x += 12) p.rect(x, 0, 1, FIELD_H, COLORS.grid);
  for (let y = 0; y < FIELD_H; y += 12) p.rect(0, y, FIELD_W, 1, COLORS.grid);
}

function drawCrack(p: Painter, x: number, y: number, variant: number): void {
  const color = "rgba(10,10,30,0.65)";
  const offset = variant === 0 ? 6 : 14;
  p.rect(x + offset, y + 1, 1, 3, color);
  p.rect(x + offset + 1, y + 4, 1, 2, color);
  p.rect(x + offset, y + 6, 1, 3, color);
}

function drawBrick(p: Painter, index: number, type: number, hp: number, time: number, calm: boolean): void {
  const { x, y, w, h, row } = brickRect(index);
  const base = brickColor(type, row);

  p.rect(x, y, w, h, shade(base, -0.45));
  p.rect(x + 1, y + 1, w - 2, h - 2, base);
  p.rect(x + 1, y + 1, w - 2, 2, shade(base, 0.45));
  p.rect(x + 1, y + h - 3, w - 2, 2, shade(base, -0.25));

  if (type === BrickType.Tough) {
    p.rect(x + 4, y + 4, w - 8, 2, shade(base, -0.35));
    if (hp < 2) drawCrack(p, x, y, 1);
  } else if (type === BrickType.Armored) {
    for (const rx of [x + 3, x + w - 5]) p.rect(rx, y + 4, 2, 2, shade(base, 0.6));
    if (hp < 3) drawCrack(p, x, y, 0);
    if (hp < 2) drawCrack(p, x, y, 1);
  } else if (type === BrickType.Gold) {
    // A white frame and a diamond in the middle, always visible, so gold stands out even without color.
    p.rect(x, y, w, 1, "#ffffff");
    p.rect(x, y + h - 1, w, 1, "#fff3b0");
    p.rect(x + 10, y + 3, 2, 4, "#ffffff");
    p.rect(x + 9, y + 4, 4, 2, "#ffffff");
    if (!calm) {
      const shine = Math.floor((time / 30) % 60) - 10;
      for (let i = 0; i < h - 2; i++) {
        const sx = x + shine - i;
        if (sx >= x + 1 && sx < x + w - 2) p.rect(sx, y + 1 + i, 2, 1, "rgba(255,255,255,0.6)");
      }
    }
  } else if (type === BrickType.Bomb) {
    p.rect(x + 8, y + 3, 6, 5, "#2a0710");
    p.rect(x + 9, y + 2, 4, 7, "#2a0710");
    const spark = calm || Math.floor(time / 180) % 2 === 0 ? "#ffd23f" : "#ffffff";
    p.rect(x + 13, y + 1, 2, 2, spark);
  }
}

function drawPaddle(p: Painter, x: number): void {
  p.rect(x - 2, PADDLE_Y - 2, PADDLE_W + 4, PADDLE_H + 4, "rgba(199,146,255,0.18)");
  p.rect(x, PADDLE_Y, PADDLE_W, PADDLE_H, shade(COLORS.paddle, -0.4));
  p.rect(x + 1, PADDLE_Y, PADDLE_W - 2, PADDLE_H - 1, COLORS.paddle);
  p.rect(x + 2, PADDLE_Y + 1, PADDLE_W - 4, 1, COLORS.paddleLight);
  p.rect(x + PADDLE_W / 2 - 1, PADDLE_Y + 2, 2, 2, shade(COLORS.paddle, -0.2));
}

function drawBall(p: Painter, x: number, y: number, fx: Effects, smoothing: boolean): void {
  // While the ball is drawn between frames, the newest trail point is still ahead of it, so leave it out.
  const trail = smoothing ? fx.trail.slice(0, -1) : fx.trail;
  trail.forEach((t, i) => {
    const alpha = ((i + 1) / (trail.length + 1)) * 0.35;
    p.rect(t.x, t.y, BALL_SIZE, BALL_SIZE, `rgba(160,220,255,${alpha})`);
  });
  p.rect(x - 1, y - 1, BALL_SIZE + 2, BALL_SIZE + 2, "rgba(255,255,255,0.25)");
  p.rect(x, y, BALL_SIZE, BALL_SIZE, COLORS.ball);
}

function drawEffects(p: Painter, fx: Effects): void {
  for (const part of fx.particles) {
    p.alpha(Math.max(0, part.life / part.maxLife));
    p.rect(part.x, part.y, part.size, part.size, part.color);
  }
  p.alpha(1);
  for (const pop of fx.popups) {
    p.alpha(Math.min(1, pop.life / 300));
    p.text(pop.text, pop.x, pop.y, 6, pop.color, "center");
  }
  p.alpha(1);
}

function drawOverlay(p: Painter, fx: Effects, overlay: Overlay, time: number, calm: boolean): void {
  if (fx.banner) {
    p.alpha(Math.min(1, fx.banner.life / 300));
    p.rect(0, 186, FIELD_W, 26, "rgba(11,13,31,0.6)");
    p.text(fx.banner.text, FIELD_W / 2, 204, 10, "#9be564", "center");
    p.alpha(1);
  }
  if (overlay.tag) p.text(overlay.tag, 4, FIELD_H - 6, 5, COLORS.dim);
  if (overlay.hint && (calm || Math.floor(time / 500) % 2 === 0)) {
    p.text(overlay.hint, FIELD_W / 2, 270, 6, COLORS.text, "center");
  }
  if (overlay.countdown !== null) {
    p.rect(0, 0, FIELD_W, FIELD_H, "rgba(11,13,31,0.45)");
    p.text(overlay.countdown > 0 ? String(overlay.countdown) : "GO!", FIELD_W / 2, 200, 24, "#ffd23f", "center");
  }
  if (overlay.center) {
    p.rect(0, 0, FIELD_W, FIELD_H, "rgba(11,13,31,0.55)");
    p.text(overlay.center, FIELD_W / 2, 200, 16, "#ffd23f", "center");
  }
}

/**
 * Draws one complete picture.
 * `scale` is screen pixels per game pixel; `time` is real milliseconds;
 * `alpha` (0 to 1) is how far real time is between the last game frame and the
 * next, used to smooth the paddle and ball. It never changes the game.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  scale: number,
  state: GameState,
  fx: Effects,
  overlay: Overlay,
  time: number,
  alpha = 1,
): void {
  const calm = reducedMotion();
  const p = new Painter(ctx, scale);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  drawHud(p, state, time, calm);

  const shake = calm ? 0 : fx.shake;
  ctx.save();
  ctx.beginPath();
  const fieldTop = Math.round(HUD_H * scale);
  ctx.rect(0, fieldTop, ctx.canvas.width, ctx.canvas.height - fieldTop);
  ctx.clip();
  p.ox = shake > 0 ? Math.round(Math.sin(time * 0.09) * shake) : 0;
  p.oy = HUD_H + (shake > 0 ? Math.round(Math.cos(time * 0.11) * shake) : 0);

  drawBackground(p);
  state.bricks.forEach((type, i) => {
    if (type !== BrickType.None) drawBrick(p, i, type, state.brickHp[i], time, calm);
  });

  const lerp = (from: number, to: number) => from + (to - from) * alpha;
  drawPaddle(p, lerp(fx.prev.paddleX, state.paddleX));
  const smooth = !fx.ballJumped;
  const ballX = (smooth ? lerp(fx.prev.ballX, state.ballX) : state.ballX) / FP;
  const ballY = (smooth ? lerp(fx.prev.ballY, state.ballY) : state.ballY) / FP;
  drawBall(p, ballX, ballY, fx, smooth && alpha < 1);
  drawEffects(p, fx);
  drawOverlay(p, fx, overlay, time, calm);

  const flash = calm ? Math.min(fx.flash, 0.1) : fx.flash;
  if (flash > 0) {
    p.alpha(flash);
    p.rect(-8, -8, FIELD_W + 16, FIELD_H + 16, fx.flashColor);
    p.alpha(1);
  }
  ctx.restore();
}
