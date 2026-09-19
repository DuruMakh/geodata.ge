"use client";

import { useState } from "react";
import { buildDotLattice } from "../../lib/explorer/dotLattice";
import { periodLabelIndices } from "../../lib/explorer/periodAxis";

// Bespoke SVG stacked column chart per DESIGN.md §8.3, the only form in which
// "the parts add up to the published whole" is visible. Positive segments stack
// up from a drawn zero line, negative segments down, and the published headline
// runs over the stack as an ink line. No chart library.

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

function niceMax(rawMax: number): number {
  const raw = rawMax * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function decimalsFor(step: number, max: number): number {
  for (let digits = 0; digits <= max; digits += 1) {
    const scaled = step * 10 ** digits;
    if (Math.abs(Math.round(scaled) - scaled) < 1e-6) return digits;
  }
  return max;
}

export function StackedColumnChart({
  periods,
  segments,
  overlay,
  formatPeriod,
  formatValue,
  ariaLabel,
}: StackedColumnChartProps) {
  const [hoverRaw, setHover] = useState<number | null>(null);
  const count = periods.length;
  const hover = hoverRaw !== null && hoverRaw < count ? hoverRaw : null;

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
  const posSpan = maxStack > 0 ? niceMax(maxStack) : 0;
  const negSpan = minStack < 0 ? niceMax(-minStack) : 0;
  const step = Math.max(posSpan, negSpan) / 4 || 1;
  const top = posSpan > 0 ? Math.ceil(posSpan / step - 1e-9) * step : 0;
  const bottom = negSpan > 0 ? -Math.ceil(negSpan / step - 1e-9) * step : 0;
  const span = top - bottom || 1;

  const plotWidth = W - PAD_L - PAD_R;
  const plotHeight = H - PAD_T - PAD_B;
  const x = (index: number) => PAD_L + (count <= 1 ? plotWidth / 2 : (index * plotWidth) / (count - 1));
  const y = (value: number) => PAD_T + ((top - value) / span) * plotHeight;
  const zeroY = y(0);
  const barWidth = count === 0 ? 0 : Math.min(MAX_BAR_WIDTH, Math.max(1, (plotWidth / Math.max(count, 1)) * 0.7));

  const gridSteps = Math.round(span / step);
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, index) => bottom + step * index);
  const axisDigits = decimalsFor(step, 2);
  const formatAxis = (value: number) => value.toFixed(axisDigits).replace("-", "−");
  const lattice = buildDotLattice({
    plotWidth,
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

  const hoverRows =
    hover === null
      ? []
      : segments
          .map((segment) => ({ segment, value: segment.values[hover] }))
          .filter((entry): entry is { segment: StackSegment; value: number } => entry.value !== null && entry.value !== undefined);

  return (
    // role="img" belongs on the svg, not the figure: it is children-presentational,
    // so on the figure it would hide the sr-only figcaption that carries the numbers.
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
        {lattice !== null && (
          <>
            <defs>
              {/* One tile, repeated by the renderer, as EditorialLineChart does —
                  a nested loop emitted 825 <circle> nodes for the same picture. */}
              <pattern
                id={LATTICE_ID}
                patternUnits="userSpaceOnUse"
                x={PAD_L + lattice.colOffset - lattice.colPitch / 2}
                y={PAD_T - lattice.rowPitch / 2}
                width={lattice.colPitch}
                height={lattice.rowPitch}
              >
                <circle cx={lattice.colPitch / 2} cy={lattice.rowPitch / 2} r={DOT_R} fill="var(--rule)" />
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
            />
          </>
        )}

        {gridLines.map((value) => (
          <text
            key={`axis-${value}`}
            x={PAD_L - 10}
            y={y(value) + 4}
            textAnchor="end"
            className="fill-[var(--ink-soft)] font-mono text-[11px]"
          >
            {formatAxis(value)}
          </text>
        ))}

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

        <line data-zero x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="var(--ink)" strokeWidth={1} />

        {overlayPath !== null && overlayPath !== "" && (
          <path data-overlay d={overlayPath} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
        )}

        {periods.map((period, index) =>
          labelIndices.has(index) ? (
            <text
              key={`label-${period}`}
              x={x(index)}
              y={H - 8}
              textAnchor="middle"
              className="fill-[var(--ink-soft)] font-mono text-[11px]"
            >
              {formatPeriod(period)}
            </text>
          ) : null,
        )}

        {periods.map((period, index) => (
          <rect
            key={`hit-${period}`}
            x={x(index) - barWidth / 2}
            y={PAD_T}
            width={barWidth}
            height={plotHeight}
            fill="transparent"
            onPointerEnter={() => setHover(index)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {/* The chart is never colour-only: the same numbers read as text. */}
      <figcaption className="sr-only">
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

      {hover !== null && hoverRows.length > 0 && (
        <div className="mt-2 font-mono text-[11px] text-[var(--ink-soft)]">
          <span>{formatPeriod(periods[hover]!)}</span>
          {hoverRows.map(({ segment, value }) => (
            <span key={segment.id} className="ml-3">
              {segment.label} {formatValue(value)}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
