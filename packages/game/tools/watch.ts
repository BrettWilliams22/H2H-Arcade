// Watch a game as text in the terminal. A rough preview until the browser
// version exists in Milestone 2.
//
//   npm run watch                              a simulated player, new seed each time
//   npm run watch -- --seed 42 --skill 90      a specific seed and skill (0-100)
//   npm run watch -- replays/game-0001.json    a saved recording
//   add --speed 4 to watch 4 times faster
//
// Unlike the game logic, this tool is allowed to use the real clock.

import { readFileSync } from "node:fs";
import {
  BRICK_CELL_H,
  BRICK_CELL_W,
  BRICK_COLS,
  BRICK_LEFT,
  BRICK_TOP,
  BRICK_W,
  BrickType,
  FIELD_H,
  FIELD_W,
  FP,
  FPS,
  type GameState,
  PADDLE_W,
  PADDLE_Y,
  type Replay,
  ReplayPlayer,
  framesLeft,
  multiplier,
  validateReplay,
} from "../src/index";
import { intFlag, parseArgs } from "./args";
import { playBotGame } from "./play";

const PX_PER_COL = 4;
const PX_PER_ROW = 10;
const COLS = FIELD_W / PX_PER_COL;
const ROWS = FIELD_H / PX_PER_ROW;

function brickGlyph(type: number, hp: number): string {
  if (type === BrickType.Gold) return "$";
  if (type === BrickType.Bomb) return "*";
  return ["", "=", "#", "@"][hp];
}

function render(state: GameState): string {
  const grid = Array.from({ length: ROWS }, () => new Array<string>(COLS).fill(" "));

  state.bricks.forEach((type, i) => {
    if (type === BrickType.None) return;
    const row = Math.floor((BRICK_TOP + Math.floor(i / BRICK_COLS) * BRICK_CELL_H) / PX_PER_ROW);
    const x0 = Math.floor(((i % BRICK_COLS) * BRICK_CELL_W + BRICK_LEFT) / PX_PER_COL);
    const width = Math.floor(BRICK_W / PX_PER_COL);
    const fill = brickGlyph(type, state.brickHp[i]);
    for (let c = 0; c < width; c++) grid[row][x0 + c] = c === 0 ? "[" : c === width - 1 ? "]" : fill;
  });

  const paddleRow = Math.floor(PADDLE_Y / PX_PER_ROW);
  for (let x = state.paddleX; x < state.paddleX + PADDLE_W; x += PX_PER_COL) {
    grid[paddleRow][Math.floor(x / PX_PER_COL)] = "=";
  }

  const ballRow = Math.min(ROWS - 1, Math.floor((state.ballY / FP + 2) / PX_PER_ROW));
  const ballCol = Math.min(COLS - 1, Math.floor((state.ballX / FP + 2) / PX_PER_COL));
  grid[ballRow][ballCol] = "O";

  const seconds = Math.ceil(framesLeft(state) / FPS);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const hud = `Score ${state.score}  x${multiplier(state)}  Wave ${state.wave}  Time ${clock}  Lost ${state.stats.ballsLost}`;
  const border = `+${"-".repeat(COLS)}+`;
  return [hud.padEnd(COLS + 2), border, ...grid.map((row) => `|${row.join("")}|`), border].join("\n");
}

function loadReplay(): { replay: Replay; label: string } {
  const { flags, rest } = parseArgs();
  if (rest[0]) {
    const checked = validateReplay(JSON.parse(readFileSync(rest[0], "utf8")));
    if (!checked.ok) {
      console.error(`That recording was rejected: ${checked.error}`);
      process.exit(1);
    }
    return { replay: checked.replay, label: rest[0] };
  }
  const seed = intFlag(flags, "seed", Date.now() % 1_000_000);
  const skill = intFlag(flags, "skill", 80);
  return { replay: playBotGame(seed, skill).replay, label: `seed ${seed}, simulated player skill ${skill}` };
}

const { flags } = parseArgs();
const speed = Math.max(1, intFlag(flags, "speed", 1));
const { replay, label } = loadReplay();
const player = new ReplayPlayer(replay);
const framesPerDraw = 2 * speed;

process.stdout.write("\x1b[2J\x1b[?25l");
const restoreCursor = () => process.stdout.write("\x1b[?25h");
process.on("SIGINT", () => {
  restoreCursor();
  process.exit(0);
});

const timer = setInterval(() => {
  for (let i = 0; i < framesPerDraw; i++) player.advance();
  process.stdout.write(`\x1b[H${render(player.state)}\n${label}   (Ctrl+C to stop)\n`);
  if (player.done) {
    clearInterval(timer);
    restoreCursor();
    const s = player.state.stats;
    console.log(
      `\nFinal score ${player.state.score}. Bricks ${s.bricksBroken}, waves cleared ${s.wavesCleared}, ` +
        `balls lost ${s.ballsLost}, best streak ${s.maxStreak}.`,
    );
  }
}, (1000 * framesPerDraw) / FPS / speed);
