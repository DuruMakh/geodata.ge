import type { SpendingSeries } from "../../../lib/landing/chapters/types";
import { formatShare } from "../../../lib/explorer/format";
import {
  anchoredRect,
  bindChartPointer,
  blockLabelTier,
  blockTone,
  clamp,
  fitText,
  lerpRect,
  prefersReducedMotion,
  readTokens,
  sizeCanvas,
  squarify,
  type Rect,
} from "./canvas";
import { easeInOut, easeOut, txt } from "./chart-draw";

// The canvas engine of chapter 02's treemap, loaded only once the chapter nears the viewport (spending-chapter.tsx).
// The block area of a year follows sqrt(total / largest total) anchored bottom-left. Ported from the design board's
// createTree.

const DARK_BLOCKS = 6; // the six largest fields take light text
const TWEEN_MS = 520;

export type Engine = { setYear(index: number, ms?: number): void; highlight(id: string | null): void; destroy(): void };

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  data: SpendingSeries;
  initial: number;
  frameText(): string;
  amount(gel: number): string;
  onHover(field: number, x: number, y: number): void;
  onLeave(): void;
};

export function createTreemap({ wrap, canvas, data, initial, frameText, amount, onHover, onLeave }: EngineOptions): Engine {
  const { paper, ink, accent, control, muted, ui, num } = readTokens(wrap);
  const reduced = prefersReducedMotion();

  const { fields, totals } = data;
  const maxTotal = Math.max(...totals);
  const tones = fields.map((_, i) => blockTone(i, fields.length));

  let W = 0;
  let H = 0;
  let idx = initial;
  let cur: Rect[] | null = null;
  let from: Rect[] = [];
  let to: Rect[] = [];
  let t0 = 0;
  let dur = TWEEN_MS;
  let tweenRaf = 0;
  let introRaf = 0;
  let alive = true;
  let seen = false;
  let intro = reduced ? 1 : 0;
  let hover = -1;
  let ext: string | null = null;

  const target = (i: number): Rect[] => {
    const [x, y, w, h] = anchoredRect(totals[i], maxTotal, W, H);
    return squarify(fields.map((f) => f.values[i]), x, y, w, h);
  };

  const draw = () => {
    if (!W || !alive || !cur) return;
    const ctx = sizeCanvas(canvas, W, H);
    const k = easeOut(intro);
    if (intro > 0 && totals[idx] < maxTotal) {
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = control;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      ctx.restore();
      txt(ctx, frameText(), W - 12, 22, `500 11.5px ${ui}`, muted, "right");
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H - H * k, W * k, H * k);
    ctx.clip();
    fields.forEach((field, i) => {
      const rect = cur?.[i];
      if (!rect) return;
      const x = rect[0] + 1;
      const y = rect[1] + 1;
      const w = rect[2] - 2;
      const h = rect[3] - 2;
      if (w < 0.5 || h < 0.5) return;
      const lit = hover === i || ext === field.id;
      const dark = lit || i < DARK_BLOCKS;
      ctx.fillStyle = lit ? accent : tones[i];
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = dark ? "rgba(247,242,233,.085)" : "rgba(30,27,22,.07)";
      for (let yy = y + 4; yy < y + h - 2; yy += 7) for (let xx = x + 4; xx < x + w - 2; xx += 7) ctx.fillRect(xx, yy, 1.3, 1.3);
      const tier = blockLabelTier(w, h);
      if (tier === "none") return;
      const v = field.values[idx];
      const fraction = totals[idx] > 0 ? v / totals[idx] : 0;
      if (tier === "share") {
        const font = `500 ${W < 768 ? 11 : 10.5}px ${num}`; // 11px floor below 768px (DESIGN.md §12)
        ctx.font = font;
        txt(ctx, fitText(ctx, formatShare(fraction, false, 0), w - 12), x + 6, y + 16, font, dark ? paper : ink);
        return;
      }
      const sub = dark ? "rgba(247,242,233,.8)" : "rgba(30,27,22,.82)";
      ctx.font = `600 12.5px ${ui}`;
      txt(ctx, fitText(ctx, field.label, w - 20), x + 10, y + 21, `600 12.5px ${ui}`, dark ? paper : ink);
      ctx.font = `500 11.5px ${num}`;
      txt(ctx, fitText(ctx, amount(v), w - 20), x + 10, y + 39, `500 11.5px ${num}`, sub);
      if (tier === "nameAmountShare") txt(ctx, formatShare(fraction), x + 10, y + 56, `500 11.5px ${num}`, sub);
    });
    ctx.restore();
  };

  const tween = (ms: number) => {
    to = target(idx);
    from = cur ? cur.map((r) => [...r] as Rect) : to;
    t0 = performance.now();
    dur = ms;
    cancelAnimationFrame(tweenRaf);
    if (reduced || ms <= 0) {
      cur = to;
      draw();
      return;
    }
    const frame = (t: number) => {
      if (!alive) return;
      const k = clamp((t - t0) / dur, 0, 1);
      const e = easeInOut(k);
      cur = to.map((r, i) => lerpRect(from[i] ?? r, r, e));
      draw();
      if (k < 1) tweenRaf = requestAnimationFrame(frame);
    };
    tweenRaf = requestAnimationFrame(frame);
  };

  const size = () => {
    const w = Math.round(wrap.clientWidth);
    const h = Math.round(wrap.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w;
    H = h;
    cancelAnimationFrame(tweenRaf);
    cur = to = target(idx);
    draw();
  };

  const hit = (px: number, py: number) => {
    if (!cur) return -1;
    return cur.findIndex((r) => r[2] > 1 && r[3] > 1 && px >= r[0] && px <= r[0] + r[2] && py >= r[1] && py <= r[1] + r[3]);
  };
  const move = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const i = hit(px, py);
    if (i !== hover) {
      hover = i;
      draw();
    }
    if (i < 0) onLeave();
    else onHover(i, px, py);
  };
  const leave = () => {
    if (hover !== -1) {
      hover = -1;
      draw();
    }
    onLeave();
  };
  const unbind = bindChartPointer(canvas, move, leave);

  const startIntro = () => {
    if (seen) return;
    seen = true;
    if (intro >= 1) {
      draw();
      return;
    }
    const s0 = performance.now();
    const frame = (t: number) => {
      if (!alive) return;
      intro = clamp((t - s0) / 900, 0, 1);
      draw();
      if (intro < 1) introRaf = requestAnimationFrame(frame);
    };
    introRaf = requestAnimationFrame(frame);
  };

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
        startIntro();
      },
      { threshold: 0.3 },
    );
    introObserver = observer;
    observer.observe(wrap);
  } else {
    intro = 1;
    seen = true;
    draw();
  }

  return {
    setYear(index, ms = TWEEN_MS) {
      if (index === idx && cur) return;
      idx = index;
      // The tooltip and an outside highlight describe the old year: drop both.
      hover = -1;
      ext = null;
      onLeave();
      if (W) tween(ms);
    },
    highlight(id) {
      ext = id;
      draw();
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(tweenRaf);
      cancelAnimationFrame(introRaf);
      resizeObserver?.disconnect();
      introObserver?.disconnect();
      unbind();
    },
  };
}
