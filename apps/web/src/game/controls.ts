// Turns keyboard, mouse and touch into the game's Input for each frame.
//
// Keyboard: arrows or A/D move at full speed; Space, Up, W or Enter launches.
// Mouse: the paddle follows the mouse; click launches.
// Touch: the paddle follows your finger (anywhere on the play area, so your
// finger doesn't hide the ball); touching the screen launches.

import { FIELD_W, type Input, MAX_MOVE, PADDLE_W } from "@h2h/game";

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const LAUNCH_KEYS = new Set(["Space", "ArrowUp", "KeyW", "Enter"]);
export const GAME_KEYS = new Set([...LEFT_KEYS, ...RIGHT_KEYS, ...LAUNCH_KEYS]);

export interface ControlState {
  left: boolean;
  right: boolean;
  launchKey: boolean;
  /** Where the pointer is, in field pixels, or null if the pointer isn't steering. */
  pointerX: number | null;
  pointerDown: boolean;
}

/** How far the paddle should move this frame to follow the controls. Pure, so it can be tested. */
export function moveFor(paddleX: number, controls: ControlState): number {
  if (controls.left !== controls.right) return controls.left ? -MAX_MOVE : MAX_MOVE;
  if (controls.pointerX === null) return 0;
  const diff = Math.round(controls.pointerX - (paddleX + PADDLE_W / 2));
  return Math.max(-MAX_MOVE, Math.min(MAX_MOVE, diff));
}

export function inputFor(paddleX: number, controls: ControlState): Input {
  return { move: moveFor(paddleX, controls), action: controls.launchKey || controls.pointerDown };
}

/**
 * Listens to the keyboard and pointer. `surface` is the element that accepts
 * touches (the whole play area); `field` returns the canvas, used to map
 * screen positions to field pixels.
 */
export class Controls {
  readonly state: ControlState = { left: false, right: false, launchKey: false, pointerX: null, pointerDown: false };
  private readonly pressed = new Set<string>();
  private readonly pointers = new Set<number>();
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly surface: HTMLElement,
    private readonly field: () => Element | null,
  ) {
    this.listen(window, "keydown", (e) => this.onKey(e as KeyboardEvent, true));
    this.listen(window, "keyup", (e) => this.onKey(e as KeyboardEvent, false));
    this.listen(window, "blur", () => this.reset());
    this.listen(surface, "pointerdown", (e) => this.onPointerDown(e as PointerEvent));
    this.listen(surface, "pointermove", (e) => this.onPointerMove(e as PointerEvent));
    this.listen(surface, "pointerup", (e) => this.onPointerUp(e as PointerEvent));
    this.listen(surface, "pointercancel", (e) => this.onPointerUp(e as PointerEvent));
    this.listen(surface, "pointerleave", (e) => {
      if ((e as PointerEvent).pointerType === "mouse") this.state.pointerX = null;
    });
    this.listen(surface, "contextmenu", (e) => e.preventDefault());
  }

  dispose(): void {
    for (const off of this.cleanup) off();
  }

  /** Releases everything, for example when the game is paused. */
  reset(): void {
    this.pressed.clear();
    this.pointers.clear();
    Object.assign(this.state, { left: false, right: false, launchKey: false, pointerDown: false });
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (down) this.pressed.add(e.code);
    else this.pressed.delete(e.code);
    const any = (keys: Set<string>) => [...keys].some((k) => this.pressed.has(k));
    this.state.left = any(LEFT_KEYS);
    this.state.right = any(RIGHT_KEYS);
    this.state.launchKey = any(LAUNCH_KEYS);
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
    e.preventDefault();
    this.surface.setPointerCapture?.(e.pointerId);
    this.pointers.add(e.pointerId);
    this.state.pointerDown = true;
    this.state.pointerX = this.toFieldX(e.clientX);
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType !== "mouse" && !this.pointers.has(e.pointerId)) return;
    this.state.pointerX = this.toFieldX(e.clientX);
  }

  private onPointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.state.pointerDown = this.pointers.size > 0;
    if (e.pointerType !== "mouse" && this.pointers.size === 0) this.state.pointerX = null;
  }
}
