import { clamp, prefersReducedMotion, sizeCanvas } from "./canvas";

// Shared engine of the line/area/bar charts of chapters 03 and 05: sizes the canvas to its wrapper,
// plays the draw-in once the wrapper is first on screen (reduced motion: final state at once),
// tracks the hovered index and hands it to the chart. Ported from the design board's chartCore.

export type ChartState = {
  W: number;
  H: number;
  /** Draw-in progress 0..1; 1 once played, and from the start under reduced motion. */
  p: number;
  /** Hovered index, -1 for none. */
  hover: number;
};

export type ChartSpec = {
  /** Draw-in length in ms. */
  duration: number;
  draw(ctx: CanvasRenderingContext2D, state: ChartState): void;
  /** Index under the pointer (CSS px inside the canvas), -1 for none. */
  hit(x: number, y: number, state: ChartState): number;
  /** The pointer is over index `index`. */
  onHover(index: number): void;
  onLeave(): void;
};

export type ChartCore = { destroy(): void };

export function createChartCore(wrap: HTMLElement, canvas: HTMLCanvasElement, spec: ChartSpec): ChartCore {
  const state: ChartState = { W: 0, H: 0, p: prefersReducedMotion() ? 1 : 0, hover: -1 };
  let raf = 0;
  let alive = true;
  let seen = false;

  const draw = () => {
    if (!alive || !state.W || !state.H) return;
    spec.draw(sizeCanvas(canvas, state.W, state.H), state);
  };
  const size = () => {
    const w = Math.round(wrap.clientWidth);
    const h = Math.round(wrap.clientHeight);
    if (!w || !h || (w === state.W && h === state.H)) return;
    state.W = w;
    state.H = h;
    draw();
  };
  const intro = () => {
    if (seen) return;
    seen = true;
    if (state.p >= 1) {
      draw();
      return;
    }
    const t0 = performance.now();
    const frame = (t: number) => {
      if (!alive) return;
      state.p = clamp((t - t0) / spec.duration, 0, 1);
      draw();
      if (state.p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };

  const move = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    const i = spec.hit(event.clientX - box.left, event.clientY - box.top, state);
    if (i !== state.hover) {
      state.hover = i;
      draw();
    }
    if (i < 0) spec.onLeave();
    else spec.onHover(i);
  };
  const leave = () => {
    if (state.hover !== -1) {
      state.hover = -1;
      draw();
    }
    spec.onLeave();
  };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", move);
  canvas.addEventListener("pointerleave", leave);

  let resizeObserver: ResizeObserver | null = null;
  let introObserver: IntersectionObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(size);
    resizeObserver.observe(wrap);
  }
  size();
  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        intro();
      },
      { threshold: 0.3 },
    );
    introObserver = observer;
    observer.observe(wrap);
  } else {
    state.p = 1;
    seen = true;
    draw();
  }

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      introObserver?.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", move);
      canvas.removeEventListener("pointerleave", leave);
    },
  };
}
