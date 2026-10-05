import { type RefObject, useEffect, useRef } from "react";
import { VIEW_H, VIEW_W } from "../game/renderer";

export interface CanvasView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Screen pixels per game pixel. */
  scale: number;
}

/** Width of the decorative frame around the canvas, in CSS pixels (see .canvas-frame in styles.css). */
const FRAME_PX = 2;

/**
 * A canvas that fills its parent as much as it can while keeping the game's
 * shape. The bitmap matches the canvas's on-screen size in real screen pixels,
 * so nothing is stretched. The current size is kept in `view`.
 *
 * Resizing a canvas erases it, so `onResize` is called afterwards to redraw
 * (this matters while the game is paused and not drawing on its own).
 */
export function FittedCanvas({
  view,
  label,
  onResize,
}: {
  view: RefObject<CanvasView | null>;
  label: string;
  onResize?: () => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const resized = useRef(onResize);
  resized.current = onResize;

  useEffect(() => {
    const box = wrapper.current;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!box || !el || !ctx) return;

    const fit = () => {
      const roomW = box.clientWidth - 2 * FRAME_PX;
      const roomH = box.clientHeight - 2 * FRAME_PX;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      // Work in screen pixels so the bitmap and the on-screen size match exactly.
      const deviceW = Math.max(VIEW_W, Math.floor(Math.min(roomW, (roomH * VIEW_W) / VIEW_H) * dpr));
      const deviceH = Math.round((deviceW * VIEW_H) / VIEW_W);
      el.width = deviceW;
      el.height = deviceH;
      el.style.width = `${deviceW / dpr}px`;
      el.style.height = `${deviceH / dpr}px`;
      view.current = { canvas: el, ctx, scale: deviceW / VIEW_W };
      resized.current?.();
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => {
      observer.disconnect();
      view.current = null;
    };
  }, [view]);

  return (
    <div className="canvas-box" ref={wrapper}>
      <div className="canvas-frame">
        <canvas ref={canvas} role="img" aria-label={label} />
      </div>
    </div>
  );
}
