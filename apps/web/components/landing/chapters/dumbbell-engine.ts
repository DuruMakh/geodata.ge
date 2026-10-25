import { formatInUnit, formatShare, UNIT_PERSONS } from "../../../lib/explorer/format";
import type { WageGapChapter } from "../../../lib/landing/chapters/types";
import { clamp, fitText, readTokens, SEX_COLORS } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { dot, easeOut, txt, vline } from "./chart-draw";
import { DUMBBELL_NARROW_WIDTH, dumbbellHeight, wagesAxisTop } from "./chart-layout";

// The canvas engine of chapter 08's wages chart, loaded only once the chart nears the viewport (dumbbell-chart.tsx).
// One row per sector, highest average first: a line between the women's and the men's dot, a tick at the average,
// and women's wage as a share of men's at the right edge once drawn in. Names sit left of the rows, or above them
// below 640 px, and the engine sets the wrapper's height from the number of rows. Ported from createDumb.

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  sectors: WageGapChapter["sectors"];
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

export function createDumbbell({ wrap, canvas, sectors, onHover, onLeave }: EngineOptions) {
  const { paper, ink, muted, hairline, hairlineSoft, ui, num } = readTokens(wrap);

  const n = sectors.length;
  const top = wagesAxisTop(Math.max(...sectors.flatMap((sector) => [sector.women, sector.men])));
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += 2000) ticks.push(v);
  const grouped = (v: number) => formatInUnit(v, UNIT_PERSONS);

  let geo: { top: number; rowHeight: number; X(v: number): number } | null = null;

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const narrow = state.W < DUMBBELL_NARROW_WIDTH;
    const need = dumbbellHeight(n, narrow);
    // The wrapper takes the height the rows need; the resize that follows draws again.
    if (Math.abs(state.H - need) > 1) {
      wrap.style.height = `${need}px`;
      return;
    }
    const rowHeight = narrow ? 44 : 27;
    const labelWidth = narrow ? 0 : 228;
    const L = labelWidth + (narrow ? 1 : 10);
    const R = state.W - 48;
    const T = 8;
    const B = T + n * rowHeight;
    const X = (v: number) => L + (v / top) * (R - L);
    geo = { top: T, rowHeight, X };

    for (const v of ticks) {
      vline(ctx, X(v), T, B, v ? hairlineSoft : ink, 1);
      txt(ctx, grouped(v) + (v === top ? " ₾" : ""), X(v), B + 16, `500 11px ${num}`, muted, v ? "center" : "left");
    }

    sectors.forEach((sector, i) => {
      const hover = state.hover === i;
      const yTop = T + i * rowHeight;
      const yc = yTop + (narrow ? rowHeight - 12 : rowHeight / 2);
      const k = easeOut(clamp(state.p * 1.5 - (i / n) * 0.5, 0, 1));
      const font = `${hover ? 600 : 500} ${narrow ? 11.5 : 12}px ${ui}`;
      ctx.globalAlpha = state.hover >= 0 && !hover ? 0.35 : 1;
      ctx.font = font;
      if (narrow) txt(ctx, fitText(ctx, sector.label, state.W - L - 16), L + 8, yTop + 12, font, ink, "left", "middle");
      else txt(ctx, fitText(ctx, sector.label, labelWidth - 4), labelWidth, yc, font, ink, "right", "middle");
      const xWomen = X(sector.women * k);
      const xMen = X(sector.men * k);
      ctx.save();
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Math.min(xWomen, xMen), yc);
      ctx.lineTo(Math.max(xWomen, xMen), yc);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = ink;
      ctx.fillRect(Math.round(X(sector.average * k)) - 1, yc - 7, 2, 14);
      // The dot of whoever earns more goes on top.
      if (sector.women > sector.men) {
        dot(ctx, xMen, yc, 5, SEX_COLORS.men, paper);
        dot(ctx, xWomen, yc, 5, SEX_COLORS.women, paper);
      } else {
        dot(ctx, xWomen, yc, 5, SEX_COLORS.women, paper);
        dot(ctx, xMen, yc, 5, SEX_COLORS.men, paper);
      }
      if (state.p >= 1) txt(ctx, formatShare(sector.women / sector.men, false, 0), state.W, yc, `600 11.5px ${num}`, ink, "right", "middle");
      ctx.globalAlpha = 1;
    });
  };

  return createChartCore(wrap, canvas, {
    duration: 1400,
    draw,
    hit: (_x, y) => {
      if (!geo) return -1;
      const i = Math.floor((y - geo.top) / geo.rowHeight);
      return i >= 0 && i < n ? i : -1;
    },
    onHover: (i) => {
      if (geo) onHover(i, geo.X(Math.max(sectors[i].women, sectors[i].men)), geo.top + (i + 0.5) * geo.rowHeight);
    },
    onLeave,
  });
}
