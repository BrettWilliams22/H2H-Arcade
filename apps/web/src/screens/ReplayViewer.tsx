import { MATCH_FRAMES, type Replay, ReplayPlayer } from "@h2h/game";
import { useEffect, useRef, useState } from "react";
import { Effects } from "../game/effects";
import { FixedLoop } from "../game/loop";
import { drawFrame } from "../game/renderer";
import { sound } from "../game/sound";
import { type CanvasView, FittedCanvas } from "../ui/FittedCanvas";

const SPEEDS = [1, 2, 4];

interface Props {
  replay: Replay;
  title: string;
  onBack: () => void;
}

/** Plays back a recording through the same game code, with pause, speed and seek. */
export function ReplayViewer({ replay, title, onBack }: Props) {
  const view = useRef<CanvasView | null>(null);
  const control = useRef<{ seek: (frame: number) => void } | null>(null);
  const settings = useRef({ speed: 1, paused: false });
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let player = new ReplayPlayer(replay);
    const fx = new Effects();
    let time = 0;
    let shownFrame = -1;

    const step = (): boolean => {
      const { speed: n, paused: isPaused } = settings.current;
      if (isPaused) return true;
      for (let i = 0; i < n && !player.done; i++) {
        fx.beforeStep(player.state);
        player.advance();
        fx.afterStep(player.state);
        if (n === 1) sound.play(player.state, fx.bricksBefore);
      }
      if (player.done && !settings.current.paused) {
        settings.current.paused = true;
        setPaused(true);
      }
      return true;
    };

    const draw = (ms: number) => {
      time += ms;
      fx.update(ms);
      const v = view.current;
      const s = player.state;
      if (v) {
        const tag = `REPLAY ${settings.current.speed}x${settings.current.paused ? "  PAUSED" : ""}`;
        drawFrame(v.ctx, v.scale, s, fx, { countdown: null, hint: null, center: player.done ? "TIME!" : null, tag }, time);
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
        shownFrame = player.state.frame;
        setFrame(player.state.frame);
      },
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

  const seconds = Math.floor(frame / 60);

  return (
    <div className="screen play-screen">
      <div className="play-bar">
        <button type="button" className="chip" onClick={onBack}>
          ◀ BACK
        </button>
        <span className="play-label">{title}</span>
      </div>
      <div className="play-surface">
        <FittedCanvas view={view} label="Replay of a Brickstorm game" />
      </div>
      <div className="replay-controls">
        <button type="button" className="chip" onClick={togglePause} aria-label={paused ? "Play" : "Pause"}>
          {paused ? "▶ PLAY" : "II PAUSE"}
        </button>
        <input
          type="range"
          min={0}
          max={MATCH_FRAMES}
          step={60}
          value={frame}
          aria-label="Replay position"
          onChange={(e) => control.current?.seek(Number(e.target.value))}
        />
        <span className="replay-time">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
        <button type="button" className="chip" onClick={changeSpeed} aria-label="Change speed">
          {speed}x
        </button>
      </div>
    </div>
  );
}
