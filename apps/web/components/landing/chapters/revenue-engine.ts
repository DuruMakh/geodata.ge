import { formatInUnit, formatShare, UNIT_BN, wholePercents } from "../../../lib/explorer/format";
import type { RevenueSeries } from "../../../lib/landing/chapters/types";
import { fitText, mixHex, niceTicks, readTokens, revenueBandColor, stackLabels } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { dot, easeOut, haloTxt, hline, txt, vline } from "./chart-draw";
import { money } from "./chart-format";
import { plannedRuns, plannedSpan, pointIndexAt, revenuePads, yearLabelIndices } from "./chart-layout";
import type { RevenueLabels } from "./revenue-chart";

// The canvas engine of chapter 03's stacked areas, loaded only once the chapter nears the viewport
// (revenue-chart.tsx). Planned years are hatched; the year of peak borrowing gets a callout and the latest year labels
// each band on the right. Ported from the design board's createRev.

const HATCH_GAP = 7;

export type Engine = { colors: string[]; destroy(): void };

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  data: RevenueSeries;
  labels(): RevenueLabels;
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

export function createRevenue({ wrap, canvas, data, labels, onHover, onLeave }: EngineOptions): Engine {
  const { paper, ink, accent, body, muted, hairline, hairlineSoft, ui, num } = readTokens(wrap);

  const { years, bands, totals, planned } = data;
  const n = years.length;
  const lastBand = bands.length - 1;
  const colors = bands.map((band) => revenueBandColor(band.id, accent));
  const topLine = mixHex(accent, "#000000", 0.2); // the liabilities band's outline, a darker accent
  const axis = niceTicks(Math.max(...totals) / 1e9, 7);
  const tickDecimals = Number.isInteger(axis.step) ? 0 : 1;
  const peak = data.peakBorrowing ? years.indexOf(data.peakBorrowing.year) : -1;

  let geo: { top: number; height: number; x(i: number): number } | null = null;

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const wide = state.W >= 620;
    const pad = revenuePads(state.W);
    const L = pad[3];
    const R = state.W - pad[1];
    const T = pad[0];
    const B = state.H - pad[2];
    const w = Math.max(1, R - L);
    const h = Math.max(1, B - T);
    const X = (i: number) => L + (n > 1 ? i / (n - 1) : 0.5) * w;
    const Y = (gel: number) => B - (gel / 1e9 / axis.top) * h;
    geo = { top: T, height: h, x: X };

    axis.ticks.forEach((v) => {
      const yy = B - (v / axis.top) * h;
      if (v !== 0) hline(ctx, L, R, yy, hairlineSoft, 1);
      txt(ctx, formatInUnit(v * 1e9, { ...UNIT_BN, decimals: tickDecimals }), L - 8, yy, `500 11px ${num}`, muted, "right", "middle");
    });
    const picks = yearLabelIndices(n);
    picks.forEach((i, k) => {
      const align = k === 0 ? "left" : i === n - 1 ? "right" : "center";
      txt(ctx, String(years[i]), X(i), B + 18, `500 11px ${num}`, muted, align);
    });

    const k = easeOut(state.p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L - 2, T - 30, w * k + 4, h + 40);
    ctx.clip();
    const cum = years.map(() => 0);
    const tops: number[][] = [];
    bands.forEach((band, bi) => {
      const lo = cum.slice();
      years.forEach((_, i) => {
        cum[i] += band.values[i] ?? 0;
      });
      tops.push(cum.slice());
      ctx.beginPath();
      ctx.moveTo(X(0), Y(lo[0]));
      for (let i = 0; i < n; i++) ctx.lineTo(X(i), Y(cum[i]));
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(X(i), Y(lo[i]));
      ctx.closePath();
      ctx.fillStyle = colors[bi];
      ctx.globalAlpha = state.hover >= 0 ? 0.92 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // Planned years: paper-coloured diagonal hatching over the stack, from the actual year before.
    for (const run of plannedRuns(planned)) {
      const [from, to] = plannedSpan(run);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(X(from), B);
      for (let i = from; i <= to; i++) ctx.lineTo(X(i), Y(tops[lastBand][i]));
      ctx.lineTo(X(to), B);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = paper;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x0 = X(from) - h; x0 < X(to); x0 += HATCH_GAP) {
        ctx.moveTo(x0, B);
        ctx.lineTo(x0 + h + 30, T - 30);
      }
      ctx.stroke();
      ctx.restore();
    }
    const trace = (values: number[]) => {
      ctx.beginPath();
      values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    };
    for (let bi = 0; bi < lastBand; bi++) {
      trace(tops[bi]);
      ctx.strokeStyle = paper;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    trace(tops[lastBand]);
    ctx.strokeStyle = topLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    hline(ctx, L, R, B, ink, 1);

    if (state.p >= 1) {
      const lab = labels();
      if (peak >= 0 && data.peakBorrowing) {
        const xx = X(peak);
        const yTop = Y(tops[lastBand][peak]);
        const shift = Math.max(0, 14 - (yTop - 52)); // keep the callout inside the canvas when the stack is tall there
        const align = wide ? "center" : "right";
        const ax = wide ? xx : xx + 10;
        vline(ctx, xx, yTop - 30 + shift, yTop - 4, ink, 1);
        haloTxt(ctx, `${years[peak]} · ${formatShare(data.peakBorrowing.share, false, 0)}`, ax, yTop - 52 + shift, `600 12.5px ${ui}`, ink, paper, align);
        haloTxt(ctx, lab.peakFrom, ax, yTop - 36 + shift, `500 11.5px ${ui}`, body, paper, align);
      }
      const mids = bands.map((_, bi) => Y(((bi ? tops[bi - 1][n - 1] : 0) + tops[bi][n - 1]) / 2));
      const ys = stackLabels(mids, wide ? 30 : 15, T + (wide ? 12 : 6), B - 2);
      const lx = R + (wide ? 14 : 8);
      // Phone labels show whole percentages; rounded together they add up to 100 over the labelled bands.
      const labelled = bands.flatMap((band, bi) => (band.values[n - 1] === null ? [] : [bi]));
      const whole = wholePercents(labelled.map((bi) => bands[bi].values[n - 1]!));
      bands.forEach((band, bi) => {
        const v = band.values[n - 1];
        if (v === null) return;
        const yy = ys[bi];
        const sh = totals[n - 1] > 0 ? v / totals[n - 1] : 0;
        ctx.strokeStyle = hairline;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(R + 3, mids[bi]);
        ctx.lineTo(lx - 4, yy);
        ctx.stroke();
        ctx.fillStyle = colors[bi];
        if (wide) {
          ctx.fillRect(lx, yy - 13, 9, 9);
          const room = state.W - (lx + 15) - 6;
          ctx.font = `600 12px ${ui}`;
          txt(ctx, fitText(ctx, band.label, room), lx + 15, yy - 5, `600 12px ${ui}`, ink);
          ctx.font = `500 11px ${num}`;
          txt(ctx, fitText(ctx, `${money(v, lab)} · ${formatShare(sh)}`, room), lx + 15, yy + 11, `500 11px ${num}`, muted);
        } else {
          ctx.fillRect(lx, yy - 3.5, 7, 7);
          txt(ctx, formatShare(whole[labelled.indexOf(bi)] / 100, false, 0), lx + 10, yy, `600 11px ${num}`, ink, "left", "middle");
        }
      });
    }

    if (state.hover >= 0) {
      const xx = X(state.hover);
      vline(ctx, xx, T - 6, B, ink, 1);
      tops.forEach((t, bi) => dot(ctx, xx, Y(t[state.hover]), 3, colors[bi], paper));
    }
  };

  const core = createChartCore(wrap, canvas, {
    duration: 1500,
    draw,
    hit: (x, y) => {
      if (!geo || y < geo.top - 20 || y > geo.top + geo.height + 4) return -1;
      const pad = revenuePads(wrap.clientWidth);
      return pointIndexAt(x, pad[3], Math.max(1, wrap.clientWidth - pad[1] - pad[3]), n, 10);
    },
    onHover: (i) => {
      if (geo) onHover(i, geo.x(i), geo.top + geo.height * 0.38);
    },
    onLeave,
  });
  return { colors, destroy: core.destroy };
}
