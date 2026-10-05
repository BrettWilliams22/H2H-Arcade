import { type RefObject, useEffect, useRef } from "react";
import { VIEW_H, VIEW_W } from "../game/renderer";

export interface CanvasView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Device pixels per game pixel. */
  scale: number;
}

/**
 * A canvas that fills its parent as much as it can while keeping the game's
 * shape, drawn at the screen's full sharpness. The current size is kept in `view`.
 */
export function FittedCanvas({ view, label }: { view: RefObject<CanvasView | null>; label: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = wrapper.current;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!box || !el || !ctx) return;

    const fit = () => {
      const cssWidth = Math.max(1, Math.floor(Math.min(box.clientWidth, (box.clientHeight * VIEW_W) / VIEW_H)));
      const cssHeight = Math.floor((cssWidth * VIEW_H) / VIEW_W);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      el.style.width = `${cssWidth}px`;
      el.style.height = `${cssHeight}px`;
      el.width = Math.round(cssWidth * dpr);
      el.height = Math.round(cssHeight * dpr);
      view.current = { canvas: el, ctx, scale: el.width / VIEW_W };
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
      <canvas ref={canvas} role="img" aria-label={label} />
    </div>
  );
}
