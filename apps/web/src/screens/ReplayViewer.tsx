import { FPS, MATCH_FRAMES, type Replay, ReplayPlayer } from "@h2h/game";
import { useEffect, useRef, useState } from "react";
import { Effects } from "../game/effects";
import { FixedLoop } from "../game/loop";
import { drawFrame } from "../game/renderer";
import { sound } from "../game/sound";
import { type CanvasView, FittedCanvas } from "../ui/FittedCanvas";

const SPEEDS = [1, 2, 4];
const MATCH_SECONDS = MATCH_FRAMES / FPS;

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface Props {
  replay: Replay;
  title: string;
  onBack: () => void;
}

/** Plays back a recording through the same game code, with pause, speed and seek. */
export function ReplayViewer({ replay, title, onBack }: Props) {
  const view = useRef<CanvasView | null>(null);
  const control = useRef<{ seek: (frame: number) => void; redraw: () => void } | null>(null);
  const settings = useRef({ speed: 1, paused: false });
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let player = new ReplayPlayer(replay);
    const fx = new Effects();
    fx.settle(player.state);
    let time = 0;
    let lastAlpha = 1;
    let shownFrame = -1;

    const step = (): boolean => {
      const { speed: n, paused: isPaused } = settings.current;
      if (isPaused || player.done) {
        fx.settle(player.state);
      } else {
        for (let i = 0; i < n && !player.done; i++) {
          fx.beforeStep(player.state);
          player.advance();
          fx.afterStep(player.state);
          if (n === 1) sound.play(player.state, fx.bricksBefore);
        }
      }
      if (player.done && !settings.current.paused) {
        settings.current.paused = true;
        setPaused(true);
      }
      return true;
    };

    const draw = (ms: number, alpha: number) => {
      time += ms;
      lastAlpha = alpha;
      fx.update(ms);
      const v = view.current;
      const s = player.state;
      if (v) {
        const tag = `REPLAY ${settings.current.speed}x${settings.current.paused ? "  PAUSED" : ""}`;
        const center = player.done ? "TIME!" : null;
        drawFrame(v.ctx, v.scale, s, fx, { countdown: null, hint: null, center, tag }, time, alpha);
      }
      if (Math.abs(s.frame - shownFrame) >= 15 || (player.done && shownFrame !== s.frame)) {
        shownFrame = s.frame;
        setFrame(s.frame);
      }
    };

    control.current = {
      seek: (target) => {
        player = new ReplayPlayer(replay);
        while (!player.done && player.state.frame < target) player.advance();
        fx.clear();
        fx.settle(player.state);
        shownFrame = player.state.frame;
        setFrame(player.state.frame);
      },
      redraw: () => draw(0, lastAlpha),
    };

    const loop = new FixedLoop(step, draw);
    loop.start();
    return () => {
      loop.stop();
      control.current = null;
    };
  }, [replay]);

  const togglePause = () => {
    if (settings.current.paused && frame >= MATCH_FRAMES) control.current?.seek(0);
    settings.current.paused = !settings.current.paused;
    setPaused(settings.current.paused);
  };

  const changeSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(settings.current.speed) + 1) % SPEEDS.length];
    settings.current.speed = next;
    setSpeed(next);
  };

  const seconds = Math.floor(frame / FPS);

  return (
    <div className="screen play-screen">
      <div className="play-bar">
        <button type="button" className="chip" onClick={onBack} aria-label="Back">
          ◀ BACK
        </button>
        <span className="play-label">{title}</span>
      </div>
      <div className="play-surface">
        <FittedCanvas view={view} label="Replay of a Brickstorm game" onResize={() => control.current?.redraw()} />
      </div>
      <div className="replay-controls">
        <input
          type="range"
          min={0}
          max={MATCH_FRAMES}
          step={FPS}
          value={frame}
          aria-label="Replay position"
          aria-valuetext={`${mmss(seconds)} of ${mmss(MATCH_SECONDS)}`}
          onChange={(e) => control.current?.seek(Number(e.target.value))}
        />
        <div className="replay-buttons">
          <button type="button" className="chip" onClick={togglePause} aria-label={paused ? "Play" : "Pause"}>
            {paused ? "▶ PLAY" : "II PAUSE"}
          </button>
          <span className="replay-time" aria-hidden="true">
            {mmss(seconds)} / {mmss(MATCH_SECONDS)}
          </span>
          <button type="button" className="chip" onClick={changeSpeed} aria-label={`Speed ${speed}x`}>
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}
