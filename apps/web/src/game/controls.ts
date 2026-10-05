// Turns keyboard, mouse and touch into the game's Input for each frame.
//
// Keyboard: arrows or A/D move at full speed; Space, Up, W or Enter launches.
// Mouse: the paddle follows the mouse; click launches.
// Touch: drag anywhere on the play area and the paddle follows your finger
// (so your finger doesn't hide the ball); a quick tap launches, and so does
// touching with a second finger. Dragging alone never launches, and a tap
// doesn't move a waiting serve, so touch players can line up a serve just
// like keyboard and mouse players.

import { FIELD_W, FPS, type Input, MAX_MOVE, PADDLE_W } from "@h2h/game";

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const LAUNCH_KEYS = new Set(["Space", "ArrowUp", "KeyW", "Enter"]);
export const GAME_KEYS = new Set([...LEFT_KEYS, ...RIGHT_KEYS, ...LAUNCH_KEYS]);
const META_KEYS = new Set(["MetaLeft", "MetaRight"]);

/** A touch shorter than this, that barely moved, counts as a tap. */
const TAP_MS = 250;
const TAP_SLOP_PX = 12;
/** The same tap time limit, in game frames. */
const TAP_FRAMES = Math.round((TAP_MS * FPS) / 1000);

export interface ControlState {
  left: boolean;
  right: boolean;
  /** A launch key is held. */
  launchKey: boolean;
  /** The mouse button is held. */
  mouseDown: boolean;
  /**
   * A launch press (key, click or tap) that the game hasn't seen yet. It stays
   * set until one game frame has used it, so a very quick tap is never lost.
   */
  launchLatch: boolean;
  /** Where the steering pointer is, in field pixels, or null if no pointer is steering. */
  pointerX: number | null;
  /**
   * The steering touch is new and hasn't moved: it may still turn out to be a
   * tap. While the ball waits on the paddle, such a touch doesn't move the
   * paddle, so tapping to launch never shifts a serve you lined up.
   */
  pointerTentative: boolean;
}

export function idleControls(): ControlState {
  return {
    left: false,
    right: false,
    launchKey: false,
    mouseDown: false,
    launchLatch: false,
    pointerX: null,
    pointerTentative: false,
  };
}

/**
 * How far the paddle should move this frame to follow the controls. Pure, so
 * it can be tested. `ballHeld` is whether the ball is waiting on the paddle.
 */
export function moveFor(paddleX: number, controls: ControlState, ballHeld = false): number {
  if (controls.left !== controls.right) return controls.left ? -MAX_MOVE : MAX_MOVE;
  if (controls.pointerX === null) return 0;
  if (ballHeld && controls.pointerTentative) return 0;
  const diff = Math.round(controls.pointerX - (paddleX + PADDLE_W / 2));
  return Math.max(-MAX_MOVE, Math.min(MAX_MOVE, diff));
}

export function inputFor(paddleX: number, controls: ControlState, ballHeld = false): Input {
  return {
    move: moveFor(paddleX, controls, ballHeld),
    action: controls.launchKey || controls.mouseDown || controls.launchLatch,
  };
}

interface TrackedPointer {
  x: number;
  startX: number;
  startY: number;
  startTime: number;
}

/**
 * Listens to the keyboard and pointer. `surface` is the element that accepts
 * touches (the whole play area); `field` returns the canvas, used to map
 * screen positions to field pixels; `keys` receives keyboard events (the
 * window, except in tests).
 */
export class Controls {
  readonly state: ControlState = idleControls();
  private readonly pressed = new Set<string>();
  private readonly touches = new Map<number, TrackedPointer>();
  private steeringId: number | null = null;
  /** Game frames the steering touch has been down while still tentative. */
  private steeringAge = 0;
  private enabled = true;
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly surface: HTMLElement,
    private readonly field: () => Element | null,
    keys: EventTarget = window,
  ) {
    this.listen(keys, "keydown", (e) => this.onKey(e as KeyboardEvent, true));
    this.listen(keys, "keyup", (e) => this.onKey(e as KeyboardEvent, false));
    this.listen(keys, "blur", () => this.reset());
    this.listen(surface, "pointerdown", (e) => this.onPointerDown(e as PointerEvent));
    this.listen(surface, "pointermove", (e) => this.onPointerMove(e as PointerEvent));
    this.listen(surface, "pointerup", (e) => this.onPointerUp(e as PointerEvent, false));
    this.listen(surface, "pointercancel", (e) => this.onPointerUp(e as PointerEvent, true));
    this.listen(surface, "pointerleave", (e) => {
      if ((e as PointerEvent).pointerType === "mouse") this.state.pointerX = null;
    });
    this.listen(surface, "contextmenu", (e) => e.preventDefault());
  }

  dispose(): void {
    for (const off of this.cleanup) off();
  }

  /**
   * Turns the controls off (while paused) or back on. While off, the keyboard
   * is left alone, so Enter and Space work normally on buttons.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.reset();
  }

  /** Call after each game frame: the pending launch press has now been seen. */
  consumeLatch(): void {
    this.state.launchLatch = false;
  }

  /** Call once per game frame (also during the countdown), so a held touch stops being "maybe a tap". */
  frameTick(): void {
    if (this.state.pointerTentative && ++this.steeringAge >= TAP_FRAMES) this.state.pointerTentative = false;
  }

  /** Releases everything. */
  reset(): void {
    this.pressed.clear();
    this.touches.clear();
    this.steeringId = null;
    Object.assign(this.state, idleControls());
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  private updateKeys(): void {
    const any = (keys: Set<string>) => [...keys].some((k) => this.pressed.has(k));
    this.state.left = any(LEFT_KEYS);
    this.state.right = any(RIGHT_KEYS);
    this.state.launchKey = any(LAUNCH_KEYS);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!this.enabled) return;
    if (META_KEYS.has(e.code) && !down) {
      // On a Mac, keys pressed while Cmd is held never send a "key up", so forget them all.
      this.pressed.clear();
      this.updateKeys();
      return;
    }
    if (!GAME_KEYS.has(e.code)) return;
    if (down && (e.metaKey || e.ctrlKey || e.altKey)) return; // a browser shortcut, not a game key
    e.preventDefault();
    if (down) {
      if (!e.repeat && LAUNCH_KEYS.has(e.code)) this.state.launchLatch = true;
      this.pressed.add(e.code);
    } else {
      this.pressed.delete(e.code);
    }
    this.updateKeys();
    // The keyboard takes over from the mouse until the mouse moves again.
    if (this.state.left || this.state.right) this.state.pointerX = null;
  }

  private toFieldX(clientX: number): number {
    const field = this.field();
    if (!field) return FIELD_W / 2;
    const rect = field.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * FIELD_W;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    this.surface.setPointerCapture?.(e.pointerId);
    const x = this.toFieldX(e.clientX);

    if (e.pointerType === "mouse") {
      this.state.pointerX = x;
      this.state.mouseDown = true;
      this.state.launchLatch = true;
      return;
    }

    this.touches.set(e.pointerId, { x, startX: e.clientX, startY: e.clientY, startTime: e.timeStamp });
    if (this.steeringId === null) {
      this.steeringId = e.pointerId;
      this.state.pointerX = x;
      this.state.pointerTentative = true;
      this.steeringAge = 0;
    } else {
      // A second finger launches, so one thumb can steer while the other serves.
      this.state.launchLatch = true;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled) return;
    const x = this.toFieldX(e.clientX);
    if (e.pointerType === "mouse") {
      this.state.pointerX = x;
      return;
    }
    const touch = this.touches.get(e.pointerId);
    if (!touch) return;
    touch.x = x;
    if (e.pointerId !== this.steeringId) return;
    this.state.pointerX = x;
    if (Math.abs(e.clientX - touch.startX) >= TAP_SLOP_PX || Math.abs(e.clientY - touch.startY) >= TAP_SLOP_PX) {
      this.state.pointerTentative = false;
    }
  }

  private onPointerUp(e: PointerEvent, cancelled: boolean): void {
    if (e.pointerType === "mouse") {
      this.state.mouseDown = false;
      return;
    }
    const touch = this.touches.get(e.pointerId);
    if (!touch) return;
    this.touches.delete(e.pointerId);

    const quick = e.timeStamp - touch.startTime < TAP_MS;
    const still = Math.abs(e.clientX - touch.startX) < TAP_SLOP_PX && Math.abs(e.clientY - touch.startY) < TAP_SLOP_PX;
    if (!cancelled && quick && still && this.enabled) this.state.launchLatch = true;

    if (e.pointerId === this.steeringId) {
      // Hand steering to a finger that is still down, if there is one.
      const next = this.touches.entries().next();
      this.state.pointerTentative = false;
      if (next.done) {
        this.steeringId = null;
        this.state.pointerX = null;
      } else {
        this.steeringId = next.value[0];
        this.state.pointerX = next.value[1].x;
      }
    }
  }
}
