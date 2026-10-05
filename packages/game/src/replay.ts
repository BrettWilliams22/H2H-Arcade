// Input recordings ("replays").
//
// The browser never reports a score. It sends a replay: the match seed plus
// every change in the player's input and the frame it happened on. The server
// plays the replay through the same game code and computes the score itself.

import { GAME_ID, MATCH_FRAMES, MAX_MOVE, RULES_VERSION } from "./constants";
import { type GameState, type GameStats, type Input, createGame, isOver, normalizeInput, step } from "./game";
import { hashState } from "./hash";

export const REPLAY_FORMAT = 1;

/** [frame, move, action]: from this frame on, the input is this move and action (1 = held). */
export type InputEvent = [frame: number, move: number, action: 0 | 1];

export interface Replay {
  format: typeof REPLAY_FORMAT;
  game: typeof GAME_ID;
  rules: number;
  seed: number;
  frames: number;
  inputs: InputEvent[];
}

export interface ReplayResult {
  score: number;
  hash: number;
  stats: GameStats;
  wave: number;
}

export type ValidationResult = { ok: true; replay: Replay } | { ok: false; error: string };

/**
 * Records a player's inputs as they play. Only changes are stored, so holding
 * a key for 10 seconds is one entry, not 600.
 */
export class InputRecorder {
  private readonly inputs: InputEvent[] = [];
  private lastMove = 0;
  private lastAction: 0 | 1 = 0;
  private nextFrame = 0;

  constructor(readonly seed: number) {}

  /** Call once per frame, in order, with the exact input passed to step(). */
  record(frame: number, input: Input): void {
    if (frame !== this.nextFrame) {
      throw new Error(`InputRecorder expected frame ${this.nextFrame}, got ${frame}`);
    }
    this.nextFrame++;
    const { move, action } = normalizeInput(input);
    const actionBit = action ? 1 : 0;
    if (move !== this.lastMove || actionBit !== this.lastAction) {
      this.inputs.push([frame, move, actionBit]);
      this.lastMove = move;
      this.lastAction = actionBit;
    }
  }

  toReplay(): Replay {
    return {
      format: REPLAY_FORMAT,
      game: GAME_ID,
      rules: RULES_VERSION,
      seed: this.seed >>> 0,
      frames: this.nextFrame,
      inputs: this.inputs.map((event) => [...event] as InputEvent),
    };
  }
}

const REPLAY_KEYS = ["format", "frames", "game", "inputs", "rules", "seed"];

function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Checks that untrusted data is a well-formed, complete replay for the current
 * rules. Anything our own recorder would never produce is rejected.
 */
export function validateReplay(data: unknown): ValidationResult {
  const fail = (error: string): ValidationResult => ({ ok: false, error });

  if (typeof data !== "object" || data === null || Array.isArray(data)) return fail("replay must be an object");
  const keys = Object.keys(data).sort();
  if (keys.join(",") !== REPLAY_KEYS.join(",")) return fail(`replay must have exactly these fields: ${REPLAY_KEYS.join(", ")}`);

  const r = data as Record<string, unknown>;
  if (r.format !== REPLAY_FORMAT) return fail(`unsupported replay format: ${String(r.format)}`);
  if (r.game !== GAME_ID) return fail(`wrong game: ${String(r.game)}`);
  if (r.rules !== RULES_VERSION) return fail(`replay is for rules version ${String(r.rules)}, current is ${RULES_VERSION}`);
  if (!isWholeNumber(r.seed) || r.seed < 0 || r.seed > 0xffffffff) return fail("seed must be a whole number from 0 to 4294967295");
  if (r.frames !== MATCH_FRAMES) return fail(`replay must be exactly ${MATCH_FRAMES} frames long, got ${String(r.frames)}`);
  if (!Array.isArray(r.inputs)) return fail("inputs must be a list");
  if (r.inputs.length > MATCH_FRAMES) return fail("too many inputs");

  let prevFrame = -1;
  let prevMove = 0;
  let prevAction = 0;
  for (let i = 0; i < r.inputs.length; i++) {
    const event: unknown = r.inputs[i];
    if (!Array.isArray(event) || event.length !== 3) return fail(`input ${i} must be [frame, move, action]`);
    const [frame, move, action] = event as unknown[];
    if (!isWholeNumber(frame) || frame <= prevFrame || frame >= MATCH_FRAMES) {
      return fail(`input ${i} has a bad frame number (must increase and stay below ${MATCH_FRAMES})`);
    }
    if (!isWholeNumber(move) || move < -MAX_MOVE || move > MAX_MOVE) {
      return fail(`input ${i} has a bad move (must be a whole number from ${-MAX_MOVE} to ${MAX_MOVE})`);
    }
    if (action !== 0 && action !== 1) return fail(`input ${i} has a bad action (must be 0 or 1)`);
    if (move === prevMove && action === prevAction) return fail(`input ${i} does not change anything`);
    prevFrame = frame;
    prevMove = move;
    prevAction = action;
  }

  return { ok: true, replay: data as Replay };
}

/**
 * Plays a replay one frame at a time, for watching it. The replay must already
 * have passed validateReplay().
 */
export class ReplayPlayer {
  readonly state: GameState;
  private readonly input: Input = { move: 0, action: false };
  private next = 0;

  constructor(private readonly replay: Replay) {
    this.state = createGame(replay.seed);
  }

  get done(): boolean {
    return isOver(this.state);
  }

  /** Plays one frame. */
  advance(): void {
    if (this.done) return;
    const event = this.replay.inputs[this.next];
    if (event !== undefined && event[0] === this.state.frame) {
      this.input.move = event[1];
      this.input.action = event[2] === 1;
      this.next++;
    }
    step(this.state, this.input);
  }
}

/** Plays a replay from start to finish with no screen. It must already have passed validateReplay(). */
export function runReplay(replay: Replay): ReplayResult {
  const player = new ReplayPlayer(replay);
  while (!player.done) player.advance();
  return resultOf(player.state);
}

/** Validates untrusted replay data, then plays it. This is what the server will run. */
export function verifyReplay(data: unknown): { ok: true; result: ReplayResult } | { ok: false; error: string } {
  const checked = validateReplay(data);
  if (!checked.ok) return checked;
  return { ok: true, result: runReplay(checked.replay) };
}

export function resultOf(state: GameState): ReplayResult {
  return {
    score: state.score,
    hash: hashState(state),
    stats: { ...state.stats },
    wave: state.wave,
  };
}
