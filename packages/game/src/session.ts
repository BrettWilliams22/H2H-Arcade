import { type GameState, type Input, createGame, isOver, normalizeInput, step } from "./game";
import { InputRecorder, type Replay, type ReplayResult, resultOf } from "./replay";

/**
 * A live match: plays and records at the same time. The browser should drive
 * the game only through this class, so what is recorded is exactly what was played.
 */
export class GameSession {
  readonly state: GameState;
  private readonly recorder: InputRecorder;

  constructor(seed: number) {
    this.state = createGame(seed);
    this.recorder = new InputRecorder(this.state.seed);
  }

  get over(): boolean {
    return isOver(this.state);
  }

  /** Records the input and advances one frame. */
  tick(input: Input): void {
    if (this.over) return;
    const clean = normalizeInput(input);
    this.recorder.record(this.state.frame, clean);
    step(this.state, clean);
  }

  replay(): Replay {
    return this.recorder.toReplay();
  }

  result(): ReplayResult {
    return resultOf(this.state);
  }
}
