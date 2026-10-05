import { FPS } from "@h2h/game";

const STEP_MS = 1000 / FPS;
/** If the browser stalls, catch up at most this many frames at once instead of freezing. */
const MAX_STEPS_PER_DRAW = 8;
/** Screen refresh gaps this close to a common refresh rate are treated as exact, to avoid stutter. */
const SNAP_MS = 0.6;
const SNAP_TO = [STEP_MS / 2, STEP_MS, STEP_MS * 2];

/**
 * Runs `step` exactly 60 times per second of real time, and `draw` once per
 * screen refresh. Real time only decides *when* frames run; the game itself
 * only ever sees whole frames, so timing can't change the score.
 */
export class FixedLoop {
  private handle = 0;
  private last = 0;
  private carry = 0;
  private running = false;

  /**
   * step returns false to stop the loop. draw gets the real milliseconds since
   * the last draw, and how far (0 to 1) real time is between the last game
   * frame and the next, for smooth motion on fast screens.
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
    this.handle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    let elapsed = Math.min(250, Math.max(0, now - this.last));
    this.last = now;
    for (const target of SNAP_TO) {
      if (Math.abs(elapsed - target) < SNAP_MS) elapsed = target;
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

    this.draw(elapsed, Math.min(1, this.carry / STEP_MS));
    if (this.running) this.handle = requestAnimationFrame(this.tick);
  };
}
