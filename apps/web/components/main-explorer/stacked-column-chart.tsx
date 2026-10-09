"use client";

import { useId, type KeyboardEvent } from "react";
import { stepPeriodIndex } from "../../lib/explorer/chartNavigation";
import { axisLabelWidth, axisLeftPaddingFor, decimalsFor, fitAxisLabels, niceScale, periodAnchors } from "../../lib/explorer/chartScale";
import { CHART_AXIS_LABEL, CHART_LATTICE, INK } from "../../lib/explorer/colors";
import { buildDotLattice, type DotLattice } from "../../lib/explorer/dotLattice";
import { formatInUnit } from "../../lib/explorer/format";
import { periodLabelIndices } from "../../lib/explorer/periodAxis";
import {
  ChartScrollFrame,
  ChartTooltip,
  DESKTOP_ONLY,
  MOBILE_ONLY,
  MOBILE_PREVIEW_WIDTH,
  mobileChartHeight,
  useChartLayout,
  useChartPointer,
} from "./chart-frame";
import { buildTooltipRows, coarsenLattice, TOOLTIP_ROW_CAP, type TooltipRow } from "./editorial-line-chart";

// Bespoke SVG stacked column chart per DESIGN.md §8.3, the only form in which
// "the parts add up to the published whole" is visible. Positive segments stack
// up from a drawn zero line, negative segments down, and the published headline
// runs over the stack as an ink line ending in a dot. No chart library.

export type StackSegment = {
  id: string;
  label: string;
  color: string;
  values: Array<number | null>;
  /** The name the hover readout prints when it differs from `label` (which stays the caption's). */
  readoutLabel?: string;
  /** Draws an arrow in the segment's colour in the readout instead of the colour bar. */
  marker?: "up" | "down";
};
export type StackReadoutOrder = "value" | "sign-then-magnitude";
export type StackedColumnChartProps = {
  periods: number[];
  segments: StackSegment[];
  overlay: { label: string; values: Array<number | null> } | null;
  formatPeriod: (period: number) => string;
  formatValue: (value: number) => string;
  /** Formats the overlay in the readout header and the caption; defaults to `formatValue`. */
  formatOverlayValue?: (value: number) => string;
  /** "value" (default) ranks rows by signed value; "sign-then-magnitude" lists non-negative rows by size, then negative ones by size. */
  readoutOrder?: StackReadoutOrder;
  /** Most rows the readout lists; the rest are counted. Defaults to the shared tooltip cap. */
  readoutRowCap?: number;
  /** Tightens the float readout's rows so a dozen of them fit the plot's height. */
  compactReadout?: boolean;
  ariaLabel: string;
  /** Periods per calendar year on the x axis: 12 for months (default), 1 for years. */
  periodsPerYear?: number;
};

const W = 920;
const H = 320;
const PAD_L = 74;
const PAD_R = 30;
const PAD_T = 16;
const PAD_B = 26;
const DOT_R = 0.7;
const FONT = 11;
// The phone drawing, one unit per CSS pixel: the padding fits the labels it has.
const MOBILE_PAD_L = 30;
const MOBILE_PAD_R = 12;
// EditorialLineChart owns "chart-dot-lattice"; both charts render on the
// categories page, so this one needs its own id to avoid a defs collision.
const LATTICE_ID = "stack-dot-lattice";

/**
 * SVG coordinates at full double precision cost ~40 characters a rect and buy
 * nothing: the viewBox is 1000 units wide, so a hundredth is far below a pixel.
 */
const px = (value: number) => Number(value.toFixed(2));
const MAX_BAR_WIDTH = 28;

type Plot = {
  mobile: boolean;
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  band: number;
  barWidth: number;
  /** Label index → the x its text starts at (phones), or null to centre it on the column. */
  labels: Map<number, number | null>;
  lattice: DotLattice | null;
  x: (index: number) => number;
  y: (value: number) => number;
};

/** The readout at one period: ranked and capped, each row carrying its segment's optional marker and short name. */
export function buildStackReadout(
  segments: StackSegment[],
  hover: number,
  order: StackReadoutOrder = "value",
  cap: number = TOOLTIP_ROW_CAP,
): { rows: TooltipRow[]; hidden: number } {
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const ranked = buildTooltipRows(
    segments.map((segment) => ({ id: segment.id, label: segment.label, color: segment.color, vals: segment.values, planned: [] })),
    hover,
    order === "value" ? cap : Number.POSITIVE_INFINITY,
  );
  let rows = ranked.rows;
  let hidden = ranked.hidden;
  if (order === "sign-then-magnitude") {
    // A segment's marker decides its side when it has one: a departure of zero is -0 on the chart, and -0 >= 0.
    const isLoss = (row: TooltipRow) => {
      const marker = byId.get(row.id)!.marker;
      return marker === undefined ? row.value < 0 || Object.is(row.value, -0) : marker === "down";
    };
    const gains = rows.filter((row) => !isLoss(row)).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const losses = rows.filter(isLoss).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const ordered = [...gains, ...losses];
    rows = ordered.slice(0, cap);
    hidden = Math.max(0, ordered.length - cap);
  }
  return {
    rows: rows.map((row) => {
      const segment = byId.get(row.id)!;
      return {
        ...row,
        ...(segment.readoutLabel === undefined ? {} : { label: segment.readoutLabel, srLabel: segment.label }),
        ...(segment.marker === undefined ? {} : { marker: segment.marker }),
      };
    }),
    hidden,
  };
}

export function StackedColumnChart({
  periods,
  segments,
  overlay,
  formatPeriod,
  formatValue,
  formatOverlayValue = formatValue,
  readoutOrder = "value",
  readoutRowCap = TOOLTIP_ROW_CAP,
  compactReadout = false,
  ariaLabel,
  periodsPerYear = 12,
}: StackedColumnChartProps) {
  const captionId = useId();
  const { ref: layoutRef, mobileWidth } = useChartLayout<HTMLElement>();
  const count = periods.length;

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

  const gridSteps = Math.round(span / step);
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, index) => bottom + step * index);
  const axisDigits = decimalsFor(step, 2);
  // The same en-US grouping and "−" sign as the lists and tables (5,000, not 5000).
  const formatAxis = (value: number) => formatInUnit(value, { divisor: 1, label: "", decimals: axisDigits });

  const buildPlot = (mobile: boolean, width: number): Plot => {
    const height = mobile ? mobileChartHeight(width, 0.72, 220, 320) : H;
    const padLeft = mobile ? axisLeftPaddingFor(gridLines.map(formatAxis), MOBILE_PAD_L) : PAD_L;
    const padRight = mobile ? MOBILE_PAD_R : PAD_R;
    const plotWidth = width - padLeft - padRight;
    // Columns sit in the middle of equal bands, so the first and last bars stay
    // inside the plot instead of straddling its edges (the first one used to be
    // drawn over the y-axis labels: "250(" for 2500).
    const band = count > 0 ? plotWidth / count : 0;
    const x = (index: number) => padLeft + band * (index + 0.5);
    const y = (value: number) => PAD_T + ((top - value) / span) * (height - PAD_T - PAD_B);
    const labels = new Map<number, number | null>();
    if (mobile) {
      // On a phone a label starts where it fits: centred on its column, slid
      // inward at the plot's edges, and thinned until no two collide.
      const start = (index: number) => {
        const labelWidth = axisLabelWidth(formatPeriod(periods[index]!), FONT);
        return Math.min(width - padRight - labelWidth, Math.max(padLeft, x(index) - labelWidth / 2));
      };
      const fitted = fitAxisLabels(count, periodAnchors(periods, periodsPerYear), (index) => [
        start(index),
        start(index) + axisLabelWidth(formatPeriod(periods[index]!), FONT),
      ]);
      for (const index of fitted) labels.set(index, start(index));
    } else {
      for (const index of periodLabelIndices(periods, periodsPerYear)) labels.set(index, null);
    }
    // The lattice columns run between the first and last column centres.
    const lattice = buildDotLattice({
      plotWidth: plotWidth - band,
      plotHeight: height - PAD_T - PAD_B,
      yearCount: count,
      gridStepCount: gridSteps,
      periodsPerYear,
      firstPeriod: periods[0],
    });
    return {
      mobile,
      width,
      height,
      padLeft,
      padRight,
      band,
      barWidth: count === 0 ? 0 : Math.min(MAX_BAR_WIDTH, Math.max(1, band * 0.7)),
      labels,
      lattice: mobile ? coarsenLattice(lattice) : lattice,
      x,
      y,
    };
  };

  const desktop = buildPlot(false, W);
  // Before the browser has measured, both drawings render and CSS shows one.
  const phone = mobileWidth === null ? null : buildPlot(true, mobileWidth ?? MOBILE_PREVIEW_WIDTH);
  const measured = mobileWidth !== undefined;
  const active = mobileWidth === null || mobileWidth === undefined ? desktop : phone!;
  const { svgRef, hover, pinned, setHover, handlers } = useChartPointer(
    count,
    active.width,
    active.padLeft + active.band / 2,
    active.padRight + active.band / 2,
  );

  // The move-to goes on the first point that exists, not on index 0: an overlay
  // starting later than the columns would otherwise open the path with "L".
  const overlayFirst = overlay === null ? -1 : overlay.values.findIndex((value) => value !== null);
  const overlayLast = overlay === null ? -1 : overlay.values.reduce<number>((last, value, index) => (value === null ? last : index), -1);
  const overlayLastValue = overlay === null || overlayLast < 0 ? null : overlay.values[overlayLast] ?? null;

  // The same bounded readout as the line chart: rows ranked by value, capped, remainder named.
  const tooltip = hover === null ? null : buildStackReadout(segments, hover, readoutOrder, readoutRowCap);
  const overlayAtHover = hover === null || overlay === null ? null : overlay.values[hover] ?? null;

  const axisText = (plot: Plot, value: number) => (
    <text
      key={`axis-${value}`}
      x={plot.padLeft - 10}
      y={plot.y(value) + 4}
      textAnchor="end"
      fontSize={FONT}
      fill={CHART_AXIS_LABEL}
      style={{ fontFamily: "var(--font-numeric)" }}
    >
      {formatAxis(value)}
    </text>
  );
  // The sticky copy stops above the period labels, so it never covers the first one.
  // Only a desktop drawing that overflows its frame shows it; phones fit.
  const stickyAxis = {
    widthPercent: (PAD_L / W) * 100,
    node: (
      <svg viewBox={`0 0 ${PAD_L} ${H - PAD_B + 6}`} className="block h-auto w-full">
        {gridLines.map((value) => axisText(desktop, value))}
      </svg>
    ),
  };
  const scrollKey = `${periods[0]}-${periods[count - 1]}-${segments.map((segment) => segment.id).join(",")}`;

  const readout =
    hover !== null && tooltip !== null && tooltip.rows.length > 0 ? (
      <ChartTooltip
        testId="stack-chart-tooltip"
        pinned={pinned}
        leftPercent={(active.x(hover) / active.width) * 100}
        header={formatPeriod(periods[hover]!)}
        headerRight={overlay !== null && overlayAtHover !== null ? `${overlay.label} ${formatOverlayValue(overlayAtHover)}` : null}
        rows={tooltip.rows}
        hidden={tooltip.hidden}
        formatValue={formatValue}
        variant={active.mobile ? "panel" : "float"}
        compact={compactReadout}
      />
    ) : null;

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const next = stepPeriodIndex(event.key, hover, count);
    if (next === undefined) return;
    event.preventDefault();
    setHover(next);
  }

  const renderSvg = (plot: Plot, className: string) => {
    const { width, height, padLeft, padRight, band, barWidth, x, y, lattice } = plot;
    const latticeId = plot.mobile ? `${LATTICE_ID}-mobile` : LATTICE_ID;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - PAD_T - PAD_B;
    const zeroY = y(0);
    const overlayPath =
      overlay === null
        ? null
        : overlay.values
            .map((value, index) => (value === null ? null : `${index === overlayFirst ? "M" : "L"}${px(x(index))},${px(y(value))}`))
            .filter((entry): entry is string => entry !== null)
            .join(" ");
    const isActive = plot === active;

    return (
      <svg
        key={plot.mobile ? "mobile" : "desktop"}
        ref={isActive ? svgRef : undefined}
        data-geometry={plot.mobile ? "mobile" : "desktop"}
        viewBox={`0 0 ${width} ${height}`}
        className={`h-auto w-full [&:focus:not(:focus-visible)]:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${className}`}
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
                id={latticeId}
                patternUnits="userSpaceOnUse"
                x={padLeft + band / 2 + lattice.colOffset - lattice.colPitch / 2}
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
              x={padLeft - DOT_R}
              y={PAD_T - DOT_R}
              width={plotWidth + DOT_R * 2}
              height={plotHeight + DOT_R * 2}
              fill={`url(#${latticeId})`}
              opacity={0.6}
            />
          </>
        )}

        {gridLines.map((value) => axisText(plot, value))}

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
            const columnHeight = Math.abs(y(0) - y(Math.abs(value)));
            return (
              <rect
                key={`${segment.id}-${index}`}
                data-segment={segment.id}
                x={px(x(index) - barWidth / 2)}
                y={px(value > 0 ? y(start) : y(base))}
                width={px(barWidth)}
                height={px(columnHeight)}
                fill={segment.color}
              />
            );
          }),
        )}

        <line data-zero x1={padLeft} y1={zeroY} x2={width - padRight} y2={zeroY} stroke={INK} strokeWidth={1} />

        {hover !== null && isActive ? (
          <line data-hover-guide x1={x(hover)} x2={x(hover)} y1={PAD_T - 6} y2={height - PAD_B} stroke={CHART_LATTICE} strokeWidth={1} />
        ) : null}

        {overlayPath !== null && overlayPath !== "" && (
          <path data-overlay d={overlayPath} fill="none" stroke={INK} strokeWidth={1.5} />
        )}
        {overlayLastValue !== null ? (
          <circle data-overlay-end cx={px(x(overlayLast))} cy={px(y(overlayLastValue))} r={3.5} fill={INK} />
        ) : null}

        {periods.map((period, index) => {
          if (!plot.labels.has(index)) return null;
          const start = plot.labels.get(index) ?? null;
          return (
            <text
              key={`label-${period}`}
              x={start === null ? x(index) : px(start)}
              y={height - 8}
              textAnchor={start === null ? "middle" : "start"}
              fontSize={FONT}
              fill={CHART_AXIS_LABEL}
              style={{ fontFamily: "var(--font-numeric)" }}
            >
              {formatPeriod(period)}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    // role="img" belongs on the svg, not the figure: it is children-presentational,
    // so on the figure it would hide the sr-only figcaption that carries the numbers.
    <figure ref={layoutRef} className="m-0">
      <ChartScrollFrame
        testId="stack-chart-frame"
        scrollKey={scrollKey}
        fit={active.mobile}
        yAxis={active.mobile ? undefined : stickyAxis}
        overlay={!active.mobile && pinned !== null ? readout : null}
      >
        {measured ? (
          renderSvg(active, "block")
        ) : (
          <>
            {renderSvg(desktop, `block ${DESKTOP_ONLY}`)}
            {renderSvg(phone!, MOBILE_ONLY)}
          </>
        )}

        {!active.mobile && pinned === null ? readout : null}
      </ChartScrollFrame>
      {active.mobile ? readout : null}

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
                return last === null || last === undefined ? "—" : formatOverlayValue(last);
              })()}
            </li>
          )}
        </ul>
      </figcaption>
    </figure>
  );
}
