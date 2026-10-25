import { formatShare } from "../../../lib/explorer/format";
import type { AgeingChapter } from "../../../lib/landing/chapters/types";
import { clamp, readTokens, SEX_COLORS } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { easeOut, haloTxt, hbar, txt, vline } from "./chart-draw";
import type { PyramidLabels } from "./pyramid-chart";

// The canvas engine of chapter 06's pyramid, loaded only once the chapter nears the viewport (pyramid-chart.tsx).
// Rows run from 85+ at the top to 0–4 at the bottom (the data runs youngest first); bars grow from the centre
// column of age labels, and the first year's shape is outlined in ink. Ported from the design board's createPyr.

/** The first age group of the 65+ bracket on the right edge. */
const OLD_FROM = "65–69";

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  data: AgeingChapter;
  labels(): PyramidLabels;
  /** The pointer is over age index `index` (youngest first). */
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);

export function createPyramid({ wrap, canvas, data, labels, onHover, onLeave }: EngineOptions) {
  const { paper, ink, muted, hairlineSoft, ui, num } = readTokens(wrap);

  const { ages, men, women, baseMen, baseWomen } = data.pyramid;
  const n = ages.length;
  const pct = (values: readonly number[], total: number) => values.map((v) => (v / total) * 100);
  const total = sum(men) + sum(women);
  const baseTotal = sum(baseMen) + sum(baseWomen);
  const shares = { men: pct(men, total), women: pct(women, total), baseMen: pct(baseMen, baseTotal), baseWomen: pct(baseWomen, baseTotal) };
  // The axis ends at the next half percent above the widest bar of either year.
  const top = Math.ceil(Math.max(...shares.men, ...shares.women, ...shares.baseMen, ...shares.baseWomen) * 2) / 2;
  const ticks: number[] = [];
  for (let v = 1; v < top; v++) ticks.push(v);
  const oldRows = ages.indexOf(OLD_FROM) < 0 ? 0 : n - ages.indexOf(OLD_FROM);
  // Row `r` from the top shows age index flip(r), and age index `i` sits in row flip(i).
  const flip = (k: number) => n - 1 - k;

  let geo: { top: number; rowHeight: number; center: number } | null = null;

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const narrow = state.W < 520;
    const L = 2;
    const R = state.W - 2;
    const T = 28;
    const B = state.H - 24;
    const w = Math.max(1, R - L);
    const h = Math.max(1, B - T);
    const gap = narrow ? 44 : 56;
    const cx = Math.round(L + w / 2);
    const half = w / 2 - gap / 2;
    const rh = h / n;
    const bh = Math.max(2, rh - 2);
    const XL = (v: number) => cx - gap / 2 - (v / top) * half;
    const XR = (v: number) => cx + gap / 2 + (v / top) * half;
    geo = { top: T, rowHeight: rh, center: cx };
    const lab = labels();

    ticks.forEach((v) => {
      vline(ctx, XL(v), T, B, hairlineSoft, 1);
      vline(ctx, XR(v), T, B, hairlineSoft, 1);
      if (narrow && v % 2) return;
      txt(ctx, `${v}%`, XL(v), B + 16, `500 10.5px ${num}`, muted, "center");
      txt(ctx, `${v}%`, XR(v), B + 16, `500 10.5px ${num}`, muted, "center");
    });
    txt(ctx, lab.men, XL(0) - 2, T - 12, `600 12px ${ui}`, ink, "right");
    txt(ctx, lab.women, XR(0) + 2, T - 12, `600 12px ${ui}`, ink, "left");

    for (let r = 0; r < n; r++) {
      const i = flip(r);
      const y = T + r * rh + 1;
      // The youngest rows grow first.
      const k = easeOut(clamp(state.p * 1.5 - (i / n) * 0.5, 0, 1));
      const m = shares.men[i] * k;
      const f = shares.women[i] * k;
      ctx.globalAlpha = state.hover >= 0 && state.hover !== i ? 0.35 : 1;
      ctx.fillStyle = SEX_COLORS.men;
      hbar(ctx, XL(m), y, XL(0) - XL(m), bh, 3, "left");
      ctx.fillStyle = SEX_COLORS.women;
      hbar(ctx, XR(0), y, XR(f) - XR(0), bh, 3, "right");
      ctx.globalAlpha = 1;
      const on = i === state.hover;
      txt(ctx, ages[i], cx, y + bh / 2 + 0.5, `${on ? 600 : 500} 10.5px ${num}`, on ? ink : muted, "center", "middle");
    }

    const outline = clamp((state.p - 0.55) / 0.45, 0, 1);
    if (outline > 0) {
      ctx.save();
      ctx.globalAlpha = outline;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "miter";
      for (const [values, X] of [
        [shares.baseMen, XL],
        [shares.baseWomen, XR],
      ] as const) {
        ctx.beginPath();
        for (let r = 0; r < n; r++) {
          const x = X(values[flip(r)]);
          const y0 = T + r * rh;
          if (r) ctx.lineTo(x, y0);
          else ctx.moveTo(x, y0);
          ctx.lineTo(x, y0 + rh);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    if (state.p >= 1 && oldRows) {
      const xr = R - (narrow ? 0 : 12);
      // haloTxt sets an alphabetic baseline: +4 centres the 11-12px text on the row.
      haloTxt(ctx, `65+ — ${formatShare(data.oldShare.share)}`, xr, T + rh * 0.5 + 4, `600 12px ${num}`, ink, paper, "right");
      haloTxt(ctx, `${lab.then} — ${formatShare(data.oldShareBase.share)}`, xr, T + rh * 1.5 + 6, `500 11px ${num}`, muted, paper, "right");
      if (!narrow) {
        const y1 = T + 2;
        const y2 = T + rh * oldRows - 2;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(R - 6, y1);
        ctx.lineTo(R - 1.5, y1);
        ctx.lineTo(R - 1.5, y2);
        ctx.lineTo(R - 6, y2);
        ctx.stroke();
      }
    }
  };

  return createChartCore(wrap, canvas, {
    duration: 1500,
    draw,
    hit: (_x, y) => {
      if (!geo) return -1;
      const r = Math.floor((y - geo.top) / geo.rowHeight);
      return r >= 0 && r < n ? flip(r) : -1;
    },
    onHover: (i) => {
      if (geo) onHover(i, geo.center, geo.top + (flip(i) + 0.5) * geo.rowHeight);
    },
    onLeave,
  });
}
