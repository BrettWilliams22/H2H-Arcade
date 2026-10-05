import type { GameState } from "./game";

/**
 * A fingerprint of the whole game state. If two runs of the same replay give
 * the same score but different fingerprints, something is not deterministic.
 */
export function hashState(state: GameState): number {
  let h = 0x811c9dc5;
  const mix = (value: number): void => {
    h = Math.imul(h ^ (value | 0), 0x01000193);
  };

  mix(state.seed);
  mix(state.frame);
  mix(state.score);
  mix(state.wave);
  mix(state.paddleX);
  mix(state.ballX);
  mix(state.ballY);
  mix(state.ballVX);
  mix(state.ballVY);
  mix(state.ballHeld ? 1 : 0);
  mix(state.heldFrames);
  mix(state.serveLock);
  mix(state.bricksLeft);
  mix(state.streak);
  mix(state.rallyHits);
  for (const type of state.bricks) mix(type);
  for (const hp of state.brickHp) mix(hp);
  const s = state.stats;
  mix(s.bricksBroken);
  mix(s.ballsLost);
  mix(s.wavesCleared);
  mix(s.paddleHits);
  mix(s.maxStreak);
  mix(s.serves);

  return h >>> 0;
}
