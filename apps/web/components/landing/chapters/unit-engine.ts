import { formatShare } from "../../../lib/explorer/format";
import type { DeathsChapter } from "../../../lib/landing/chapters/types";
import { deathSquareToken, readTokens } from "./canvas";
import { createChartCore, type ChartState } from "./chart-core";
import { txt } from "./chart-draw";
import { decimals } from "./chart-format";
import { deathSquares, UNIT_NARROW_WIDTH, unitLayout, unitMetrics, unitRowStart } from "./chart-layout";

// The canvas engine of chapter 10's causes-of-death chart, loaded only once the chart nears the viewport
// (unit-chart.tsx). One row per group, largest first: its name and count, and one square per 100 deaths in blocks of
// ten columns; the wrapper takes the height the rows need. Squares fill in group by group as the chart draws in.
// The hollow squares are the deaths whose cause is not established. Ported from the design board's createUnits.

type Group = DeathsChapter["groups"][number];

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  groups: Group[];
  total: number;
  onHover(index: number, x: number, y: number): void;
  onLeave(): void;
};

export function createUnits({ wrap, canvas, groups, total, onHover, onLeave }: EngineOptions) {
  const tokens = readTokens(wrap);
  const { ink, muted, ui, num } = tokens;

  const counts = groups.map((group) => group.count);
  const names = groups.map((group) => group.label);
  const squares = counts.map(deathSquares);
  const squareTotal = squares.reduce((sum, n) => sum + n, 0);

  let geo: { layout: ReturnType<typeof unitLayout>; starts: number[]; end(i: number): { x: number; y: number } } | null = null;

  const draw = (ctx: CanvasRenderingContext2D, state: ChartState) => {
    const narrow = state.W < UNIT_NARROW_WIDTH;
    const font = `600 ${narrow ? 12 : 12.5}px ${ui}`;
    ctx.font = font;
    const layout = unitLayout(state.W, counts, (text) => ctx.measureText(text).width, names);
    // The wrapper takes the height the rows need; the resize that follows draws again.
    if (Math.abs(state.H - layout.height) > 1) {
      wrap.style.height = `${layout.height}px`;
      return;
    }
    const { labelWidth, step, groupWidth } = unitMetrics(layout.narrow);
    const side = step - 2;
    const cell = (j: number, top: number) => {
      const col = j % layout.perRow;
      return { x: labelWidth + Math.floor(col / 10) * groupWidth + (col % 10) * step, y: top + Math.floor(j / layout.perRow) * step };
    };
    geo = {
      layout,
      starts: layout.rows.map((row) => unitRowStart(row, layout.narrow)),
      // Where the tooltip points: the right end of the group's first row of squares, halfway down its block.
      end: (i) => {
        const first = cell(Math.max(Math.min(squares[i], layout.perRow) - 1, 0), layout.rows[i].top);
        return { x: first.x + side, y: layout.rows[i].top + (Math.ceil(squares[i] / layout.perRow) * step) / 2 };
      },
    };

    let drawn = 0;
    groups.forEach((group, i) => {
      const row = layout.rows[i];
      const start = geo!.starts[i];
      const count = `${decimals(group.count, 0)} · ${formatShare(group.count / total, false, 0)}`;
      ctx.globalAlpha = state.hover >= 0 && state.hover !== i ? 0.3 : 1;
      if (layout.narrow) {
        row.lines.forEach((line, k) => txt(ctx, line, 0, start + 9 + k * 16, font, ink, "left", "middle"));
        txt(ctx, count, state.W, start + 9, `500 11px ${num}`, muted, "right", "middle");
      } else {
        row.lines.forEach((line, k) => txt(ctx, line, 0, row.top + 9 + k * 16, font, ink, "left", "middle"));
        txt(ctx, count, 0, row.top + 11 + row.lines.length * 16, `500 11px ${num}`, muted, "left", "middle");
      }
      const color = tokens[deathSquareToken(group.kind)];
      for (let j = 0; j < squares[i]; j++, drawn++) {
        if (drawn / squareTotal > state.p * 1.08) continue;
        const { x, y } = cell(j, row.top);
        if (group.kind === "unknown") {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, side - 1, side - 1);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, side, side);
        }
      }
      ctx.globalAlpha = 1;
    });
  };

  return createChartCore(wrap, canvas, {
    duration: 1800,
    draw,
    hit: (_x, y) => {
      if (!geo) return -1;
      for (let i = geo.starts.length - 1; i >= 0; i--) if (y >= geo.starts[i] - 4) return i;
      return -1;
    },
    onHover: (i) => {
      if (!geo) return;
      const { x, y } = geo.end(i);
      onHover(i, x, y);
    },
    onLeave,
  });
}
