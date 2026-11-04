"use client";

import { useId, type KeyboardEvent } from "react";
import { stepPeriodIndex } from "../../lib/explorer/chartNavigation";
import { axisLabelWidth, axisLeftPaddingFor, decimalsFor, fitAxisLabels, niceScale, periodAnchors } from "../../lib/explorer/chartScale";
import { CHART_AXIS_LABEL, CHART_LATTICE, INK, PAPER } from "../../lib/explorer/colors";
import { buildDotLattice, type DotLattice } from "../../lib/explorer/dotLattice";
import { formatInUnit } from "../../lib/explorer/format";
import { periodLabelIndices } from "../../lib/explorer/periodAxis";
import { SwatchBar } from "../ui/editorial";
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
type StackedColumnChartBaseProps = {
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
  /** The scroll frame's landmark name, for a page whose other chart already has the default one. */
  frameLabel?: string;
  /** Periods per calendar year on the x axis: 12 for months (default), 1 for years. */
  periodsPerYear?: number;
  /** A colour key drawn as a swatch row above the plot, so colour is never the only cue (DESIGN.md §13); none when absent or empty. */
  legend?: { id: string; label: string; color: string }[];
  /** Counting changes drawn as a dashed rule before their period, as the line chart draws them; none when absent. */
  breaks?: ReadonlyArray<{ period: number; label: string }>;
  /** The chosen period: its axis label is always drawn, in ink at weight 600 over a short ink rule; labels that would touch it are dropped. */
  highlightPeriod?: number;
  /** Draws at the frame's measured width on every screen, as on a phone, for a chart in a column narrower than the 920-unit desktop drawing. */
  fitWidth?: boolean;
  /** Values written on given columns: above a column that rises from zero, below one that only hangs under it; none when absent. */
  valueLabels?: ReadonlyArray<{ period: number; text: string }>;
  /** Names, in the screen-reader caption, the period each line's latest value is from (`label · period: value`); off by default. */
  captionPeriods?: boolean;
};
/** Columns from `projectionFrom` on are hatched, and the readout header says so with `projectionLabel`. */
export type StackedColumnChartProps = StackedColumnChartBaseProps &
  ({ projectionFrom?: undefined; projectionLabel?: string } | { projectionFrom: number; projectionLabel: string });

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

/**
 * SVG coordinates at full double precision cost ~40 characters a rect and buy
 * nothing: the viewBox is 1000 units wide, so a hundredth is far below a pixel.
 */
const px = (value: number) => Number(value.toFixed(2));
const MAX_BAR_WIDTH = 28;
// The highlighted period's rule under its label, and the hatch of projected columns.
const HIGHLIGHT_RULE_WIDTH = 16;
const HIGHLIGHT_RULE_HEIGHT = 2;
const HATCH_SIZE = 6;
const HATCH_STRIPE = 3;
// Axis labels keep this much clear between them (fitAxisLabels' own default).
const LABEL_GAP = 8;
// A value label sits this far off its column's end.
const VALUE_LABEL_GAP = 4;

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
    segments.map((segment) => ({ id: segment.id, label: segment.label, color: segment.color, vals: segment.values })),
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

/** The readout's header at one period: its label, and the projection label from the first projected period on. */
export function stackReadoutHeader(
  period: number,
  formatPeriod: (period: number) => string,
  projectionFrom?: number,
  projectionLabel?: string,
): string {
  const label = formatPeriod(period);
  return projectionFrom !== undefined && period >= projectionFrom && projectionLabel ? `${label} ${projectionLabel}` : label;
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
  frameLabel,
  periodsPerYear = 12,
  legend,
  breaks,
  highlightPeriod,
  fitWidth = false,
  valueLabels,
  captionPeriods = false,
  projectionFrom,
  projectionLabel,
}: StackedColumnChartProps) {
  const captionId = useId();
  // useId yields ":" or "«" in its ids, which a url(#…) reference does not take; the hatch and lattice ids are built
  // from it, so each chart on a page fills from its own patterns.
  const hatchId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const highlightIndex = highlightPeriod === undefined ? -1 : periods.indexOf(highlightPeriod);
  // One hatch per segment colour, so two segments sharing a colour share a pattern.
  const hatchColors = projectionFrom === undefined ? [] : [...new Set(segments.map((segment) => segment.color))];
  const { ref: layoutRef, mobileWidth } = useChartLayout<HTMLElement>(fitWidth);
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
    // On a phone a label starts where it fits: centred on its column, slid
    // inward at the plot's edges, and thinned until no two collide.
    const start = (index: number) => {
      const labelWidth = axisLabelWidth(formatPeriod(periods[index]!), FONT);
      return Math.min(width - padRight - labelWidth, Math.max(padLeft, x(index) - labelWidth / 2));
    };
    if (mobile) {
      const fitted = fitAxisLabels(count, periodAnchors(periods, periodsPerYear), (index) => [
        start(index),
        start(index) + axisLabelWidth(formatPeriod(periods[index]!), FONT),
      ]);
      for (const index of fitted) labels.set(index, start(index));
    } else {
      for (const index of periodLabelIndices(periods, periodsPerYear)) labels.set(index, null);
    }
    if (highlightIndex >= 0) {
      // The chosen period is always labelled; any label that would touch it gives way.
      const extent = (index: number): [number, number] => {
        const labelWidth = axisLabelWidth(formatPeriod(periods[index]!), FONT);
        const left = labels.get(index) ?? x(index) - labelWidth / 2;
        return [left, left + labelWidth];
      };
      labels.set(highlightIndex, mobile ? start(highlightIndex) : null);
      const [chosenLeft, chosenRight] = extent(highlightIndex);
      for (const index of [...labels.keys()]) {
        if (index === highlightIndex) continue;
        const [left, right] = extent(index);
        if (!(right + LABEL_GAP <= chosenLeft || chosenRight + LABEL_GAP <= left)) labels.delete(index);
      }
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
        header={stackReadoutHeader(periods[hover]!, formatPeriod, projectionFrom, projectionLabel)}
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

  // The caption's mark on a value from a projected period; nothing (not an empty string) otherwise, so the markup is unchanged.
  const projectedAt = (index: number) =>
    projectionFrom !== undefined && index >= 0 && periods[index]! >= projectionFrom ? `, ${projectionLabel}` : null;
  // The caption's name for a line, with the period of its latest value when `captionPeriods` asks for it.
  const captionName = (label: string, index: number) => (captionPeriods && index >= 0 ? `${label} · ${formatPeriod(periods[index]!)}` : label);

  const renderSvg = (plot: Plot, className: string) => {
    const { width, height, padLeft, padRight, band, barWidth, x, y, lattice } = plot;
    const latticeId = `${hatchId}-lattice${plot.mobile ? "-mobile" : ""}`;
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
    // The highlight's rule sits under the middle of its label, which starts at its x on a phone and is centred on it on a desktop.
    const highlightStart = plot.labels.get(highlightIndex);
    const highlightCentre =
      highlightStart === undefined
        ? null
        : highlightStart === null
          ? x(highlightIndex)
          : highlightStart + axisLabelWidth(formatPeriod(periods[highlightIndex]!), FONT) / 2;
    // The phone and desktop drawings share a page before the browser measures, so each gets its own ids.
    const hatchPatternId = (drawing: Plot, colorIndex: number) => `${hatchId}-${drawing.mobile ? "mobile" : "desktop"}-${colorIndex}`;

    return (
      <svg
        key={plot.mobile ? "mobile" : "desktop"}
        ref={isActive ? svgRef : undefined}
        data-geometry={plot.mobile ? "mobile" : "desktop"}
        data-fit-width={fitWidth ? "" : undefined}
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

        {hatchColors.length > 0 && (
          <defs>
            {hatchColors.map((color, colorIndex) => (
              <pattern
                key={color}
                id={hatchPatternId(plot, colorIndex)}
                patternUnits="userSpaceOnUse"
                width={HATCH_SIZE}
                height={HATCH_SIZE}
                patternTransform="rotate(45)"
              >
                <rect width={HATCH_SIZE} height={HATCH_SIZE} fill={PAPER} />
                <rect width={HATCH_STRIPE} height={HATCH_SIZE} fill={color} />
              </pattern>
            ))}
          </defs>
        )}

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
            const projected = projectionFrom !== undefined && periods[index]! >= projectionFrom;
            return (
              <rect
                key={`${segment.id}-${index}`}
                data-segment={segment.id}
                data-projection={projected ? "" : undefined}
                x={px(x(index) - barWidth / 2)}
                y={px(value > 0 ? y(start) : y(base))}
                width={px(barWidth)}
                height={px(columnHeight)}
                fill={projected ? `url(#${hatchPatternId(plot, hatchColors.indexOf(segment.color))})` : segment.color}
              />
            );
          }),
        )}

        <line data-zero x1={padLeft} y1={zeroY} x2={width - padRight} y2={zeroY} stroke={INK} strokeWidth={1} />

        {hover !== null && isActive ? (
          <line data-hover-guide x1={x(hover)} x2={x(hover)} y1={PAD_T - 6} y2={height - PAD_B} stroke={CHART_LATTICE} strokeWidth={1} />
        ) : null}

        {(breaks ?? []).map((entry) => {
          // A break needs the period before it on the axis; a range that starts at it has nothing to separate.
          const index = periods.indexOf(entry.period);
          if (index < 1) return null;
          const bx = px(x(index) - band / 2);
          const toTheLeft = bx > width / 2;
          return (
            <g key={`break-${entry.period}`} data-testid="chart-break">
              <line x1={bx} x2={bx} y1={PAD_T} y2={height - PAD_B} stroke={CHART_AXIS_LABEL} strokeWidth={1} strokeDasharray="4 3" />
              <text x={toTheLeft ? bx - 5 : bx + 5} y={PAD_T + 10} fontSize={FONT} fill={CHART_AXIS_LABEL} textAnchor={toTheLeft ? "end" : "start"} style={{ fontFamily: "var(--font-numeric)" }}>
                {entry.label}
              </text>
            </g>
          );
        })}

        {overlayPath !== null && overlayPath !== "" && (
          <path data-overlay d={overlayPath} fill="none" stroke={INK} strokeWidth={1.5} />
        )}
        {overlayLastValue !== null ? (
          <circle data-overlay-end cx={px(x(overlayLast))} cy={px(y(overlayLastValue))} r={3.5} fill={INK} />
        ) : null}

        {(valueLabels ?? []).map((entry) => {
          const index = periods.indexOf(entry.period);
          if (index < 0) return null;
          // The column's ends: the top of its positive stack, the bottom of its negative one.
          let positive = 0;
          let negative = 0;
          for (const segment of segments) {
            const value = segment.values[index];
            if (value === null || value === undefined) continue;
            if (value > 0) positive += value;
            else negative += value;
          }
          const labelWidth = axisLabelWidth(entry.text, FONT);
          // Inside the plot: clear of the period labels below it and of the drawing's sides.
          const ly = positive > 0 ? y(positive) - VALUE_LABEL_GAP : Math.min(y(negative) + FONT + VALUE_LABEL_GAP, height - PAD_B - 2);
          const lx = Math.min(width - padRight - labelWidth / 2, Math.max(padLeft + labelWidth / 2, x(index)));
          return (
            <text
              key={`value-${entry.period}`}
              data-value-label={entry.period}
              x={px(lx)}
              y={px(ly)}
              textAnchor="middle"
              fontSize={FONT}
              fontWeight={600}
              fill={INK}
              stroke={PAPER}
              strokeWidth={3}
              paintOrder="stroke"
              style={{ fontFamily: "var(--font-numeric)" }}
            >
              {entry.text}
            </text>
          );
        })}

        {periods.map((period, index) => {
          if (!plot.labels.has(index)) return null;
          const start = plot.labels.get(index) ?? null;
          const chosen = index === highlightIndex;
          return (
            <text
              key={`label-${period}`}
              x={start === null ? x(index) : px(start)}
              y={height - 8}
              textAnchor={start === null ? "middle" : "start"}
              fontSize={FONT}
              fontWeight={chosen ? 600 : undefined}
              fill={chosen ? INK : CHART_AXIS_LABEL}
              style={{ fontFamily: "var(--font-numeric)" }}
            >
              {formatPeriod(period)}
            </text>
          );
        })}

        {highlightCentre !== null ? (
          <rect
            data-highlight
            x={px(highlightCentre - HIGHLIGHT_RULE_WIDTH / 2)}
            y={height - 5}
            width={HIGHLIGHT_RULE_WIDTH}
            height={HIGHLIGHT_RULE_HEIGHT}
            fill={INK}
          />
        ) : null}
      </svg>
    );
  };

  return (
    // role="img" belongs on the svg, not the figure: it is children-presentational,
    // so on the figure it would hide the sr-only figcaption that carries the numbers.
    <figure ref={layoutRef} className="m-0">
      {legend?.length ? (
        <ul data-testid="stack-chart-legend" className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.6875rem] text-[var(--muted)]">
          {legend.map((entry) => (
            <li key={entry.id} data-legend-series-id={entry.id} className="flex min-w-0 items-center gap-2">
              <SwatchBar color={entry.color} />
              <span className="min-w-0 break-words">{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ChartScrollFrame
        testId="stack-chart-frame"
        label={frameLabel}
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

      {/* The chart is never colour-only: the same numbers read as text, a projected one marked as its column is. */}
      <figcaption id={captionId} className="sr-only">
        <ul>
          {segments.map((segment) => {
            const lastIndex = segment.values.findLastIndex((value) => value !== null && value !== undefined);
            const last = lastIndex < 0 ? undefined : segment.values[lastIndex];
            return (
              <li key={segment.id}>
                {captionName(segment.label, lastIndex)}: {last === null || last === undefined ? "—" : formatValue(last)}
                {projectedAt(lastIndex)}
              </li>
            );
          })}
          {overlay !== null && (
            <li>
              {captionName(overlay.label, overlay.values.findLastIndex((value) => value !== null && value !== undefined))}:{" "}
              {(() => {
                const last = [...overlay.values].reverse().find((value) => value !== null && value !== undefined);
                return last === null || last === undefined ? "—" : formatOverlayValue(last);
              })()}
              {projectedAt(overlay.values.findLastIndex((value) => value !== null && value !== undefined))}
            </li>
          )}
        </ul>
      </figcaption>
    </figure>
  );
}
