import { FIELD_W, MAX_MOVE, PADDLE_W } from "@h2h/game";
import { beforeEach, describe, expect, it } from "vitest";
import { type ControlState, Controls, idleControls, inputFor, moveFor } from "../src/game/controls";

const idle = idleControls();

describe("moveFor", () => {
  it("moves at full speed while an arrow key is held", () => {
    expect(moveFor(100, { ...idle, left: true })).toBe(-MAX_MOVE);
    expect(moveFor(100, { ...idle, right: true })).toBe(MAX_MOVE);
    expect(moveFor(100, { ...idle, left: true, right: true })).toBe(0);
  });

  it("follows the pointer without overshooting", () => {
    const paddleX = 100;
    const center = paddleX + PADDLE_W / 2;
    expect(moveFor(paddleX, { ...idle, pointerX: center })).toBe(0);
    expect(moveFor(paddleX, { ...idle, pointerX: center + 3 })).toBe(3);
    expect(moveFor(paddleX, { ...idle, pointerX: center - 2.4 })).toBe(-2);
    expect(moveFor(paddleX, { ...idle, pointerX: FIELD_W + 50 })).toBe(MAX_MOVE);
    expect(moveFor(paddleX, { ...idle, pointerX: -50 })).toBe(-MAX_MOVE);
  });

  it("lets keys win over the pointer", () => {
    expect(moveFor(100, { ...idle, pointerX: 0, right: true })).toBe(MAX_MOVE);
  });

  it("always produces a whole-number move the recorder accepts", () => {
    for (let x = -20; x <= FIELD_W + 20; x += 0.37) {
      const move = moveFor(57, { ...idle, pointerX: x });
      expect(Number.isInteger(move) && Math.abs(move) <= MAX_MOVE).toBe(true);
    }
  });
});

describe("inputFor", () => {
  it("launches with a held key, a held mouse button, or a pending tap", () => {
    expect(inputFor(100, { ...idle, launchKey: true }).action).toBe(true);
    expect(inputFor(100, { ...idle, mouseDown: true }).action).toBe(true);
    expect(inputFor(100, { ...idle, launchLatch: true }).action).toBe(true);
    expect(inputFor(100, idle).action).toBe(false);
  });
});

// ---- The Controls class, driven by fake events (no browser needed) ----

/** A play area 240 CSS px wide at x = 0, so CSS pixels equal field pixels. */
const field = { getBoundingClientRect: () => ({ left: 0, width: FIELD_W }) } as unknown as Element;

function fakeSurface(): EventTarget & { setPointerCapture: () => void } {
  return Object.assign(new EventTarget(), { setPointerCapture: () => {} });
}

function pointer(type: string, props: { id: number; kind?: string; x: number; y?: number; t: number }): Event {
  const e = new Event(type, { cancelable: true });
  Object.defineProperties(e, {
    pointerId: { value: props.id },
    pointerType: { value: props.kind ?? "touch" },
    clientX: { value: props.x },
    clientY: { value: props.y ?? 300 },
    timeStamp: { value: props.t },
  });
  return e;
}

function key(type: "keydown" | "keyup", code: string, mods: { metaKey?: boolean; repeat?: boolean } = {}): Event {
  const e = new Event(type, { cancelable: true });
  Object.defineProperties(e, {
    code: { value: code },
    metaKey: { value: mods.metaKey ?? false },
    ctrlKey: { value: false },
    altKey: { value: false },
    repeat: { value: mods.repeat ?? false },
  });
  return e;
}

describe("Controls", () => {
  let surface: ReturnType<typeof fakeSurface>;
  let keys: EventTarget;
  let controls: Controls;
  let state: ControlState;

  beforeEach(() => {
    surface = fakeSurface();
    keys = new EventTarget();
    controls = new Controls(surface as unknown as HTMLElement, () => field, keys);
    state = controls.state;
  });

  it("steers with a dragging finger without launching", () => {
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 40, t: 0 }));
    surface.dispatchEvent(pointer("pointermove", { id: 1, x: 120, t: 100 }));
    expect(state.pointerX).toBe(120);
    surface.dispatchEvent(pointer("pointerup", { id: 1, x: 120, t: 600 }));
    expect(state.launchLatch).toBe(false);
    expect(state.pointerX).toBeNull();
  });

  it("launches on a quick tap", () => {
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 100, t: 0 }));
    surface.dispatchEvent(pointer("pointerup", { id: 1, x: 103, t: 120 }));
    expect(state.launchLatch).toBe(true);
    expect(inputFor(100, state).action).toBe(true);
    controls.consumeLatch();
    expect(inputFor(100, state).action).toBe(false);
  });

  it("does not launch on a slow press", () => {
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 100, t: 0 }));
    surface.dispatchEvent(pointer("pointerup", { id: 1, x: 100, t: 400 }));
    expect(state.launchLatch).toBe(false);
  });

  it("launches with a second finger and keeps steering with the first", () => {
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 30, t: 0 }));
    surface.dispatchEvent(pointer("pointerdown", { id: 2, x: 220, t: 500 }));
    expect(state.launchLatch).toBe(true);
    expect(state.pointerX).toBe(30);
    surface.dispatchEvent(pointer("pointermove", { id: 2, x: 200, t: 520 }));
    expect(state.pointerX).toBe(30);
    surface.dispatchEvent(pointer("pointerup", { id: 2, x: 200, t: 700 }));
    expect(state.pointerX).toBe(30);
  });

  it("hands steering to the remaining finger when the steering finger lifts", () => {
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 30, t: 0 }));
    surface.dispatchEvent(pointer("pointerdown", { id: 2, x: 220, t: 100 }));
    surface.dispatchEvent(pointer("pointerup", { id: 1, x: 30, t: 900 }));
    expect(state.pointerX).toBe(220);
  });

  it("launches on a mouse click and steers by hovering", () => {
    surface.dispatchEvent(pointer("pointermove", { id: 9, kind: "mouse", x: 70, t: 0 }));
    expect(state.pointerX).toBe(70);
    expect(inputFor(100, state).action).toBe(false);
    surface.dispatchEvent(pointer("pointerdown", { id: 9, kind: "mouse", x: 70, t: 10 }));
    surface.dispatchEvent(pointer("pointerup", { id: 9, kind: "mouse", x: 70, t: 20 }));
    expect(state.launchLatch).toBe(true);
    expect(state.mouseDown).toBe(false);
  });

  it("never misses a key press, even if it is released before the next frame", () => {
    keys.dispatchEvent(key("keydown", "Space"));
    keys.dispatchEvent(key("keyup", "Space"));
    expect(inputFor(100, state).action).toBe(true);
  });

  it("ignores browser shortcuts and recovers from the Mac Cmd key", () => {
    const shortcut = key("keydown", "KeyA", { metaKey: true });
    keys.dispatchEvent(shortcut);
    expect(shortcut.defaultPrevented).toBe(false);
    expect(state.left).toBe(false);

    keys.dispatchEvent(key("keydown", "KeyA"));
    expect(state.left).toBe(true);
    keys.dispatchEvent(key("keyup", "MetaLeft"));
    expect(state.left).toBe(false);
  });

  it("leaves the keyboard alone while disabled, so buttons still work when paused", () => {
    controls.setEnabled(false);
    const enter = key("keydown", "Enter");
    keys.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(state.launchKey).toBe(false);
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 30, t: 0 }));
    expect(state.pointerX).toBeNull();

    controls.setEnabled(true);
    const space = key("keydown", "Space");
    keys.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(state.launchKey).toBe(true);
  });
});

describe("Controls: taps never move a waiting serve, and swipes never launch", () => {
  let surface: ReturnType<typeof fakeSurface>;
  let controls: Controls;

  beforeEach(() => {
    surface = fakeSurface();
    controls = new Controls(surface as unknown as HTMLElement, () => field, new EventTarget());
  });

  it("does not launch on a quick swipe", () => {
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 40, t: 0 }));
    surface.dispatchEvent(pointer("pointermove", { id: 1, x: 120, t: 50 }));
    surface.dispatchEvent(pointer("pointerup", { id: 1, x: 200, t: 100 }));
    expect(controls.state.launchLatch).toBe(false);
  });

  it("does not move the paddle toward a tap while the ball is waiting", () => {
    const paddleX = 100;
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 10, t: 0 }));
    for (let frame = 0; frame < 10; frame++) {
      expect(moveFor(paddleX, controls.state, true)).toBe(0);
      controls.frameTick();
    }
    surface.dispatchEvent(pointer("pointerup", { id: 1, x: 10, t: 160 }));
    expect(controls.state.launchLatch).toBe(true);
  });

  it("still steers at once during a rally", () => {
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 10, t: 0 }));
    expect(moveFor(100, controls.state, false)).toBe(-MAX_MOVE);
  });

  it("starts steering a waiting serve once the touch moves or is held", () => {
    surface.dispatchEvent(pointer("pointerdown", { id: 1, x: 10, t: 0 }));
    surface.dispatchEvent(pointer("pointermove", { id: 1, x: 30, t: 40 }));
    expect(moveFor(100, controls.state, true)).toBe(-MAX_MOVE);

    controls.reset();
    surface.dispatchEvent(pointer("pointerdown", { id: 2, x: 10, t: 0 }));
    for (let frame = 0; frame < 15; frame++) controls.frameTick();
    expect(moveFor(100, controls.state, true)).toBe(-MAX_MOVE);
  });

  it("keeps a held arrow key when Ctrl or Alt is pressed and released", () => {
    const keys = new EventTarget();
    const c = new Controls(fakeSurface() as unknown as HTMLElement, () => field, keys);
    keys.dispatchEvent(key("keydown", "ArrowRight"));
    keys.dispatchEvent(key("keydown", "ControlLeft"));
    keys.dispatchEvent(key("keyup", "ControlLeft"));
    expect(c.state.right).toBe(true);
  });
});
