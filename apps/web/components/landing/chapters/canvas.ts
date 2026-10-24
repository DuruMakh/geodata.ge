import type { RevenueBandId } from "../../../lib/landing/chapters/types";

// Canvas helpers ported from the design board's chart script. Pure functions (squarify,
// niceTicks, stackLabels, fitText) touch no DOM; the rest read `window` only when called.

export type Rect = [x: number, y: number, w: number, h: number];

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Colour of a square outside the selected measure (no token in globals.css). */
export const OFF_SQUARE = "#e2d7c4";

/** Red, green and blue 0..255 of a 6-digit hex colour (black when it is not one). */
export function rgb(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/** `rgb(r,g,b)` the fraction `t` of the way from hex colour `a` to hex colour `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

/**
 * Grid of `total` equal squares for a chart `width` px wide: rows 16..220, the tallest grid that stays within
 * 1.04 x clamp(0.56 x width, 280, 520), or within `maxHeight` when the chart's height is already set; a 40-row grid
 * when none fits. Squares fill column by column.
 */
export function gridFor(width: number, total: number, maxHeight?: number): { rows: number; cols: number; cell: number; gap: number; height: number } {
  const limit = maxHeight ?? clamp(Math.round(width * 0.56), 280, 520) * 1.04;
  let best: { rows: number; cols: number; cell: number; height: number } | null = null;
  for (let rows = 16; rows <= 220; rows++) {
    const cols = Math.ceil(total / rows);
    const cell = width / cols;
    const height = rows * cell;
    if (height <= limit && (!best || height > best.height)) best = { rows, cols, cell, height };
  }
  if (!best) {
    const cols = Math.ceil(total / 40);
    best = { rows: 40, cols, cell: width / cols, height: 40 * (width / cols) };
  }
  return { rows: best.rows, cols: best.cols, cell: best.cell, gap: best.cell >= 7 ? 1.5 : 1, height: Math.round(best.rows * best.cell) };
}

/**
 * Rectangle of a year inside a w x h chart: both sides scaled by sqrt(value / max), so the area follows the value,
 * anchored to the bottom-left corner. Nothing to draw (zero width and height on the floor) without a value or a maximum.
 */
export function anchoredRect(value: number, max: number, w: number, h: number): Rect {
  if (!(value > 0) || !(max > 0)) return [0, h, 0, 0];
  const s = Math.sqrt(Math.min(1, value / max));
  return [0, h - h * s, w * s, h * s];
}

/** What a treemap block of w x h px has room to say: name + amount (+ share when 64 px tall), the share alone, or nothing. */
export function blockLabelTier(w: number, h: number): "nameAmountShare" | "nameAmount" | "share" | "none" {
  if (w >= 82 && h >= 46) return h >= 64 ? "nameAmountShare" : "nameAmount";
  if (w >= 44 && h >= 24) return "share";
  return "none";
}

/** Fill of the block at `rank` (0 = largest) of `count`: from near-black to sand, the last block a touch lighter. */
export function blockTone(rank: number, count: number): string {
  return mixHex("#26211b", "#d6cab5", Math.pow(rank / Math.max(1, count - 2), 0.9));
}

// Revenue band colours, fixed by the homepage plan; liabilities take the accent colour the caller passes.
const REVENUE_BAND_COLORS: Record<Exclude<RevenueBandId, "liabilities">, string> = {
  vat: "#28568e",
  income: "#50aed5",
  profit: "#007f69",
  excise: "#83c084",
  otherTaxes: "#7668ad",
  otherIncome: "#d2ab5f",
};

export const revenueBandColor = (id: RevenueBandId, accent: string) => (id === "liabilities" ? accent : REVENUE_BAND_COLORS[id]);

/** The rectangle `t` of the way from `a` to `b`. */
export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

/**
 * Points of a sparkline across `width`: the smallest value sits at `bottom`, the largest at `top`.
 * A constant or single-value series runs flat through the middle.
 */
export function sparkPoints(values: number[], width: number, top: number, bottom: number): [x: number, y: number][] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const n = values.length;
  return values.map((v, i) => [n > 1 ? (i / (n - 1)) * width : 0, hi > lo ? bottom - ((v - lo) / (hi - lo)) * (bottom - top) : (top + bottom) / 2]);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Size a canvas's buffer to w x h CSS pixels at device-pixel ratio (capped at 2) and return that ratio. */
export function fitCanvas(cv: HTMLCanvasElement, w: number, h: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (cv.width !== pw) cv.width = pw;
  if (cv.height !== ph) cv.height = ph;
  const sw = `${w}px`;
  const sh = `${h}px`;
  if (cv.style.width !== sw) cv.style.width = sw;
  if (cv.style.height !== sh) cv.style.height = sh;
  return dpr;
}

/** Size a canvas to w x h CSS pixels at device-pixel ratio (capped at 2), cleared and ready to draw in CSS pixels. */
export function sizeCanvas(cv: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = fitCanvas(cv, w, h);
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

/** Round axis ticks from 0 covering `max` in at most `n` steps: step 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(max: number, n: number): { step: number; top: number; ticks: number[] } {
  const exp = Math.floor(Math.log10(Math.max(1e-9, max / n)));
  for (let k = exp - 1; k <= exp + 1; k++) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * Math.pow(10, k);
      const count = Math.ceil(max / step - 1e-9);
      if (count <= n) {
        const ticks: number[] = [];
        for (let i = 0; i <= count; i++) ticks.push(+(i * step).toFixed(6));
        return { step, top: count * step, ticks };
      }
    }
  }
  return { step: max, top: max, ticks: [0, max] };
}

/** Shorten `s` with an ellipsis until it fits `maxW`; empty when not even one character fits. */
export function fitText(ctx: Pick<CanvasRenderingContext2D, "measureText">, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return t.length > 1 ? `${t}…` : "";
}

/** Squarified treemap: one rectangle per value, areas proportional to the values, filling x,y,w,h. Zero values get empty rectangles. */
export function squarify(values: number[], x: number, y: number, w: number, h: number): Rect[] {
  const out: Rect[] = new Array(values.length);
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0 || w <= 0 || h <= 0) {
    values.forEach((_, i) => {
      out[i] = [x, y, 0, 0];
    });
    return out;
  }
  const scale = (w * h) / total;
  const items = values.map((v, i) => ({ i, a: Math.max(0, v) * scale }));
  let rx = x;
  let ry = y;
  let rw = w;
  let rh = h;
  let row: typeof items = [];
  let k = 0;
  const worst = (r: typeof items, len: number) => {
    let s = 0;
    let mx = -Infinity;
    let mn = Infinity;
    for (const it of r) {
      s += it.a;
      if (it.a > mx) mx = it.a;
      if (it.a < mn) mn = it.a;
    }
    if (!s) return Infinity;
    const l2 = len * len;
    const s2 = s * s;
    return Math.max((l2 * mx) / s2, s2 / (l2 * mn));
  };
  const lay = (r: typeof items) => {
    const s = r.reduce((a, b) => a + b.a, 0);
    if (rw >= rh) {
      const sw = s / rh;
      let yy = ry;
      for (const it of r) {
        const hh = it.a / sw;
        out[it.i] = [rx, yy, sw, hh];
        yy += hh;
      }
      rx += sw;
      rw -= sw;
    } else {
      const sh = s / rw;
      let xx = rx;
      for (const it of r) {
        const ww = it.a / sh;
        out[it.i] = [xx, ry, ww, sh];
        xx += ww;
      }
      ry += sh;
      rh -= sh;
    }
  };
  while (k < items.length) {
    const it = items[k];
    if (it.a <= 0) {
      out[it.i] = [rx, ry, 0, 0];
      k++;
      continue;
    }
    const len = Math.min(rw, rh);
    if (!row.length || worst([...row, it], len) <= worst(row, len)) {
      row.push(it);
      k++;
    } else {
      lay(row);
      row = [];
    }
  }
  if (row.length) lay(row);
  return out;
}

/** Push overlapping labels apart by at least `gap`, keeping them inside [lo, hi]. Index 0 sits lowest on screen (largest y). */
export function stackLabels(want: number[], gap: number, lo: number, hi: number): number[] {
  const y = want.map((v) => clamp(v, lo, hi));
  const n = y.length;
  for (let i = 1; i < n; i++) if (y[i] > y[i - 1] - gap) y[i] = y[i - 1] - gap;
  if (n && y[n - 1] < lo) {
    y[n - 1] = lo;
    for (let i = n - 2; i >= 0; i--) if (y[i] < y[i + 1] + gap) y[i] = y[i + 1] + gap;
  }
  return y;
}

/** Move a tooltip element next to (x, y) inside a w x h chart: right of the pointer, flipped left at the edge, kept in view. */
export function placeTip(el: HTMLElement, x: number, y: number, w: number, h: number): void {
  const tw = el.offsetWidth;
  const th = el.offsetHeight;
  let left = x + 16;
  if (left + tw > w) left = x - 16 - tw;
  if (left < 0) left = clamp(x - tw / 2, 0, Math.max(0, w - tw));
  const top = clamp(y - th / 2, -8, Math.max(-8, h - th + 8));
  el.style.transform = `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;
  el.style.opacity = "1";
}

/** Fallbacks of the design tokens the charts read, used when a token is missing or not a 6-digit hex colour. */
export const TOKEN_FALLBACKS = {
  paper: "#f7f2e9",
  ink: "#1e1b16",
  accent: "#b3402a",
  body: "#55503f",
  muted: "#6a6050",
  control: "#95846a",
  hairline: "#d9cfbe",
  hairlineSoft: "#e7decf",
  positive: "#1f6e56",
  ui: '"Noto Sans Georgian","Helvetica Neue",Arial,sans-serif',
  num: '"Geist Mono",ui-monospace,Menlo,monospace',
};

/** The colour and font tokens the charts draw with, resolved on `el` (canvas cannot use `var()`). */
export function readTokens(el: Element): typeof TOKEN_FALLBACKS {
  const style = getComputedStyle(el);
  const color = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  };
  const font = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const f = TOKEN_FALLBACKS;
  return {
    paper: color("--paper", f.paper),
    ink: color("--ink", f.ink),
    accent: color("--accent", f.accent),
    body: color("--body", f.body),
    muted: color("--muted", f.muted),
    control: color("--control", f.control),
    hairline: color("--hairline", f.hairline),
    hairlineSoft: color("--hairline-soft", f.hairlineSoft),
    positive: color("--positive", f.positive),
    ui: font("--font-ui", f.ui),
    num: font("--font-numeric", f.num),
  };
}
