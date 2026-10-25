import type { YouthJobsChapter } from "../../../lib/landing/chapters/types";
import { clamp, fitText, readTokens } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { dot, easeOut, haloTxt, txt, vline } from "./chart-draw";
import { points } from "./chart-format";
import { REGIONS_NARROW_WIDTH, regionsAxisTop, regionsHeight } from "./chart-layout";

// The canvas engine of chapter 07's regions chart, loaded only once the chart nears the viewport (regions-chart.tsx).
// One row per region (longest first): a hairline from zero to the rate ending in a dot, with the rate after it; the
// names sit left of the rows, or above them below 560 px. A dashed accent line marks the rate of Georgia, and the
// engine sets the wrapper's height from the number of rows. Ported from the design board's createReg.

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  regions: YouthJobsChapter["regions"];
  national: number;
  /** The line's label: "საქართველო · 13.9%". */
  nationalLabel(): string;
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

export function createRegions({ wrap, canvas, regions, national, nationalLabel, onHover, onLeave }: EngineOptions) {
  const { paper, ink, accent, muted, control, hairlineSoft, ui, num } = readTokens(wrap);

  const n = regions.length;
  const top = regionsAxisTop(Math.max(...regions.map((region) => region.rate)));
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += 5) ticks.push(v);

  let geo: { top: number; rowHeight: number; X(v: number): number } | null = null;

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const narrow = state.W < REGIONS_NARROW_WIDTH;
    const need = regionsHeight(n, narrow);
    // The wrapper takes the height the rows need; the resize that follows draws again.
    if (Math.abs(state.H - need) > 1) {
      wrap.style.height = `${need}px`;
      return;
    }
    const rowHeight = narrow ? 40 : 28;
    const labelWidth = narrow ? 0 : 214;
    const L = labelWidth + (narrow ? 1 : 10);
    const R = state.W - 46;
    const T = 30;
    const B = T + n * rowHeight;
    const X = (v: number) => L + (v / top) * (R - L);
    geo = { top: T, rowHeight, X };

    for (const v of ticks) {
      vline(ctx, X(v), T - 4, B, v ? hairlineSoft : ink, 1);
      txt(ctx, v === top ? `${v}%` : String(v), X(v), B + 16, `500 11px ${num}`, muted, v ? "center" : "left");
    }
    vline(ctx, X(national), T - 14, B, accent, 1.5, [4, 3]);
    haloTxt(ctx, nationalLabel(), X(national) + 6, T - 16, `600 11px ${ui}`, ink, paper, "left", "middle");

    regions.forEach((region, i) => {
      const hover = state.hover === i;
      const v = region.rate * easeOut(clamp(state.p * 1.5 - (i / n) * 0.5, 0, 1));
      const yc = T + i * rowHeight + (narrow ? rowHeight - 10 : rowHeight / 2);
      const font = `${hover ? 600 : 500} ${narrow ? 11.5 : 12}px ${ui}`;
      ctx.font = font;
      if (narrow) txt(ctx, region.label, L + 8, T + i * rowHeight + 11, font, ink, "left", "middle");
      else txt(ctx, fitText(ctx, region.label, labelWidth - 4), labelWidth, yc, font, ink, "right", "middle");
      ctx.strokeStyle = hover ? ink : control;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(0), yc);
      ctx.lineTo(X(v), yc);
      ctx.stroke();
      dot(ctx, X(v), yc, 5, hover ? accent : ink, paper);
      if (state.p >= 1) {
        haloTxt(ctx, points(region.rate), X(region.rate) + 10, yc, `600 11.5px ${num}`, ink, paper, "left", "middle");
      }
    });
  };

  return createChartCore(wrap, canvas, {
    duration: 1200,
    draw,
    hit: (_x, y) => {
      if (!geo) return -1;
      const i = Math.floor((y - geo.top) / geo.rowHeight);
      return i >= 0 && i < n ? i : -1;
    },
    onHover: (i) => {
      if (geo) onHover(i, geo.X(regions[i].rate), geo.top + (i + 0.5) * geo.rowHeight);
    },
    onLeave,
  });
}
