# Brickstorm — game rules

Brickstorm is an original brick-breaker made for head-to-head score matches.
Both players in a match get the same seed, so they see the same bricks in
every wave. Nothing random happens during play; the only difference between
two players' games is how they play.

All numbers below live in `packages/game/src/constants.ts` and
`packages/game/src/layout.ts`. Changing any of them changes scores, so it needs
a `RULES_VERSION` bump.

## The match

- Every match lasts exactly **90 seconds** (5,400 frames at 60 frames per second).
- The highest score at the end wins. There are no lives; the game never ends early.

## The field and controls

- The field is 240 × 320 pixels (portrait, for phones).
- The paddle is 40 pixels wide and moves up to 8 pixels per frame.
- The ball starts each serve sitting on the paddle. Press launch (or tap) to
  send it. If you're moving when you launch, the ball goes off at an angle in
  that direction; if you're still, it goes nearly straight up. If you wait 2
  seconds, it launches by itself.
- Where the ball hits the paddle sets its new direction: the center sends it
  nearly straight up (10° from vertical), and the edges send it out at up to 60°.
  This is the main skill: aiming.

## Speed

- The ball starts at 4 pixels per frame.
- It speeds up a little with every paddle hit, and each new wave starts faster.
- Top speed is 6 pixels per frame.
- Losing the ball or clearing a wave resets the per-hit speed-up.

## Bricks

| Brick | Looks like (text view) | Hits to break | Points |
|---|---|---|---|
| Basic | `[===]` | 1 | 10 |
| Tough | `[###]` | 2 | 30 |
| Armored | `[@@@]` | 3 | 60 |
| Gold | `[$$$]` | 1 | 150 |
| Bomb | `[***]` | 1 | 20, and destroys all 8 bricks around it (bombs can chain) |

Bricks destroyed by a bomb also score their full points.

## Scoring

- **Multiplier.** Every 8 bricks you break in a row without losing the ball adds
  +1 to your multiplier, up to ×5. All brick points are multiplied by it.
- **Losing the ball** resets the multiplier to ×1 and puts the ball back on
  the paddle. You can't launch for half a second, so it also costs time.
- **Clearing a wave** scores a bonus of 250 × the wave number, and the next
  wave appears after a short pause (¾ of a second before you can launch).

## Waves

- Wave 1 has 4 rows of bricks, and each wave adds a row, up to 9 rows.
- Later waves have more Tough and Armored bricks.
- Every layout is mirrored left to right.
- Gold and Bomb bricks are scattered in by the seed.
- Each wave's layout depends only on the match seed and the wave number. A
  player who reaches wave 3 faster sees the same wave 3 as their opponent.
