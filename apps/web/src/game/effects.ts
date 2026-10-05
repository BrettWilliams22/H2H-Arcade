// Cosmetic effects: particles, score pop-ups, screen shake, the ball's trail.
//
// These run on real time and never feed back into the game, so they can't
// affect scores. They read the events each game frame produces.

import { BrickType, type GameState, GameEventType, brickRect, BALL_SIZE, FP, PADDLE_Y } from "@h2h/game";
import { brickColor } from "./palette";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface Banner {
  text: string;
  life: number;
}

const TRAIL_LENGTH = 6;

/** A tiny deterministic jitter so effects look random without Math.random. */
function jitter(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export class Effects {
  particles: Particle[] = [];
  popups: Popup[] = [];
  banner: Banner | null = null;
  trail: { x: number; y: number }[] = [];
  shake = 0;
  flash = 0;
  flashColor = "#ffffff";
  /** Brick types as they were before the last game frame (for effects and sounds of broken bricks). */
  bricksBefore: number[] = [];
  /**
   * Paddle and ball positions before the last game frame, so drawing can move
   * smoothly between frames on screens faster than 60 Hz. Cosmetic only.
   */
  prev = { paddleX: 0, ballX: 0, ballY: 0 };
  /** True if the ball jumped (lost, or put back on the paddle) in the last frame, so it shouldn't be smoothed. */
  ballJumped = true;
  private wasHeld = true;
  private counter = 0;

  /** Call before each game frame, so broken bricks' types are still known afterwards. */
  beforeStep(state: GameState): void {
    this.bricksBefore = state.bricks.slice();
    this.prev = { paddleX: state.paddleX, ballX: state.ballX, ballY: state.ballY };
    this.wasHeld = state.ballHeld;
  }

  /** Call when time passes without a game frame (countdown, pause, seeking), so nothing is smoothed. */
  settle(state: GameState): void {
    this.prev = { paddleX: state.paddleX, ballX: state.ballX, ballY: state.ballY };
    this.ballJumped = false;
  }

  /** Call after each game frame. */
  afterStep(state: GameState): void {
    this.ballJumped = state.ballHeld && !this.wasHeld;
    for (const event of state.events) {
      switch (event.type) {
        case GameEventType.BrickBroken: {
          const type = this.bricksBefore[event.index] ?? BrickType.Basic;
          const rect = brickRect(event.index);
          this.burst(rect.x + rect.w / 2, rect.y + rect.h / 2, brickColor(type, rect.row), 10);
          this.popups.push({
            x: rect.x + rect.w / 2,
            y: rect.y,
            text: `+${event.value}`,
            life: 700,
            color: type === BrickType.Gold ? "#ffd23f" : "#ffffff",
          });
          break;
        }
        case GameEventType.BrickHit: {
          const rect = brickRect(event.index);
          this.burst(rect.x + rect.w / 2, rect.y + rect.h, "#cfd6ff", 4);
          break;
        }
        case GameEventType.Explosion: {
          const rect = brickRect(event.index);
          this.burst(rect.x + rect.w / 2, rect.y + rect.h / 2, "#ff4d5e", 26, 2.2);
          this.shake = Math.max(this.shake, 4);
          this.flash = 0.35;
          this.flashColor = "#ff8a65";
          break;
        }
        case GameEventType.BallLost:
          this.shake = Math.max(this.shake, 3);
          this.flash = 0.3;
          this.flashColor = "#ff2e4d";
          this.trail = [];
          break;
        case GameEventType.WaveCleared:
          this.banner = { text: `WAVE ${state.wave}`, life: 1400 };
          this.popups.push({ x: 120, y: 170, text: `CLEAR +${event.value}`, life: 1200, color: "#9be564" });
          this.flash = 0.25;
          this.flashColor = "#9be564";
          break;
        case GameEventType.PaddleHit:
          this.burst((state.ballX + (BALL_SIZE / 2) * FP) / FP, PADDLE_Y, "#c792ff", 4, 0.8);
          break;
      }
    }

    if (state.ballHeld) {
      this.trail = [];
    } else {
      this.trail.push({ x: state.ballX / FP, y: state.ballY / FP });
      if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
    }
  }

  /** Advances the effects by real time. */
  update(ms: number): void {
    const dt = ms / 16.67;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.08 * dt;
      p.life -= ms;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.y -= 0.35 * dt;
      p.life -= ms;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    if (this.banner) {
      this.banner.life -= ms;
      if (this.banner.life <= 0) this.banner = null;
    }
    this.shake = Math.max(0, this.shake - 0.25 * dt);
    this.flash = Math.max(0, this.flash - 0.02 * dt);
  }

  clear(): void {
    this.particles = [];
    this.popups = [];
    this.banner = null;
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
  }

  private burst(x: number, y: number, color: string, count: number, power = 1.4): void {
    for (let i = 0; i < count; i++) {
      const a = jitter(++this.counter) * Math.PI * 2;
      const speed = (0.4 + jitter(++this.counter)) * power;
      const life = 300 + jitter(++this.counter) * 400;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 0.6,
        life,
        maxLife: life,
        size: jitter(++this.counter) < 0.5 ? 2 : 1,
        color,
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }
}
