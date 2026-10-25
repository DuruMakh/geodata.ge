import type { LabourSplit } from "../../../lib/landing/chapters/types";
import { clamp, readTokens } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";

// The canvas engine of chapter 07's 10 x 10 grids, loaded only once a grid nears the viewport (waffle-chart.tsx).
// Squares fill row by row: employed in ink, unemployed in accent, those outside the labour force as outlines.
// The hovered group stays, the others dim. Ported from the design board's createWaffle.

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  split: LabourSplit;
  /** The pointer is over group `index` (0 employed, 1 unemployed, 2 outside), at (x, y) in the wrapper. */
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

export function createWaffle({ wrap, canvas, split, onHover, onLeave }: EngineOptions) {
  const { ink, accent, control } = readTokens(wrap);
  const fills: (string | null)[] = [ink, accent, null];

  // The group of each of the 100 squares, in reading order.
  const cell: number[] = [];
  split.per100.forEach((count, group) => {
    for (let j = 0; j < count; j++) cell.push(group);
  });

  let geo: { pitch: number; top: number } | null = null;
  let pointer = { x: 0, y: 0 };

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const side = Math.min(state.W, state.H);
    const pitch = side / 10;
    const gap = Math.max(2, Math.round(pitch * 0.12));
    const sq = pitch - gap;
    const top = Math.round((state.H - side) / 2);
    geo = { pitch, top };
    for (let i = 0; i < cell.length; i++) {
      const group = cell[i];
      const appear = clamp((state.p * 1.3 - i / 100) * 5, 0, 1);
      if (appear <= 0) continue;
      const x = (i % 10) * pitch;
      const y = top + Math.floor(i / 10) * pitch;
      ctx.globalAlpha = appear * (state.hover >= 0 && state.hover !== group ? 0.25 : 1);
      const fill = fills[group];
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, sq, sq);
      } else {
        ctx.strokeStyle = control;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.75, y + 0.75, sq - 1.5, sq - 1.5);
      }
    }
    ctx.globalAlpha = 1;
  };

  return createChartCore(wrap, canvas, {
    duration: 1400,
    draw,
    hit: (x, y) => {
      pointer = { x, y };
      if (!geo) return -1;
      const col = Math.floor(x / geo.pitch);
      const row = Math.floor((y - geo.top) / geo.pitch);
      return col >= 0 && row >= 0 && col < 10 && row < 10 ? (cell[row * 10 + col] ?? -1) : -1;
    },
    onHover: (group) => onHover(group, pointer.x, pointer.y),
    onLeave,
  });
}
