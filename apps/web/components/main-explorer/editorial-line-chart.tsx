"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { useState } from "react";
import { buildDotLattice } from "../../lib/explorer/dotLattice";
import { formatInUnit, formatShare, type ValueUnit } from "../../lib/explorer/format";
import { SwatchBar } from "../ui/editorial";
import { HorizontalScrollHint } from "../ui/horizontal-scroll-hint";

// Bespoke SVG line chart per DESIGN.md §8.3: chart sits directly on paper, dot
// lattice for the grid, ink baseline at zero, mono axis labels, hover crosshair + tooltip.

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  vals: (number | null)[];
  planned: boolean[];
  forecastFromYear?: number;
};

type EditorialLineChartProps = {
  years: number[];
  series: ChartSeries[];
  share: boolean;
  unit: ValueUnit;
  shareLabel: string;
  axisLeftPadding?: number;
};

const W = 920;
const H = 320;
// A little wider than the reference prototype's 62 so 8-character axis labels
// ("7.5 მლრდ") never clip at the viewBox edge.
const PAD_L = 74;
const PAD_R = 30;
const PAD_T = 16;
const PAD_B = 26;
const DOT_R = 0.7;

export type TooltipRow = { id: string; label: string; color: string; value: number };

// Series selection is unlimited (AGENTS.md UI contract), so the hover readout
// cannot be one row per series: at 63 it measured 1327px against a 334px chart,
// clipped by the frame's own overflow-x, with a third of its rows reading "—"
// for years the series has no data. Rank by value and keep the head — a reader
// pointing at the chart is asking which lines are on top here.
export const TOOLTIP_ROW_CAP = 10;

export function buildTooltipRows(
  series: ChartSeries[],
  hover: number,
  cap: number = TOOLTIP_ROW_CAP,
): { rows: TooltipRow[]; hidden: number } {
  const present: TooltipRow[] = [];
  for (const line of series) {
    const value = line.vals[hover];
    if (value === null || value === undefined) continue;
    present.push({ id: line.id, label: line.label, color: line.color, value });
  }
  present.sort((a, b) => b.value - a.value);

  return { rows: present.slice(0, cap), hidden: Math.max(0, present.length - cap) };
}

function niceMax(rawMax: number): number {
  const raw = rawMax * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// Smallest decimal count (up to max) that renders the gridline step exactly,
// so axis labels are never rounded into duplicates ("0.3" for a 0.25 step).
function decimalsFor(step: number, max: number): number {
  for (let digits = 0; digits <= max; digits += 1) {
    const scaled = step * 10 ** digits;
    if (Math.abs(Math.round(scaled) - scaled) < 1e-6) return digits;
  }
  return max;
}

export function EditorialLineChart({ years, series, share, unit, shareLabel, axisLeftPadding = PAD_L }: EditorialLineChartProps) {
  const { messages } = useI18n();
  const [hoverRaw, setHover] = useState<number | null>(null);
  const n = years.length;
  // The hover index survives range shrinks (no pointer event fires), so clamp it
  // instead of trusting it — a stale index would render a ghost tooltip.
  const hover = hoverRaw !== null && hoverRaw < n ? hoverRaw : null;

  // The domain must cover negative values (e.g. revenue.other_taxes 2019-2020):
  // both bounds snap to one shared gridline step so 0 always sits on a line.
  let maxValue = 0;
  let minValue = 0;
  for (const line of series) {
    for (const value of line.vals) {
      if (value === null) continue;
      if (value > maxValue) maxValue = value;
      if (value < minValue) minValue = value;
    }
  }
  if (maxValue <= 0 && minValue >= 0) maxValue = 1;
  const posSpan = maxValue > 0 ? niceMax(maxValue) : 0;
  const negSpan = minValue < 0 ? niceMax(-minValue) : 0;
  const rawStep = Math.max(posSpan, negSpan) / 4;
  const amountQuantum = unit.divisor / 10 ** unit.decimals;
  const step = share
    ? rawStep
    : Math.max(amountQuantum, Math.ceil(rawStep / amountQuantum - 1e-9) * amountQuantum);
  const top = posSpan > 0 ? Math.ceil(posSpan / step - 1e-9) * step : 0;
  const bottom = negSpan > 0 ? -Math.ceil(negSpan / step - 1e-9) * step : 0;
  const span = top - bottom;

  const x = (index: number) => axisLeftPadding + (n <= 1 ? (W - axisLeftPadding - PAD_R) / 2 : (index * (W - axisLeftPadding - PAD_R)) / (n - 1));
  const y = (value: number) => PAD_T + ((top - value) / span) * (H - PAD_T - PAD_B);
  // Axis precision follows the gridline STEP, not the unit's data-derived
  // decimals. The unit carries enough precision for the smallest value in the
  // table (which is what sets amountQuantum above, so a small series still gets
  // a readable domain); the axis only ever prints multiples of the step, so
  // borrowing those decimals would render a 12.5 gridline as "12.50".
  const shareDigits = decimalsFor(step, 2);
  const axisUnit = { ...unit, decimals: decimalsFor(step / unit.divisor, 4) };
  const formatAxis = (value: number) =>
    (share
      ? `${value.toFixed(shareDigits)}%`
      : `${formatInUnit(value, axisUnit)} ${unit.label}`
    ).replace("-", "−");

  const formatValue = (value: number | null) =>
    share ? formatShare(value === null ? null : value / 100) : formatInUnit(value, unit);

  const gridLines = Array.from({ length: Math.round(span / step) + 1 }, (_, index) => bottom + step * index);
  const labelStep = Math.max(1, Math.ceil(n / 12));

  const lattice = buildDotLattice({
    plotWidth: W - axisLeftPadding - PAD_R,
    plotHeight: H - PAD_T - PAD_B,
    yearCount: n,
    gridStepCount: Math.round(span / step),
  });

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const pointerStep = n <= 1 ? 1 : (W - axisLeftPadding - PAD_R) / (n - 1);
    const index = Math.min(n - 1, Math.max(0, Math.round((px - axisLeftPadding) / pointerStep)));
    if (index !== hoverRaw) setHover(index);
  }

  const hoverX = hover === null ? null : (x(hover) / W) * 100;
  const tooltip = hover === null ? null : buildTooltipRows(series, hover);

  return (
    // Scroll instead of shrink on narrow screens: an unbounded w-full SVG scales
    // its text below the DESIGN.md §13 legibility floor on phones.
    //
    // Exception, 900–1019px: the shell's sidebar leaves the column under 720px, so
    // the floor would put a scrollbar under a desktop-width chart. There the chart
    // shrinks to fit instead — an approved trade of label size for a whole chart
    // (DESIGN.md §12). Below 900px the sidebar is a top bar and the column is wide
    // again, so phones keep the scroll.
    <>
      <HorizontalScrollHint testId="chart-scroll-hint" />
      <div
        data-testid="chart-frame"
        role="region"
        tabIndex={0}
        aria-label={message(messages, "controls.chartScrollable")}
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
      <div className="relative min-w-[720px] min-[900px]:max-[1020px]:min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={message(messages, "controls.chartTrend")}
        className="block h-auto w-full"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
      >
        {lattice ? (
          <>
            <defs>
              <pattern
                id="chart-dot-lattice"
                patternUnits="userSpaceOnUse"
                x={axisLeftPadding - lattice.colPitch / 2}
                y={PAD_T - lattice.rowPitch / 2}
                width={lattice.colPitch}
                height={lattice.rowPitch}
              >
                <circle cx={lattice.colPitch / 2} cy={lattice.rowPitch / 2} r={DOT_R} fill="#C9BEA9" />
              </pattern>
            </defs>
            {/* Grown by one dot radius on every side: the pitch divides the plot
                box exactly, so dots land on all four bounds, and a pattern fill
                clips to the shape it fills — without this the border columns and
                rows draw as half dots (quarters at the corners). */}
            <rect
              data-testid="chart-dot-lattice"
              x={axisLeftPadding - DOT_R}
              y={PAD_T - DOT_R}
              width={W - axisLeftPadding - PAD_R + DOT_R * 2}
              height={H - PAD_T - PAD_B + DOT_R * 2}
              fill="url(#chart-dot-lattice)"
              opacity={0.6}
            />
          </>
        ) : null}
        {gridLines.map((value, index) => (
          <g key={`grid-${index}`}>
            {/* The lattice carries the grid, so only zero keeps a drawn rule — a
                negative domain is unreadable without it. When there is no lattice
                (a single-year range has no interval to divide) the rules come back,
                or the axis labels would have nothing to sit against. */}
            {value === 0 || lattice === null ? (
              <line
                x1={axisLeftPadding}
                x2={W - PAD_R}
                y1={y(value)}
                y2={y(value)}
                stroke={value === 0 ? "#1E1B16" : "#E7DECF"}
                strokeWidth={1}
              />
            ) : null}
            <text x={axisLeftPadding - 10} y={y(value) + 3} fontSize={11} fill="#6A6050" textAnchor="end" style={{ fontFamily: "var(--font-numeric)" }}>
              {formatAxis(value)}
            </text>
          </g>
        ))}
        <line x1={axisLeftPadding} x2={axisLeftPadding} y1={PAD_T} y2={H - PAD_B} stroke="#D9CFBE" strokeWidth={1} />
        {years.map((year, index) => {
          const isLast = index === n - 1;
          const show = isLast || (index % labelStep === 0 && n - 1 - index >= labelStep);
          if (!show) return null;
          const anchor = index === 0 ? "start" : isLast ? "end" : "middle";
          const tx = index === 0 ? x(index) - 4 : isLast ? x(index) + 4 : x(index);

          return (
            <text key={`year-${year}`} x={tx} y={H - 8} fontSize={11} fill="#6A6050" textAnchor={anchor} style={{ fontFamily: "var(--font-numeric)" }}>
              {year}
            </text>
          );
        })}
        {hover !== null ? (
          <line x1={x(hover)} x2={x(hover)} y1={PAD_T - 6} y2={H - PAD_B} stroke="#C9BEA9" strokeWidth={1} />
        ) : null}
        {series.map((line) => {
          // Interior data gaps (e.g. programs with no 2015 facts) split the path
          // into segments — a bridged line would assert values that don't exist.
          const segments: Array<Array<[number, number, number]>> = [];
          let run: Array<[number, number, number]> = [];
          for (let index = 0; index < n; index += 1) {
            const value = line.vals[index];
            if (value === null || value === undefined) {
              if (run.length > 0) segments.push(run);
              run = [];
            } else {
              run.push([x(index), y(value), index]);
            }
          }
          if (run.length > 0) segments.push(run);
          if (segments.length === 0) return null;

          const pathFor = (pathSegments: Array<Array<[number, number, number]>>) =>
            pathSegments
              .filter((segment) => segment.length > 1)
              .map((segment) => segment.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" "))
              .join(" ");
          const path = pathFor(segments);
          const actualSegments: Array<Array<[number, number, number]>> = [];
          const forecastSegments: Array<Array<[number, number, number]>> = [];

          if (line.forecastFromYear !== undefined) {
            for (const segment of segments) {
              const firstForecastIndex = segment.findIndex(([, , index]) => years[index]! >= line.forecastFromYear!);
              if (firstForecastIndex === -1) {
                actualSegments.push(segment);
              } else {
                if (firstForecastIndex > 0) actualSegments.push(segment.slice(0, firstForecastIndex));
                forecastSegments.push(
                  firstForecastIndex > 0
                    ? [segment[firstForecastIndex - 1]!, ...segment.slice(firstForecastIndex)]
                    : segment.slice(firstForecastIndex),
                );
              }
            }
          }

          const actualPath = line.forecastFromYear === undefined ? path : pathFor(actualSegments);
          const forecastPath = line.forecastFromYear === undefined ? "" : pathFor(forecastSegments);
          const isolated = segments.filter((segment) => segment.length === 1).map((segment) => segment[0]);
          const points = segments.flat();
          const last = points[points.length - 1];

          return (
            <g key={line.id}>
              {actualPath ? (
                <path
                  {...(line.forecastFromYear === undefined ? {} : { "data-testid": `chart-series-${line.id}-actual` })}
                  d={actualPath}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {forecastPath ? (
                <path
                  data-testid={`chart-series-${line.id}-forecast`}
                  d={forecastPath}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2.2}
                  strokeDasharray="6 5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {isolated.map(([px, py, index]) => (
                <circle key={`isolated-${index}`} cx={px} cy={py} r={2.5} fill={line.color} />
              ))}
              <circle cx={last[0]} cy={last[1]} r={3.5} fill={line.color} />
              {points
                .filter(([, , index]) => line.planned[index])
                .map(([px, py, index]) => (
                  <circle key={`planned-${index}`} cx={px} cy={py} r={3} fill="#F7F2E9" stroke={line.color} strokeWidth={1.5} />
                ))}
              {hover !== null && line.vals[hover] !== null && line.vals[hover] !== undefined ? (
                <circle cx={x(hover)} cy={y(line.vals[hover] as number)} r={3.5} fill="#F7F2E9" stroke={line.color} strokeWidth={2} />
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && hoverX !== null && tooltip !== null ? (
        <div
          data-testid="chart-tooltip"
          className="pointer-events-none absolute top-0 z-[2] flex max-h-full min-w-[200px] flex-col gap-1 overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
          style={{
            left: `${hoverX}%`,
            transform: hoverX > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <div className="mb-0.5 flex justify-between gap-3 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">
            <span>{years[hover]}</span>
            {share ? <span>{shareLabel}</span> : null}
          </div>
          {tooltip.rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--body)]">
                <SwatchBar color={row.color} className="!w-3" />
                <span className="max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap">{row.label}</span>
              </span>
              <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
                {formatValue(row.value)}
              </span>
            </div>
          ))}
          {tooltip.hidden > 0 ? (
            <div className="pt-0.5 text-[10.5px] text-[var(--muted)]">+{tooltip.hidden} {message(messages, "controls.other")}</div>
          ) : null}
        </div>
      ) : null}
      </div>
      </div>
    </>
  );
}
