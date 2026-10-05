import { GameSession, type Replay, type ReplayResult, deriveSeed } from "../src/index";
import { createBot } from "./bot";

export interface BotGame {
  seed: number;
  skill: number;
  replay: Replay;
  /** The result the live game reached, before any replaying. */
  live: ReplayResult;
}

/** One line of expected.json, written by `npm run simulate` and checked by `npm run verify`. */
export interface ExpectedEntry {
  file: string;
  seed: number;
  skill: number;
  score: number;
  hash: number;
}

/** Plays one full match with a bot, recording it like the browser will. */
export function playBotGame(seed: number, skill: number, botSeed = deriveSeed(seed, 0xb07)): BotGame {
  const session = new GameSession(seed);
  const bot = createBot({ skill, seed: botSeed });
  while (!session.over) session.tick(bot(session.state));
  return { seed: session.state.seed, skill, replay: session.replay(), live: session.result() };
}

/** The settings for game number i in a batch: varied seeds and skill levels. */
export function batchGame(batchSeed: number, i: number): { seed: number; skill: number } {
  return { seed: deriveSeed(batchSeed, i), skill: (i * 37) % 101 };
}
