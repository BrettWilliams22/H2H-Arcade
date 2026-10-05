import { FPS, GameSession, type Replay, type ReplayResult } from "@h2h/game";
import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect, useRef, useState } from "react";
import { Controls, inputFor } from "../game/controls";
import { Effects } from "../game/effects";
import { FixedLoop } from "../game/loop";
import { type Overlay, drawFrame } from "../game/renderer";
import { sound } from "../game/sound";
import type { GameSetup } from "../setup";
import { type CanvasView, FittedCanvas } from "../ui/FittedCanvas";

/** "3, 2, 1" (one second each), then "GO!" for half a second. */
const COUNTDOWN_FRAMES = 3 * FPS + FPS / 2;
const GO_FRAMES = FPS / 2;
/** How long "TIME!" stays up before the results screen. */
const END_FRAMES = Math.round(FPS * 1.25);

type Phase = "countdown" | "playing" | "ending";

interface Props {
  setup: GameSetup;
  onFinish: (replay: Replay, result: ReplayResult) => void;
  onQuit: () => void;
  /** Set by this screen: what the phone's Back button should do here (pause). */
  backHandler: RefObject<(() => void) | null>;
}

/** Keeps Tab inside the pause dialog. */
function trapFocus(e: ReactKeyboardEvent<HTMLDivElement>): void {
  if (e.key !== "Tab") return;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
  if (buttons.length === 0) return;
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function Play({ setup, onFinish, onQuit, backHandler }: Props) {
  const view = useRef<CanvasView | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const pauseChip = useRef<HTMLButtonElement>(null);
  const control = useRef<{ pause: () => void; resume: () => void; redraw: () => void } | null>(null);
  const [paused, setPaused] = useState(false);
  const finish = useRef(onFinish);
  finish.current = onFinish;

  useEffect(() => {
    const area = surface.current;
    if (!area) return;
    const session = new GameSession(setup.seed);
    const fx = new Effects();
    fx.settle(session.state);
    const controls = new Controls(area, () => view.current?.canvas ?? null);
    let phase: Phase = "countdown";
    let countdown = COUNTDOWN_FRAMES;
    let ending = END_FRAMES;
    let isPaused = false;
    let time = 0;
    let lastAlpha = 1;

    // A few numbers on the page for automated browser tests. Updated twice a second.
    const publish = () => {
      const s = session.state;
      area.dataset.frame = String(s.frame);
      area.dataset.score = String(s.score);
      area.dataset.paddle = String(s.paddleX);
      area.dataset.serves = String(s.stats.serves);
      if (session.over) area.dataset.hash = String(session.result().hash);
    };

    const step = (): boolean => {
      if (phase === "playing") {
        fx.beforeStep(session.state);
        session.tick(inputFor(session.state.paddleX, controls.state));
        controls.consumeLatch();
        fx.afterStep(session.state);
        sound.play(session.state, fx.bricksBefore);
        if (session.state.frame % 30 === 0 || session.over) publish();
        if (session.over) phase = "ending";
        return true;
      }

      // No game frame happens during the countdown or the "TIME!" screen.
      controls.consumeLatch();
      fx.settle(session.state);
      if (phase === "countdown") {
        const beforeGo = countdown - GO_FRAMES;
        if (beforeGo > 0 && beforeGo % FPS === 0) sound.beep(false);
        if (beforeGo === 0) sound.beep(true);
        countdown--;
        if (countdown <= 0) phase = "playing";
        return true;
      }
      ending--;
      if (ending > 0) return true;
      finish.current(session.replay(), session.result());
      return false;
    };

    const overlay = (): Overlay => {
      const s = session.state;
      const ready = phase === "playing" && s.ballHeld && s.serveLock === 0;
      return {
        countdown: phase === "countdown" ? Math.ceil((countdown - GO_FRAMES) / FPS) : null,
        hint: ready ? "TAP OR SPACE TO LAUNCH" : null,
        center: phase === "ending" ? "TIME!" : null,
        tag: setup.tag,
      };
    };

    const draw = (ms: number, alpha: number) => {
      time += ms;
      lastAlpha = alpha;
      fx.update(ms);
      const v = view.current;
      if (v) drawFrame(v.ctx, v.scale, session.state, fx, overlay(), time, alpha);
    };

    const loop = new FixedLoop(step, draw);

    const pause = () => {
      if (isPaused || phase === "ending") return;
      isPaused = true;
      loop.stop();
      controls.setEnabled(false);
      setPaused(true);
    };
    const resume = () => {
      if (!isPaused) return;
      isPaused = false;
      controls.setEnabled(true);
      setPaused(false);
      if (phase === "playing") {
        phase = "countdown";
        countdown = COUNTDOWN_FRAMES;
      }
      loop.start();
      pauseChip.current?.focus({ preventScroll: true });
    };
    control.current = { pause, resume, redraw: () => draw(0, lastAlpha) };
    backHandler.current = pause;

    const onVisibility = () => {
      if (document.hidden) pause();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.code !== "Escape" && e.code !== "KeyP")) return;
      e.preventDefault();
      if (isPaused) resume();
      else pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", pause);

    loop.start();
    return () => {
      loop.stop();
      controls.dispose();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", pause);
      control.current = null;
      if (backHandler.current === pause) backHandler.current = null;
    };
  }, [setup, backHandler]);

  return (
    <div className="screen play-screen">
      <div className="play-bar">
        <button
          ref={pauseChip}
          type="button"
          className="chip"
          aria-label="Pause"
          // A tap made while another finger is steering never becomes a "click", so react to the touch itself.
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") control.current?.pause();
          }}
          onClick={() => control.current?.pause()}
        >
          II PAUSE
        </button>
        <span className="play-label">{setup.title}</span>
      </div>
      <div className="play-surface" ref={surface} data-testid="play-surface">
        <FittedCanvas view={view} label="Brickstorm game" onResize={() => control.current?.redraw()} />
        <p className="play-help">Drag anywhere here to move · tap to launch</p>
      </div>
      {paused && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Paused" onKeyDown={trapFocus}>
          <div className="panel">
            <h2>PAUSED</h2>
            <button type="button" className="btn primary" onClick={() => control.current?.resume()} autoFocus>
              RESUME
            </button>
            <button type="button" className="btn" onClick={onQuit}>
              QUIT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
