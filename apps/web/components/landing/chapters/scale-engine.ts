import { clamp, gridFor, mixHex, OFF_SQUARE, prefersReducedMotion, readTokens, sizeCanvas } from "./canvas";

// The canvas engine of chapter 01's squares, loaded only once the chapter nears the viewport (scale-chapter.tsx).
// Squares fill column by column from the bottom left; a new measure tweens the fill and moves the marker. Ported from
// the design board's createScale.

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type Engine = { set(squares: number): void; destroy(): void };

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  marker: HTMLElement;
  markerLabel: HTMLElement;
  total: number;
  initial: number;
  onHover(index: number, x: number, y: number, filled: boolean): void;
  onLeave(): void;
};

export function createSquares({ wrap, canvas, marker, markerLabel, total, initial, onHover, onLeave }: EngineOptions): Engine {
  const { ink, accent } = readTokens(wrap);
  const off = OFF_SQUARE;
  const reduced = prefersReducedMotion();

  let W = 0;
  let H = 0;
  let cell = 6;
  let rows = 1;
  let cols = 1;
  let gap = 1;
  let cur = 0; // squares currently filled (fractional while tweening)
  let from = 0;
  let to = initial;
  let t0 = 0;
  let dur = 1;
  let raf = 0;
  let alive = true;
  let seen = false;
  let intro = reduced ? 1 : 0;
  let introT0 = 0;
  let hover = -1;

  const layout = () => {
    const w = Math.round(wrap.clientWidth);
    if (!w || w === W) return false;
    W = w;
    const grid = gridFor(W, total);
    rows = grid.rows;
    cols = grid.cols;
    cell = grid.cell;
    gap = grid.gap;
    H = grid.height;
    wrap.style.height = `${H}px`;
    return true;
  };

  const cx = (c: number) => Math.round(c * cell);
  const cy = (r: number) => Math.round(H - (r + 1) * cell);

  const placeMarker = () => {
    const x = Math.min((to / rows) * cell, cols * cell);
    marker.style.transform = `translateX(${x.toFixed(1)}px)`;
    if (x > W - 150) {
      markerLabel.style.left = "auto";
      markerLabel.style.right = "8px";
    } else {
      markerLabel.style.left = "8px";
      markerLabel.style.right = "auto";
    }
    marker.style.opacity = intro >= 1 ? "1" : "0";
  };

  const draw = () => {
    if (!W || !alive) return;
    const ctx = sizeCanvas(canvas, W, H);
    const now = cur;
    const edge = Math.abs(to - from) > 0 ? Math.sin(Math.PI * clamp((performance.now() - t0) / dur, 0, 1)) : 0;
    const band = rows * 2.2;
    const square = (i: number, path: boolean) => {
      const c = Math.floor(i / rows);
      const r = i % rows;
      const x0 = cx(c);
      const y0 = cy(r) + gap;
      const w = cx(c + 1) - x0 - gap;
      const h = cy(r - 1) - cy(r) - gap;
      if (path) ctx.rect(x0, y0, w, h);
      else ctx.fillRect(x0, y0, w, h);
    };
    if (intro < 1) {
      ctx.fillStyle = off;
      for (let i = 0; i < total; i++) {
        const c = Math.floor(i / rows);
        const r = i % rows;
        const a = clamp((intro * 1.35 - (c / cols) * 0.9 - (r / rows) * 0.25) * 3, 0, 1);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        square(i, false);
      }
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = off;
    ctx.beginPath();
    for (let i = Math.max(0, Math.floor(now)); i < total; i++) square(i, true);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath();
    const full = Math.floor(now);
    for (let i = 0; i < full; i++) square(i, true);
    ctx.fill();
    if (edge > 0.01) {
      for (let i = Math.max(0, Math.floor(now - band)); i < full; i++) {
        const k = 1 - (now - i) / band;
        ctx.fillStyle = mixHex(ink, accent, clamp(k * edge * 1.2, 0, 1));
        square(i, false);
      }
    }
    if (hover >= 0 && hover < total) {
      const c = Math.floor(hover / rows);
      const r = hover % rows;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx(c) - 1, cy(r) + gap - 1, cx(c + 1) - cx(c) - gap + 2, cy(r - 1) - cy(r) - gap + 2);
    }
  };

  const animate = (n: number, ms: number) => {
    from = cur;
    to = n;
    t0 = performance.now();
    dur = ms;
    placeMarker();
    cancelAnimationFrame(raf);
    if (reduced) {
      cur = from = to = n;
      draw();
      placeMarker();
      return;
    }
    const frame = (t: number) => {
      if (!alive) return;
      const k = clamp((t - t0) / dur, 0, 1);
      cur = from + (to - from) * easeInOut(k);
      draw();
      if (k < 1) raf = requestAnimationFrame(frame);
      else {
        from = to = cur = n;
        draw();
      }
    };
    raf = requestAnimationFrame(frame);
  };

  const startIntro = () => {
    if (seen) return;
    seen = true;
    if (intro >= 1) {
      animate(to, 10);
      return;
    }
    introT0 = performance.now();
    const frame = (t: number) => {
      if (!alive) return;
      intro = clamp((t - introT0) / 1300, 0, 1);
      draw();
      if (intro < 1) raf = requestAnimationFrame(frame);
      else animate(to, 1400);
    };
    raf = requestAnimationFrame(frame);
  };

  const move = (event: PointerEvent) => {
    if (intro < 1) return;
    const box = canvas.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const c = Math.floor(px / cell);
    const r = Math.floor((H - py) / cell);
    const i = c * rows + r;
    const ok = c >= 0 && r >= 0 && r < rows && i < total;
    const n = ok ? i : -1;
    if (n !== hover) {
      hover = n;
      draw();
    }
    if (!ok) {
      onLeave();
      return;
    }
    onHover(i, c * cell + cell / 2, H - (r + 0.5) * cell, i < Math.round(cur));
  };
  const leave = () => {
    if (hover !== -1) {
      hover = -1;
      draw();
    }
    onLeave();
  };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", move);
  canvas.addEventListener("pointerleave", leave);

  const onSize = () => {
    if (layout()) {
      draw();
      placeMarker();
    }
  };
  let resizeObserver: ResizeObserver | null = null;
  let introObserver: IntersectionObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onSize);
    resizeObserver.observe(wrap);
  }
  onSize();
  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        startIntro();
      },
      { threshold: 0.25 },
    );
    introObserver = observer;
    observer.observe(wrap);
  } else {
    intro = 1;
    seen = true;
    cur = to;
    draw();
    placeMarker();
  }

  return {
    set(squares) {
      to = squares;
      if (!seen || intro < 1) {
        placeMarker();
        return;
      }
      animate(squares, 1100);
    },
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
