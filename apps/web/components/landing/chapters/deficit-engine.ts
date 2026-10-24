import { formatPoints } from "../../../lib/explorer/format";
import type { DeficitChapter } from "../../../lib/landing/chapters/types";
import { clamp, readTokens } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { bar, easeOut, haloTxt, hline, txt, vline } from "./chart-draw";
import { points } from "./chart-format";
import { barSlots, DEFICIT_RULE_PCT, deficitScale, fiveYearIndices, slotIndexAt, valueY, yearRange } from "./chart-layout";
import type { DeficitLabels } from "./deficit-chart";

// The canvas engine of chapter 05's bars, loaded only once the chapter nears the viewport (deficit-chart.tsx).
// Deficits ink, surpluses green, projection years in a shaded band; a dashed accent line marks the -3% rule, and the
// deepest deficit, an earlier one and the longest surplus run are annotated. Ported from the design board's createDef.

const RULE_TEXT = points(DEFICIT_RULE_PCT, 0);

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  data: DeficitChapter;
  labels(): DeficitLabels;
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

export function createDeficit({ wrap, canvas, data, labels, onHover, onLeave }: EngineOptions) {
  const { paper, ink, accent, positive, body, muted, hairline, hairlineSoft, ui, num } = readTokens(wrap);

  const { years, pctGdp } = data;
  const n = years.length;
  const { lo, hi, ticks } = deficitScale(pctGdp);
  const projection = data.projectionFrom === null ? -1 : years.indexOf(data.projectionFrom);
  const colorOf = (i: number) => (pctGdp[i] >= 0 ? positive : ink);

  let geo: { left: number; slot: number; center(i: number): number; top: number; height: number } | null = null;

  const frameOf = (W: number, H: number) => {
    const narrow = W < 620;
    const L = 36;
    const R = W - (narrow ? 10 : 46);
    const T = 34;
    const B = H - 28;
    return { narrow, L, R, T, B, w: Math.max(1, R - L), h: Math.max(1, B - T) };
  };

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const { narrow, L, R, T, B, w, h } = frameOf(state.W, state.H);
    const slots = barSlots(L, w, n);
    const Y = (v: number) => valueY(v, lo, hi, T, h);
    const y0 = Y(0);
    geo = { left: L, slot: slots.slot, center: slots.center, top: T, height: h };

    ticks.forEach((v) => {
      hline(ctx, L, R, Y(v), hairlineSoft, 1);
      txt(ctx, formatPoints(v, true, 0) + (v === hi ? "%" : ""), L - 8, Y(v), `500 11px ${num}`, muted, "right", "middle");
    });
    txt(ctx, "0", L - 8, y0, `500 11px ${num}`, muted, "right", "middle");

    if (projection >= 0) {
      const xb = L + slots.slot * projection;
      ctx.fillStyle = "rgba(30,27,22,.035)";
      ctx.fillRect(xb, T - 26, R - xb, B - T + 26);
      vline(ctx, xb, T - 26, B, hairline, 1, [3, 3]);
      const lab = labels().imf;
      ctx.font = `600 11.5px ${ui}`;
      const room = R - xb - 12;
      const text = ctx.measureText(lab).width <= room ? lab : ctx.measureText("IMF").width <= room ? "IMF" : "";
      if (text) txt(ctx, text, xb + 8, T - 12, `600 11.5px ${ui}`, body);
    }

    for (let i = 0; i < n; i++) {
      const v = pctGdp[i] * easeOut(clamp(state.p * 1.7 - (i / n) * 0.7, 0, 1));
      const dim = state.hover >= 0 && state.hover !== i;
      ctx.globalAlpha = (projection >= 0 && i >= projection ? 0.4 : 1) * (dim ? 0.4 : 1);
      ctx.fillStyle = colorOf(i);
      const x = slots.center(i) - slots.bar / 2;
      if (v >= 0) bar(ctx, x, Y(v), slots.bar, y0 - Y(v), 3, "top");
      else bar(ctx, x, y0, slots.bar, Y(v) - y0, 3, "bottom");
      ctx.globalAlpha = 1;
    }
    hline(ctx, L, R, y0, ink, 1);
    hline(ctx, L, R, Y(DEFICIT_RULE_PCT), accent, 1.5, [5, 4]);
    if (!narrow) txt(ctx, RULE_TEXT, R + 8, Y(DEFICIT_RULE_PCT), `600 11.5px ${num}`, accent, "left", "middle");
    else haloTxt(ctx, RULE_TEXT, L + 4, Y(DEFICIT_RULE_PCT) - 8, `600 11px ${num}`, accent, paper);
    fiveYearIndices(years).forEach((i) => txt(ctx, String(years[i]), slots.center(i), B + 18, `500 11px ${num}`, muted, "center"));

    if (state.p >= 1) {
      const lab = labels();
      const note = (year: number, text: string) => {
        const i = years.indexOf(year);
        if (i < 0) return;
        const v = pctGdp[i];
        haloTxt(ctx, text, slots.center(i), v >= 0 ? Y(v) - 8 : Y(v) + 16, `600 11.5px ${num}`, ink, paper, "center");
      };
      note(data.deepest.year, `${points(data.deepest.pct)} · ${data.deepest.year}`);
      if (data.earlier) note(data.earlier.year, points(data.earlier.pct));
      const run = data.surplusRun;
      const first = run ? years.indexOf(run.first) : -1;
      const last = run ? years.indexOf(run.last) : -1;
      if (run && first >= 0 && last >= 0) {
        const a = slots.center(first) - slots.bar / 2;
        const b = slots.center(last) + slots.bar / 2;
        const yb = Y(hi) - 2;
        ctx.strokeStyle = positive;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a, yb + 5);
        ctx.lineTo(a, yb);
        ctx.lineTo(b, yb);
        ctx.lineTo(b, yb + 5);
        ctx.stroke();
        haloTxt(ctx, `${lab.surplus} · ${yearRange(run.first, run.last)}`, (a + b) / 2, yb - 7, `600 11.5px ${ui}`, positive, paper, "center");
      }
    }
  };

  return createChartCore(wrap, canvas, {
    duration: 1400,
    draw,
    hit: (x) => (geo ? slotIndexAt(x, geo.left, geo.slot, n) : -1),
    onHover: (i) => {
      if (geo) onHover(i, geo.center(i), geo.top + geo.height * 0.25);
    },
    onLeave,
  });
}
