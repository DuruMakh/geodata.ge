"use client";

import { useEffect, useRef } from "react";
import { formatInUnit, formatShare, UNIT_BN } from "../../../lib/explorer/format";
import type { RevenueBandId, RevenueSeries } from "../../../lib/landing/chapters/types";
import { fitText, mixHex, niceTicks, readTokens, stackLabels } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { dot, easeOut, haloTxt, hline, txt, vline } from "./chart-draw";
import { money } from "./chart-format";
import { plannedRuns, plannedSpan, pointIndexAt, revenuePads, yearLabelIndices, yearRange } from "./chart-layout";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { plannedYearText, revenueTip } from "./chart-tips";
import { Reveal, useNearViewport } from "./reveal";

// Chapter 03: consolidated-budget receipts as a stacked area, one band per revenue group. Planned
// years are hatched; the year of peak borrowing gets a callout and the latest year labels each band on
// the right. Ported from the design board's createRev.

export type RevenueLabels = {
  title: string; // above the chart: "ნაერთი ბიუჯეტის შემოსულობები, მლრდ ₾"
  bnGel: string; // "მლრდ ₾"
  mlnGel: string; // "მლნ ₾"
  planned: string; // suffix after a planned year, and the legend entry for the hatching: "გეგმა"
  total: string; // tooltip foot lead: "სულ"
  taxes: string; // tooltip foot and aria-label: "გადასახადები"
  peakFrom: string; // callout second line under "2020 · 29%": "ვალდებულებების ზრდიდან"
  chartSummary: string; // canvas aria-label lead: "ნაერთი ბიუჯეტის შემოსულობები"
};

// Fixed by the homepage plan; liabilities take the accent token.
const BAND_COLORS: Record<Exclude<RevenueBandId, "liabilities">, string> = {
  vat: "#28568e",
  income: "#50aed5",
  profit: "#007f69",
  excise: "#83c084",
  otherTaxes: "#7668ad",
  otherIncome: "#d2ab5f",
};
const HATCH_GAP = 7;

const bandColor = (id: RevenueBandId, accent: string) => (id === "liabilities" ? accent : BAND_COLORS[id]);

type Engine = { colors: string[]; destroy(): void };

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  data: RevenueSeries;
  labels(): RevenueLabels;
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

function createRevenue({ wrap, canvas, data, labels, onHover, onLeave }: EngineOptions): Engine {
  const { paper, ink, accent, body, muted, hairline, hairlineSoft, ui, num } = readTokens(wrap);

  const { years, bands, totals, planned } = data;
  const n = years.length;
  const lastBand = bands.length - 1;
  const colors = bands.map((band) => bandColor(band.id, accent));
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
          txt(ctx, formatShare(sh, false, 0), lx + 10, yy, `600 10.5px ${num}`, ink, "left", "middle");
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

export function RevenueChart({ data, labels }: { data: RevenueSeries; labels: RevenueLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ data, labels });
  useEffect(() => {
    live.current = { data, labels };
  });

  const near = useNearViewport(wrapRef);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!near || !wrap || !canvas || !tip) return;
    const engine = createRevenue({
      wrap,
      canvas,
      data,
      labels: () => live.current.labels,
      onHover(index, x, y) {
        const { data: d, labels: lab } = live.current;
        showTip(tip, revenueTip(d, lab, engine.colors, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [near, data]);

  const last = data.years.length - 1;
  const hasPlanned = data.planned.some(Boolean);
  const ariaLabel =
    `${labels.chartSummary} ${yearRange(data.years[0], data.years[last])}: ${data.bands.map((band) => band.label).join(", ")}; ` +
    `${plannedYearText(data, last, labels.planned)}: ${money(data.totals[last], labels)}, ${labels.taxes} ${formatShare(data.taxShare[last], false, 0)}`;

  return (
    <Reveal className="mt-8">
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            {data.bands.map((band) => (
              <li key={band.id} data-band={band.id} className="inline-flex items-center gap-[7px]">
                <i
                  aria-hidden="true"
                  style={{ background: bandColor(band.id, "var(--accent)") }}
                  className="inline-block h-2.5 w-2.5 flex-none rounded-[2px]"
                />
                {band.label}
              </li>
            ))}
            {hasPlanned && (
              <li data-band="planned" className="inline-flex items-center gap-[7px]">
                <i
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 flex-none rounded-[2px] [background:repeating-linear-gradient(135deg,var(--paper)_0_1.5px,transparent_1.5px_4px),var(--control)]"
                />
                {labels.planned}
              </li>
            )}
          </ul>
        </figcaption>
        <div ref={wrapRef} className="relative h-[360px] w-full min-[768px]:h-[420px]">
          <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />
          <ChartTip tipRef={tipRef} rows={data.bands.length} />
        </div>
      </figure>
    </Reveal>
  );
}
