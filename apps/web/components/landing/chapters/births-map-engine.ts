import { formatInUnit, UNIT_PERSONS } from "../../../lib/explorer/format";
import type { AgeingChapter, MunicipalChapter } from "../../../lib/landing/chapters/types";
import { placeRatios } from "./births-map";
import { birthsColor, clamp, readTokens } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { dot, haloTxt } from "./chart-draw";
import { reliefScene } from "./relief-math";

// The canvas engine of chapter 06's births map, loaded only once the chapter nears the viewport (births-map.tsx).
// One square per cell of chapter 04's dot grid, coloured by its municipality's class; the squares sweep in from
// the west. Labels name the highest, the second highest and the lowest municipality, and Tbilisi. Ported from the
// design board's createDmap.

const TBILISI = "04";

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  births: AgeingChapter["births"];
  municipal: MunicipalChapter;
  /** The pointer is over place `hit`, or over an occupied area (-2), at (x, y). */
  onHover(hit: number, x: number, y: number): void;
  onLeave(): void;
};

export function createBirthsMap({ wrap, canvas, births, municipal, onHover, onLeave }: EngineOptions) {
  const { paper, ink, control, hairline, num } = readTokens(wrap);

  const { cols: C, rows: R, cells } = municipal.grid;
  const { centers } = reliefScene(municipal);
  // The chart core counts only indices >= 0 as hovered, so an occupied area is the index after the last place.
  const OCCUPIED = municipal.places.length;
  const colors = births.places.map((entry) => (entry ? birthsColor((entry.births / entry.deaths) * 100) : null));

  const ranked = placeRatios(births).sort((a, b) => b.ratio - a.ratio);
  const tbilisi = ranked.find((r) => municipal.places[r.index].code === TBILISI);
  const labelled = [ranked[0], ranked[ranked.length - 1], tbilisi, ranked[1]].filter(
    (r, k, all): r is (typeof ranked)[number] => !!r && all.findIndex((other) => other?.index === r.index) === k,
  );

  let geo: { s: number; ox: number; oy: number } | null = null;
  const pointer = { x: 0, y: 0 };

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const s = Math.min(state.W / C, (state.H - 4) / R);
    const ox = Math.round((state.W - s * C) / 2);
    const oy = 2;
    const sq = Math.max(1, s - (s > 5 ? 1.2 : 0.7));
    geo = { s, ox, oy };
    const selected = state.hover >= 0 && state.hover !== OCCUPIED ? state.hover : -1;

    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const own = cells[r * C + c];
        if (own === -1) continue;
        const shown = clamp((state.p * 1.35 - c / C) * 5, 0, 1);
        if (shown <= 0) continue;
        const x = ox + c * s;
        const y = oy + r * s;
        const color = own === -2 ? null : colors[own];
        ctx.globalAlpha = shown * (selected >= 0 && own !== selected ? 0.22 : 1);
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, sq, sq);
        } else {
          // Occupied areas in hairline, municipalities without figures hollow in the control colour.
          ctx.strokeStyle = own === -2 ? hairline : control;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0.5, sq - 1), Math.max(0.5, sq - 1));
        }
      }
    }
    ctx.globalAlpha = 1;

    if (state.p >= 1) {
      const font = `600 11px ${num}`;
      ctx.font = font;
      labelled.forEach(({ index, ratio }) => {
        const px = ox + (centers[index].c + 0.5) * s;
        const py = oy + (centers[index].r + 0.5) * s;
        const text = `${municipal.places[index].name} ${formatInUnit(ratio, UNIT_PERSONS)}`;
        // Labels go east of the dot; west of it in the western third (open sea) or where the east has no room,
        // when the west has room.
        const width = ctx.measureText(text).width;
        const west = px - 7 - width >= 0 && (centers[index].c < C / 3 || px + 7 + width > state.W);
        dot(ctx, px, py, 2.5, ink, paper);
        // haloTxt sets an alphabetic baseline: +4 centres the 11px text on the dot.
        haloTxt(ctx, text, west ? px - 7 : px + 7, py + 4, font, ink, paper, west ? "right" : "left");
      });
    }
  };

  return createChartCore(wrap, canvas, {
    duration: 1500,
    draw,
    hit: (x, y) => {
      pointer.x = x;
      pointer.y = y;
      if (!geo) return -1;
      const c = Math.floor((x - geo.ox) / geo.s);
      const r = Math.floor((y - geo.oy) / geo.s);
      if (c < 0 || r < 0 || c >= C || r >= R) return -1;
      const own = cells[r * C + c];
      return own >= 0 ? own : own === -2 ? OCCUPIED : -1;
    },
    onHover: (i) => onHover(i === OCCUPIED ? -2 : i, pointer.x, pointer.y),
    onLeave,
  });
}
