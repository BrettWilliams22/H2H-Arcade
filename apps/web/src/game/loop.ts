import { FPS } from "@h2h/game";

export const STEP_MS = 1000 / FPS;
/** If the browser stalls, catch up at most this many frames at once instead of freezing. */
const MAX_STEPS_PER_DRAW = 8;
/**
 * Screen refresh gaps this close to a common refresh rate are treated as
 * exact, so jitter doesn't make some refreshes run 0 game frames and others 2.
 * (Some browsers, including Safari on iPhone, report times rounded to whole
 * milliseconds, so 60 Hz arrives as gaps of 16 and 17 ms.)
 */
const SNAP_MS = 1;
const SNAP_TO = [STEP_MS / 2, STEP_MS, STEP_MS * 2];
/** Smooth motion between game frames only on screens clearly faster than 60 Hz. */
const SMOOTH_BELOW_MS = STEP_MS * 0.85;

/**
 * Runs `step` exactly 60 times per second of real time, and `draw` once per
 * screen refresh. Real time only decides *when* frames run; the game itself
 * only ever sees whole frames, so timing can't change the score.
 */
export class FixedLoop {
  private handle = 0;
  private last = 0;
  private carry = 0;
  /** Time added or removed by snapping, paid back so the game keeps real time overall. */
  private drift = 0;
  /** Running average of the screen's refresh gap. */
  private refreshMs = STEP_MS;
  private running = false;

  /**
   * step returns false to stop the loop. draw gets the real milliseconds since
   * the last draw, and how far (0 to 1) real time is between the last game
   * frame and the next, for smooth motion on fast screens (always 1 on 60 Hz
   * screens, which need no smoothing).
   */
  constructor(
    private readonly step: () => boolean,
    private readonly draw: (elapsedMs: number, alpha: number) => void,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.carry = 0;
    this.drift = 0;
    this.handle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const raw = Math.min(250, Math.max(0, now - this.last));
    this.last = now;
    this.refreshMs += (raw - this.refreshMs) * 0.1;

    let elapsed = raw;
    for (const target of SNAP_TO) {
      if (Math.abs(raw - target) < SNAP_MS) elapsed = target;
    }
    this.drift += raw - elapsed;
    if (Math.abs(this.drift) >= SNAP_MS) {
      elapsed += this.drift;
      this.drift = 0;
    }
    this.carry += elapsed;

    let steps = 0;
    while (this.carry >= STEP_MS - 1e-6 && steps < MAX_STEPS_PER_DRAW) {
      this.carry = Math.max(0, this.carry - STEP_MS);
      steps++;
      if (!this.step()) {
        this.running = false;
        break;
      }
    }
    if (steps === MAX_STEPS_PER_DRAW) this.carry = Math.min(this.carry, STEP_MS);

    const alpha = this.refreshMs < SMOOTH_BELOW_MS ? Math.min(1, this.carry / STEP_MS) : 1;
    this.draw(raw, alpha);
    if (this.running) this.handle = requestAnimationFrame(this.tick);
  };
}
