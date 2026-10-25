import type { AgeingChapter } from "../../../lib/landing/chapters/types";
import { clamp, MIGRATION_COLORS, readTokens } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { bar, easeOut, haloTxt, hline, txt } from "./chart-draw";
import { signedCount } from "./chart-format";
import { barSlots, slotIndexAt } from "./chart-layout";

// The canvas engine of chapter 06's net migration bars, loaded only once the card nears the viewport
// (migration-chart.tsx). Teal above zero, accent below; the largest and smallest years are annotated and the
// first and last years named under the axis. Ported from the design board's createMig.

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  data: AgeingChapter["migration"];
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

export function createMigration({ wrap, canvas, data, onHover, onLeave }: EngineOptions) {
  const { paper, ink, accent, muted, num } = readTokens(wrap);

  const { years, net } = data;
  const n = net.length;
  // Headroom past the extremes for their labels: above the highest bar, below the lowest.
  const hi = Math.max(0, ...net) * 1.1;
  const lo = Math.min(0, ...net) * 1.15;
  const span = hi - lo || 1;
  const high = net.indexOf(Math.max(...net));
  const low = net.indexOf(Math.min(...net));

  let geo: { left: number; slot: number; center(i: number): number; top: number; height: number } | null = null;

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const L = 2;
    const R = state.W - 2;
    const T = 16;
    const B = state.H - 18;
    const w = Math.max(1, R - L);
    const h = Math.max(1, B - T);
    const slots = barSlots(L, w, n);
    const cw = Math.max(3, Math.min(22, slots.slot * 0.64));
    const Y = (v: number) => T + ((hi - v) / span) * h;
    const y0 = Y(0);
    geo = { left: L, slot: slots.slot, center: slots.center, top: T, height: h };

    for (let i = 0; i < n; i++) {
      const v = net[i] * easeOut(clamp(state.p * 1.6 - (i / n) * 0.6, 0, 1));
      ctx.globalAlpha = state.hover >= 0 && state.hover !== i ? 0.3 : 1;
      ctx.fillStyle = net[i] >= 0 ? MIGRATION_COLORS.arrivals : accent;
      const x = slots.center(i) - cw / 2;
      if (v >= 0) bar(ctx, x, Y(v), cw, y0 - Y(v), 2, "top");
      else bar(ctx, x, y0, cw, Y(v) - y0, 2, "bottom");
    }
    ctx.globalAlpha = 1;
    hline(ctx, L, R, y0, ink, 1);
    if (state.p >= 1) {
      haloTxt(ctx, signedCount(net[high]), slots.center(high), Y(net[high]) - 5, `600 10.5px ${num}`, ink, paper, "center");
      haloTxt(ctx, signedCount(net[low]), slots.center(low), Y(net[low]) + 12, `600 10.5px ${num}`, ink, paper, "center");
    }
    txt(ctx, String(years[0]), L, state.H - 2, `500 10.5px ${num}`, muted, "left");
    txt(ctx, String(years[n - 1]), R, state.H - 2, `500 10.5px ${num}`, muted, "right");
  };

  return createChartCore(wrap, canvas, {
    duration: 1100,
    draw,
    hit: (x) => (geo ? slotIndexAt(x, geo.left, geo.slot, n) : -1),
    onHover: (i) => {
      if (geo) onHover(i, geo.center(i), geo.top + geo.height * 0.3);
    },
    onLeave,
  });
}
