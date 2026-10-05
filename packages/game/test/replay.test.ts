import { describe, expect, it } from "vitest";
import {
  GameSession,
  InputRecorder,
  MATCH_FRAMES,
  MAX_MOVE,
  NO_INPUT,
  RULES_VERSION,
  type Replay,
  runReplay,
  validateReplay,
  verifyMatchReplay,
  verifyReplay,
} from "../src/index";
import { playBotGame } from "../tools/play";

function idleReplay(): Replay {
  const session = new GameSession(123);
  while (!session.over) session.tick(NO_INPUT);
  return session.replay();
}

describe("InputRecorder", () => {
  it("stores only changes in input", () => {
    const recorder = new InputRecorder(1);
    recorder.record(0, { move: 0, action: false });
    recorder.record(1, { move: 3, action: false });
    recorder.record(2, { move: 3, action: false });
    recorder.record(3, { move: 3, action: true });
    recorder.record(4, { move: 0, action: false });
    expect(recorder.toReplay().inputs).toEqual([
      [1, 3, 0],
      [3, 3, 1],
      [4, 0, 0],
    ]);
  });

  it("refuses frames out of order", () => {
    const recorder = new InputRecorder(1);
    recorder.record(0, NO_INPUT);
    expect(() => recorder.record(2, NO_INPUT)).toThrow();
  });
});

describe("validateReplay", () => {
  const good = (): Replay => playBotGame(55, 80).replay;

  it("accepts a real recorded game", () => {
    expect(validateReplay(good()).ok).toBe(true);
    expect(validateReplay(idleReplay()).ok).toBe(true);
  });

  const tampered: [string, (r: Replay) => unknown][] = [
    ["not an object", () => "hello"],
    ["missing field", (r) => ({ ...r, inputs: undefined })],
    ["extra field (like a claimed score)", (r) => ({ ...r, score: 999999 })],
    ["wrong game", (r) => ({ ...r, game: "other" })],
    ["old rules version", (r) => ({ ...r, rules: RULES_VERSION - 1 })],
    ["negative seed", (r) => ({ ...r, seed: -1 })],
    ["fractional seed", (r) => ({ ...r, seed: 1.5 })],
    ["too short", (r) => ({ ...r, frames: MATCH_FRAMES - 1 })],
    ["too long", (r) => ({ ...r, frames: MATCH_FRAMES + 1 })],
    ["inputs not a list", (r) => ({ ...r, inputs: {} })],
    ["input with 2 values", (r) => ({ ...r, inputs: [[5, 1]] })],
    ["move too fast", (r) => ({ ...r, inputs: [[5, MAX_MOVE + 1, 0]] })],
    ["fractional move", (r) => ({ ...r, inputs: [[5, 1.5, 0]] })],
    ["action not 0 or 1", (r) => ({ ...r, inputs: [[5, 1, 2]] })],
    ["frame after the end", (r) => ({ ...r, inputs: [[MATCH_FRAMES, 1, 0]] })],
    ["frames out of order", (r) => ({ ...r, inputs: [[10, 1, 0], [5, 2, 0]] })],
    ["two inputs on one frame", (r) => ({ ...r, inputs: [[5, 1, 0], [5, 2, 0]] })],
    ["input that changes nothing", (r) => ({ ...r, inputs: [[5, 1, 0], [6, 1, 0]] })],
    ["first input that changes nothing", (r) => ({ ...r, inputs: [[5, 0, 0]] })],
    ["more inputs than frames", (r) => ({ ...r, inputs: new Array(MATCH_FRAMES + 1).fill([1, 1, 0]) })],
  ];

  for (const [name, tamper] of tampered) {
    it(`rejects: ${name}`, () => {
      const result = validateReplay(tamper(good()));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    });
  }
});

describe("runReplay", () => {
  it("reproduces the live game's score and final state exactly", () => {
    for (let i = 0; i < 20; i++) {
      const game = playBotGame(1000 + i, (i * 13) % 101);
      const checked = verifyReplay(JSON.parse(JSON.stringify(game.replay)));
      expect(checked.ok).toBe(true);
      if (checked.ok) expect(checked.result).toEqual(game.live);
    }
  });

  it("gives a different result if a single input is changed", () => {
    const game = playBotGame(77, 90);
    const edited = structuredClone(game.replay);
    const at = Math.floor(edited.inputs.length / 2);
    const [prev, middle, next] = [edited.inputs[at - 1], edited.inputs[at], edited.inputs[at + 1]];
    // Pick a new move that still leaves a valid recording (each entry must change something).
    middle[1] = [MAX_MOVE, -MAX_MOVE, 1, -1].find(
      (m) => m !== middle[1] && !(m === prev[1] && middle[2] === prev[2]) && !(m === next[1] && middle[2] === next[2]),
    )!;
    expect(validateReplay(edited).ok).toBe(true);
    expect(runReplay(edited).hash).not.toBe(game.live.hash);
  });

  it("rejects a valid recording made on a different seed than the match's", () => {
    const game = playBotGame(77, 90);
    const same = verifyMatchReplay(game.replay, 77);
    expect(same.ok && same.result.score).toBe(game.live.score);
    const other = verifyMatchReplay(game.replay, 78);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.error).toMatch(/seed/);
  });

  it("refuses to run the match check with an invalid match seed, instead of guessing", () => {
    const game = playBotGame(0, 50);
    for (const bad of [Number.NaN, -1, 1.5, 2 ** 32, 2 ** 32 + 77, Number(undefined)]) {
      expect(() => verifyMatchReplay(game.replay, bad)).toThrow(/invalid match seed/);
    }
  });

  it("gives a different result for a different seed with the same inputs", () => {
    const game = playBotGame(77, 90);
    expect(runReplay({ ...game.replay, seed: 78 }).hash).not.toBe(game.live.hash);
  });
});
