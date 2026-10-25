import type { TradeChapter } from "../../../lib/landing/chapters/types";
import { clamp, niceTicks, readTokens, rgb, stackLabels, TRADE_COLORS } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { dot, easeOut, haloTxt, hline, txt, vline } from "./chart-draw";
import { decimals } from "./chart-format";
import { deficitFloor, pointIndexAt, toBillions, tradeYearTicks, widestDeficitIndex } from "./chart-layout";
import type { TradeLinesLabels } from "./trade-lines-chart";

// The canvas engine of chapter 09's exports and imports lines, loaded only once the chart nears the viewport
// (trade-lines-chart.tsx). Two lines in billions of dollars with the gap between them shaded as the deficit, labelled
// where it is widest (only the years in which imports exceed exports), and each line's latest value at the right. Ported from the design board's createTradeLines
// (and createLines, which it is built on).

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  data: Pick<TradeChapter, "years" | "exports" | "imports">;
  labels(): TradeLinesLabels;
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

const NARROW_WIDTH = 600;
const LABEL_CLEARANCE = 30;

export function createTradeLines({ wrap, canvas, data, labels, onHover, onLeave }: EngineOptions) {
  const { paper, ink, accent, body, muted, hairlineSoft, ui, num } = readTokens(wrap);

  const n = data.years.length;
  const exp = data.exports.map(toBillions);
  const imp = data.imports.map(toBillions);
  const { top: hi, ticks } = niceTicks(Math.max(...exp, ...imp), 4);
  const yearTicks = tradeYearTicks(data.years);
  const widest = widestDeficitIndex(exp, imp);
  const floor = deficitFloor(exp, imp);
  const fmt = (v: number) => decimals(v, 1);
  const [accentR, accentG, accentB] = rgb(accent);

  let geo: { L: number; w: number; T: number; h: number; X(i: number): number; Y(v: number): number } | null = null;

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const narrow = state.W < NARROW_WIDTH;
    const lab = labels();
    // Series in drawing order: exports on top of imports.
    const series = [
      { name: lab.imports, v: imp, color: TRADE_COLORS.imports },
      { name: lab.exports, v: exp, color: TRADE_COLORS.exports },
    ];
    let padR = 16;
    if (!narrow) {
      // Room for the widest end label: key, value and name.
      ctx.font = `600 12px ${num}`;
      const valueWidth = Math.max(...series.map((s) => ctx.measureText(fmt(s.v[n - 1])).width));
      ctx.font = `500 11.5px ${ui}`;
      const nameWidth = Math.max(...series.map((s) => ctx.measureText(s.name).width));
      padR = Math.ceil(10 + 15 + valueWidth + 6 + nameWidth + 4);
    }
    const L = 38;
    const R = state.W - padR;
    const T = 22;
    const B = state.H - 28;
    const w = Math.max(1, R - L);
    const h = Math.max(1, B - T);
    const X = (i: number) => L + (i / (n - 1)) * w;
    const Y = (v: number) => T + ((hi - v) / hi) * h;
    geo = { L, w, T, h, X, Y };

    ticks.forEach((v) => {
      if (v) hline(ctx, L, R, Y(v), hairlineSoft, 1);
      txt(ctx, decimals(v, 0), L - 8, Y(v), `500 11px ${num}`, muted, "right", "middle");
    });
    hline(ctx, L, R, Y(0), ink, 1);
    yearTicks.forEach((i) => txt(ctx, String(data.years[i]), X(i), B + 18, `500 11px ${num}`, muted, "center"));

    // The drawing reveals from the left.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, L + w * easeOut(state.p) + 2, state.H);
    ctx.clip();
    ctx.beginPath();
    imp.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(X(i), Y(floor[i]));
    ctx.closePath();
    ctx.fillStyle = `rgba(${accentR},${accentG},${accentB},.14)`;
    ctx.fill();
    for (const s of series) {
      ctx.beginPath();
      s.v.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();

    if (state.p >= 1) {
      if (widest >= 0) {
        // Centred in the gap where it is widest, kept inside the plot and clear of the end labels and the steep
        // last years (the widest gap may be the latest year).
        const font = `600 11px ${ui}`;
        ctx.font = font;
        const half = ctx.measureText(lab.deficit).width / 2 + 6;
        const x = clamp(X(widest), L + half, R - half - LABEL_CLEARANCE);
        const at = ((x - L) / w) * (n - 1);
        const lo = Math.floor(at);
        const hiIndex = Math.min(n - 1, lo + 1);
        const between = (v: number[]) => v[lo] + (v[hiIndex] - v[lo]) * (at - lo);
        haloTxt(ctx, lab.deficit, x, Y((between(imp) + between(exp)) / 2), font, body, paper, "center", "middle");
      }
      // End labels, pushed apart so they never overlap; the one lower on screen goes first.
      const ends = series.map((s) => ({ s, y: Y(s.v[n - 1]) })).sort((a, b) => b.y - a.y);
      const ys = stackLabels(ends.map((end) => end.y), 15, T + 6, B - 6);
      ends.forEach(({ s }, k) => {
        dot(ctx, X(n - 1), Y(s.v[n - 1]), 3.2, s.color, paper);
        const text = fmt(s.v[n - 1]);
        if (narrow) {
          haloTxt(ctx, text, X(n - 1) - 8, ys[k], `600 11px ${num}`, ink, paper, "right", "middle");
          return;
        }
        const x0 = X(n - 1) + 10;
        ctx.fillStyle = s.color;
        ctx.fillRect(x0, Math.round(ys[k]) - 1, 10, 2);
        txt(ctx, text, x0 + 15, ys[k], `600 12px ${num}`, ink, "left", "middle");
        txt(ctx, s.name, x0 + 21 + ctx.measureText(text).width, ys[k], `500 11.5px ${ui}`, muted, "left", "middle");
      });
    }
    if (state.hover >= 0) {
      vline(ctx, X(state.hover), T, B, ink, 1);
      for (const s of series) dot(ctx, X(state.hover), Y(s.v[state.hover]), 4, s.color, paper);
    }
  };

  return createChartCore(wrap, canvas, {
    duration: 1600,
    draw,
    hit: (x) => (geo ? pointIndexAt(x, geo.L, geo.w, n, 8) : -1),
    onHover: (i) => {
      if (geo) onHover(i, geo.X(i), geo.T + geo.h * 0.3);
    },
    onLeave,
  });
}
