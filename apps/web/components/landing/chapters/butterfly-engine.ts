import type { TradeChapter } from "../../../lib/landing/chapters/types";
import type { ButterflyLabels } from "./butterfly-chart";
import { clamp, readTokens, TRADE_COLORS, twoLineWidth, wrapLines } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { easeOut, hbar, txt, vline } from "./chart-draw";
import { billions } from "./chart-format";
import { partnerNameColumn, partnersAxisTop, toBillions, TRADE_NARROW_WIDTH } from "./chart-layout";

// The canvas engine of chapter 09's partners chart, loaded only once the chart nears the viewport (butterfly-chart.tsx).
// One row per partner, largest turnover first: exports grow left and imports right from a column holding the country
// name (wide enough for the longest; a longer one wraps), in billions of dollars, each bar with its value once drawn in. Ported from the design board's createBfly.

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  partners: TradeChapter["partners"];
  labels(): ButterflyLabels;
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

export function createButterfly({ wrap, canvas, partners, labels, onHover, onLeave }: EngineOptions) {
  const { ink, body, muted, hairlineSoft, ui, num } = readTokens(wrap);

  const n = partners.length;
  const top = partnersAxisTop(Math.max(...partners.flatMap((partner) => [toBillions(partner.exportsUsd), toBillions(partner.importsUsd)])));
  const ticks = Array.from({ length: top }, (_, i) => i + 1);

  let geo: { top: number; rowHeight: number; XR(v: number): number } | null = null;

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const narrow = state.W < TRADE_NARROW_WIDTH;
    const L = 2;
    const R = state.W - 2;
    // The name column fits the longest name at the hover weight, over two lines when narrow (see partnerNameColumn).
    const nameSize = narrow ? 11 : 12;
    ctx.font = `600 ${nameSize}px ${ui}`;
    const nameWidth = (label: string) => (narrow ? twoLineWidth(ctx, label) : ctx.measureText(label).width);
    const gap = partnerNameColumn(Math.max(...partners.map((partner) => nameWidth(partner.label))), R - L, narrow);
    const T = 30;
    const B = state.H - 24;
    const cx = Math.round(L + (R - L) / 2);
    const half = (R - L) / 2 - gap / 2 - (narrow ? 34 : 42);
    const rowHeight = (B - T) / n;
    const barHeight = Math.max(6, Math.min(18, rowHeight - 10));
    const XL = (v: number) => cx - gap / 2 - (v / top) * half;
    const XR = (v: number) => cx + gap / 2 + (v / top) * half;
    geo = { top: T, rowHeight, XR };

    for (const v of ticks) {
      vline(ctx, XL(v), T, B, hairlineSoft, 1);
      vline(ctx, XR(v), T, B, hairlineSoft, 1);
      txt(ctx, String(v), XL(v), B + 16, `500 11px ${num}`, muted, "center");
      txt(ctx, String(v), XR(v), B + 16, `500 11px ${num}`, muted, "center");
    }
    vline(ctx, XL(0), T, B, ink, 1);
    vline(ctx, XR(0), T, B, ink, 1);
    const lab = labels();
    txt(ctx, lab.exportsHead, XL(0), T - 12, `600 11.5px ${ui}`, body, "right");
    txt(ctx, lab.importsHead, XR(0), T - 12, `600 11.5px ${ui}`, body, "left");

    partners.forEach((partner, i) => {
      const yc = T + (i + 0.5) * rowHeight;
      const k = easeOut(clamp(state.p * 1.5 - (i / n) * 0.5, 0, 1));
      const hover = state.hover === i;
      const [exp, imp] = [toBillions(partner.exportsUsd), toBillions(partner.importsUsd)];
      ctx.globalAlpha = state.hover >= 0 && !hover ? 0.35 : 1;
      ctx.fillStyle = TRADE_COLORS.exports;
      hbar(ctx, XL(exp * k), yc - barHeight / 2, XL(0) - XL(exp * k), barHeight, 4, "left");
      ctx.fillStyle = TRADE_COLORS.imports;
      hbar(ctx, XR(0), yc - barHeight / 2, XR(imp * k) - XR(0), barHeight, 4, "right");
      const font = `${hover ? 600 : 500} ${nameSize}px ${ui}`;
      ctx.font = font;
      // A name too long for the column wraps onto two lines, both in the row's weight.
      const lines = wrapLines(ctx, partner.label, gap - 4);
      lines.forEach((line, k) => txt(ctx, line, cx, yc + (k - (lines.length - 1) / 2) * (nameSize + 2), font, ink, "center", "middle"));
      if (state.p >= 1) {
        txt(ctx, billions(partner.exportsUsd, 2), XL(exp) - 6, yc, `500 11px ${num}`, muted, "right", "middle");
        txt(ctx, billions(partner.importsUsd, 2), XR(imp) + 6, yc, `500 11px ${num}`, muted, "left", "middle");
      }
      ctx.globalAlpha = 1;
    });
  };

  return createChartCore(wrap, canvas, {
    duration: 1300,
    draw,
    hit: (_x, y) => {
      if (!geo) return -1;
      const i = Math.floor((y - geo.top) / geo.rowHeight);
      return i >= 0 && i < n ? i : -1;
    },
    onHover: (i) => {
      if (geo) onHover(i, geo.XR(toBillions(partners[i].importsUsd)), geo.top + (i + 0.5) * geo.rowHeight);
    },
    onLeave,
  });
}
