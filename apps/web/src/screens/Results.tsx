import type { Replay, ReplayResult } from "@h2h/game";
import type { GameSetup } from "../setup";

interface Props {
  setup: GameSetup;
  replay: Replay;
  result: ReplayResult;
  isBest: boolean;
  onWatch: () => void;
  onAgain: () => void;
  onNew: () => void;
  onHome: () => void;
}

export function downloadReplay(replay: Replay, score: number): void {
  const blob = new Blob([JSON.stringify(replay)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `brickstorm-${replay.seed}-${score}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Results({ setup, replay, result, isBest, onWatch, onAgain, onNew, onHome }: Props) {
  const { stats } = result;
  return (
    <div className="screen menu-screen">
      <div className="panel results">
        <p className="eyebrow">{setup.title}</p>
        <h2>FINAL SCORE</h2>
        <p className="big-score" data-testid="final-score">
          {result.score}
        </p>
        {isBest && <p className="badge">NEW BEST!</p>}
        <dl className="stats">
          <div>
            <dt>Bricks</dt>
            <dd>{stats.bricksBroken}</dd>
          </div>
          <div>
            <dt>Waves cleared</dt>
            <dd>{stats.wavesCleared}</dd>
          </div>
          <div>
            <dt>Best streak</dt>
            <dd>{stats.maxStreak}</dd>
          </div>
          <div>
            <dt>Balls lost</dt>
            <dd>{stats.ballsLost}</dd>
          </div>
        </dl>
        <div className="actions">
          <button type="button" className="btn primary" onClick={onWatch}>
            WATCH REPLAY
          </button>
          <button type="button" className="btn" onClick={onAgain}>
            SAME LAYOUT AGAIN
          </button>
          {setup.kind === "practice" && (
            <button type="button" className="btn" onClick={onNew}>
              NEW LAYOUT
            </button>
          )}
          <button type="button" className="btn" onClick={() => downloadReplay(replay, result.score)}>
            DOWNLOAD RECORDING
          </button>
          <button type="button" className="btn ghost" onClick={onHome}>
            HOME
          </button>
        </div>
        <p className="fine">
          Seed {replay.seed}. The recording holds only your inputs. Replaying it recomputes this exact score.
        </p>
      </div>
    </div>
  );
}
