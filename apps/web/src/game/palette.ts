import { BrickType } from "@h2h/game";

/** Basic bricks get a color by row, so layouts read as bands. */
const ROW_COLORS = ["#3ee0d0", "#4fb3ff", "#7a8cff", "#c792ff", "#ff7ac8", "#ff8a65", "#ffd166", "#9be564", "#3ee0d0"];

export const COLORS = {
  background: "#0b0d1f",
  backgroundLow: "#161c40",
  grid: "rgba(255,255,255,0.035)",
  hud: "#0f1230",
  text: "#e8ecff",
  dim: "#8b93c7",
  paddle: "#c792ff",
  paddleLight: "#ead6ff",
  ball: "#ffffff",
  tough: "#ff9f43",
  armored: "#8a94b8",
  gold: "#ffd23f",
  bomb: "#ff4d5e",
};

export function brickColor(type: number, row: number): string {
  switch (type) {
    case BrickType.Tough:
      return COLORS.tough;
    case BrickType.Armored:
      return COLORS.armored;
    case BrickType.Gold:
      return COLORS.gold;
    case BrickType.Bomb:
      return COLORS.bomb;
    default:
      return ROW_COLORS[row % ROW_COLORS.length];
  }
}

/** Mixes a #rrggbb color toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}
