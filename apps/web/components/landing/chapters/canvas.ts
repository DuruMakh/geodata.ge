// Canvas helpers ported from the design board's chart script. Pure functions (squarify,
// niceTicks, stackLabels, fitText) touch no DOM; the rest read `window` only when called.

export type Rect = [x: number, y: number, w: number, h: number];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Size a canvas to w x h CSS pixels at device-pixel ratio (capped at 2), cleared and ready to draw in CSS pixels. */
export function sizeCanvas(cv: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (cv.width !== pw) cv.width = pw;
  if (cv.height !== ph) cv.height = ph;
  const sw = `${w}px`;
  const sh = `${h}px`;
  if (cv.style.width !== sw) cv.style.width = sw;
  if (cv.style.height !== sh) cv.style.height = sh;
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
