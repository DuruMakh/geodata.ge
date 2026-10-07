"use client";

import { useId, type KeyboardEvent } from "react";
import { stepPeriodIndex } from "../../lib/explorer/chartNavigation";
import { decimalsFor, niceScale } from "../../lib/explorer/chartScale";
import { CHART_AXIS_LABEL, CHART_LATTICE, INK } from "../../lib/explorer/colors";
import { buildDotLattice } from "../../lib/explorer/dotLattice";
import { formatInUnit } from "../../lib/explorer/format";
import { periodLabelIndices } from "../../lib/explorer/periodAxis";
import { ChartScrollFrame, ChartTooltip, useChartPointer } from "./chart-frame";
import { buildTooltipRows } from "./editorial-line-chart";

// Bespoke SVG stacked column chart per DESIGN.md §8.3, the only form in which
// "the parts add up to the published whole" is visible. Positive segments stack
// up from a drawn zero line, negative segments down, and the published headline
// runs over the stack as an ink line ending in a dot. No chart library.

export type StackSegment = { id: string; label: string; color: string; values: Array<number | null> };
export type StackedColumnChartProps = {
  periods: number[];
  segments: StackSegment[];
  overlay: { label: string; values: Array<number | null> } | null;
  formatPeriod: (period: number) => string;
  formatValue: (value: number) => string;
  ariaLabel: string;
};

const W = 920;
const H = 320;
const PAD_L = 74;
const PAD_R = 30;
const PAD_T = 16;
const PAD_B = 26;
const DOT_R = 0.7;
// EditorialLineChart owns "chart-dot-lattice"; both charts render on the
// categories page, so this one needs its own id to avoid a defs collision.
const LATTICE_ID = "stack-dot-lattice";

/**
 * SVG coordinates at full double precision cost ~40 characters a rect and buy
 * nothing: the viewBox is 1000 units wide, so a hundredth is far below a pixel.
 */
const px = (value: number) => Number(value.toFixed(2));
const MAX_BAR_WIDTH = 28;

export function StackedColumnChart({
  periods,
  segments,
  overlay,
  formatPeriod,
  formatValue,
  ariaLabel,
}: StackedColumnChartProps) {
  const captionId = useId();
  const count = periods.length;
  const plotWidth = W - PAD_L - PAD_R;
  // Columns sit in the middle of equal bands, so the first and last bars stay
  // inside the plot instead of straddling its edges (the first one used to be
  // drawn over the y-axis labels: "250(" for 2500).
  const band = count > 0 ? plotWidth / count : 0;
  const { svgRef, hover, pinned, setHover, handlers } = useChartPointer(count, W, PAD_L + band / 2, PAD_R + band / 2);

  // The domain covers the tallest positive stack and the deepest negative one, so
  // zero always sits on a gridline and the two halves share one step.
  let maxStack = 0;
  let minStack = 0;
  for (let position = 0; position < count; position += 1) {
    let positive = 0;
    let negative = 0;
    for (const segment of segments) {
      const value = segment.values[position];
      if (value === null || value === undefined) continue;
      if (value > 0) positive += value;
      else negative += value;
    }
    for (const value of [overlay?.values[position] ?? null]) {
      if (value === null) continue;
      if (value > positive) positive = value;
      if (value < negative) negative = value;
    }
    if (positive > maxStack) maxStack = positive;
    if (negative < minStack) minStack = negative;
  }
  if (maxStack <= 0 && minStack >= 0) maxStack = 1;
  const { top, bottom, step } = niceScale(minStack, maxStack);
  const span = top - bottom || 1;

  const plotHeight = H - PAD_T - PAD_B;
  const x = (index: number) => PAD_L + band * (index + 0.5);
  const y = (value: number) => PAD_T + ((top - value) / span) * plotHeight;
  const zeroY = y(0);
  const barWidth = count === 0 ? 0 : Math.min(MAX_BAR_WIDTH, Math.max(1, band * 0.7));

  const gridSteps = Math.round(span / step);
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, index) => bottom + step * index);
  const axisDigits = decimalsFor(step, 2);
  // The same en-US grouping and "−" sign as the lists and tables (5,000, not 5000).
  const formatAxis = (value: number) => formatInUnit(value, { divisor: 1, label: "", decimals: axisDigits });
  // The lattice columns run between the first and last column centres.
  const lattice = buildDotLattice({
    plotWidth: plotWidth - band,
    plotHeight,
    yearCount: count,
    gridStepCount: gridSteps,
    periodsPerYear: 12,
    firstPeriod: periods[0],
  });
  const labelIndices = new Set(periodLabelIndices(periods, 12));

  // The move-to goes on the first point that exists, not on index 0: an overlay
  // starting later than the columns would otherwise open the path with "L".
  const overlayFirst = overlay === null ? -1 : overlay.values.findIndex((value) => value !== null);
  const overlayPath =
    overlay === null
      ? null
      : overlay.values
          .map((value, index) => (value === null ? null : `${index === overlayFirst ? "M" : "L"}${px(x(index))},${px(y(value))}`))
          .filter((entry): entry is string => entry !== null)
          .join(" ");
  const overlayLast = overlay === null ? -1 : overlay.values.reduce<number>((last, value, index) => (value === null ? last : index), -1);
  const overlayLastValue = overlay === null || overlayLast < 0 ? null : overlay.values[overlayLast] ?? null;

  // The same bounded readout as the line chart: rows ranked by value, capped, remainder named.
  const tooltip =
    hover === null
      ? null
      : buildTooltipRows(
          segments.map((segment) => ({ id: segment.id, label: segment.label, color: segment.color, vals: segment.values, planned: [] })),
          hover,
        );
  const overlayAtHover = hover === null || overlay === null ? null : overlay.values[hover] ?? null;

  const axisText = (value: number) => (
    <text
      key={`axis-${value}`}
      x={PAD_L - 10}
      y={y(value) + 4}
      textAnchor="end"
      fontSize={11}
      fill={CHART_AXIS_LABEL}
      style={{ fontFamily: "var(--font-numeric)" }}
    >
      {formatAxis(value)}
    </text>
  );
  // The sticky copy stops above the period labels, so it never covers the first one.
  const stickyAxis = {
    widthPercent: (PAD_L / W) * 100,
    node: (
      <svg viewBox={`0 0 ${PAD_L} ${H - PAD_B + 6}`} className="block h-auto w-full">
        {gridLines.map(axisText)}
      </svg>
    ),
  };
  const scrollKey = `${periods[0]}-${periods[count - 1]}-${segments.map((segment) => segment.id).join(",")}`;

  const readout =
    hover !== null && tooltip !== null && tooltip.rows.length > 0 ? (
      <ChartTooltip
        testId="stack-chart-tooltip"
        pinned={pinned}
        leftPercent={(x(hover) / W) * 100}
        header={formatPeriod(periods[hover]!)}
        headerRight={overlay !== null && overlayAtHover !== null ? `${overlay.label} ${formatValue(overlayAtHover)}` : null}
        rows={tooltip.rows}
        hidden={tooltip.hidden}
        formatValue={formatValue}
      />
    ) : null;

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const next = stepPeriodIndex(event.key, hover, count);
    if (next === undefined) return;
    event.preventDefault();
    setHover(next);
  }

  return (
    // role="img" belongs on the svg, not the figure: it is children-presentational,
    // so on the figure it would hide the sr-only figcaption that carries the numbers.
    <figure className="m-0">
      <ChartScrollFrame testId="stack-chart-frame" scrollKey={scrollKey} yAxis={stickyAxis} overlay={pinned !== null ? readout : null}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full [&:focus:not(:focus-visible)]:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          role="img"
          aria-label={ariaLabel}
          aria-describedby={captionId}
          tabIndex={0}
          {...handlers}
          onKeyDown={handleKeyDown}
          onBlur={() => setHover(null)}
        >
          {lattice !== null && (
            <>
              <defs>
                <pattern
                  id={LATTICE_ID}
                  patternUnits="userSpaceOnUse"
                  x={PAD_L + band / 2 + lattice.colOffset - lattice.colPitch / 2}
                  y={PAD_T - lattice.rowPitch / 2}
                  width={lattice.colPitch}
                  height={lattice.rowPitch}
                >
                  <circle cx={lattice.colPitch / 2} cy={lattice.rowPitch / 2} r={DOT_R} fill={CHART_LATTICE} />
                </pattern>
              </defs>
              {/* Grown by one dot radius on every side: a pattern fill clips to the
                  shape it fills, so without this the border dots draw as halves. */}
              <rect
                data-testid="stack-dot-lattice"
                x={PAD_L - DOT_R}
                y={PAD_T - DOT_R}
                width={plotWidth + DOT_R * 2}
                height={plotHeight + DOT_R * 2}
                fill={`url(#${LATTICE_ID})`}
                opacity={0.6}
              />
            </>
          )}

          {gridLines.map(axisText)}

          {segments.map((segment) =>
            segment.values.map((value, index) => {
              if (value === null || value === undefined || value === 0) return null;
              // Each column stacks in `segments` order: positives climb from zero,
              // negatives hang below it, so the two never overlap.
              let base = 0;
              for (const earlier of segments) {
                if (earlier === segment) break;
                const other = earlier.values[index];
                if (other === null || other === undefined) continue;
                if (value > 0 && other > 0) base += other;
                if (value < 0 && other < 0) base += other;
              }
              const start = value > 0 ? base + value : base;
              const height = Math.abs(y(0) - y(Math.abs(value)));
              return (
                <rect
                  key={`${segment.id}-${index}`}
                  data-segment={segment.id}
                  x={px(x(index) - barWidth / 2)}
                  y={px(value > 0 ? y(start) : y(base))}
                  width={px(barWidth)}
                  height={px(height)}
                  fill={segment.color}
                />
              );
            }),
          )}

          <line data-zero x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke={INK} strokeWidth={1} />

          {hover !== null ? (
            <line data-hover-guide x1={x(hover)} x2={x(hover)} y1={PAD_T - 6} y2={H - PAD_B} stroke={CHART_LATTICE} strokeWidth={1} />
          ) : null}

          {overlayPath !== null && overlayPath !== "" && (
            <path data-overlay d={overlayPath} fill="none" stroke={INK} strokeWidth={1.5} />
          )}
          {overlayLastValue !== null ? (
            <circle data-overlay-end cx={px(x(overlayLast))} cy={px(y(overlayLastValue))} r={3.5} fill={INK} />
          ) : null}

          {periods.map((period, index) =>
            labelIndices.has(index) ? (
              <text
                key={`label-${period}`}
                x={x(index)}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill={CHART_AXIS_LABEL}
                style={{ fontFamily: "var(--font-numeric)" }}
              >
                {formatPeriod(period)}
              </text>
            ) : null,
          )}
        </svg>

        {pinned === null ? readout : null}
      </ChartScrollFrame>

      {/* The chart is never colour-only: the same numbers read as text. */}
      <figcaption id={captionId} className="sr-only">
        <ul>
          {segments.map((segment) => {
            const last = [...segment.values].reverse().find((value) => value !== null && value !== undefined);
            return (
              <li key={segment.id}>
                {segment.label}: {last === null || last === undefined ? "—" : formatValue(last)}
              </li>
            );
          })}
          {overlay !== null && (
            <li>
              {overlay.label}:{" "}
              {(() => {
                const last = [...overlay.values].reverse().find((value) => value !== null && value !== undefined);
                return last === null || last === undefined ? "—" : formatValue(last);
              })()}
            </li>
          )}
        </ul>
      </figcaption>
    </figure>
  );
}
