"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { buildDotLattice, type DotLattice } from "../../lib/explorer/dotLattice";
import { formatInUnit, formatShare, type ValueUnit } from "../../lib/explorer/format";
import { periodLabelIndices } from "../../lib/explorer/periodAxis";
import {
  AXIS_LABEL_GAP,
  axisLabelWidth,
  axisLeftPaddingFor,
  decimalsFor,
  fitAxisLabels,
  niceScale,
  periodAnchors,
} from "../../lib/explorer/chartScale";
import { CHART_AXIS_LABEL, CHART_LATTICE } from "../../lib/explorer/colors";
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

// Bespoke SVG line chart per DESIGN.md §8.3: chart sits directly on paper, dot
// lattice for the grid, ink baseline at zero, mono axis labels, hover crosshair + tooltip.

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  vals: (number | null)[];
  planned: boolean[];
  preliminary?: boolean[];
  forecastFromYear?: number;
  /** Reference lines (the NBG target) draw dashed and without an end dot. */
  dashed?: boolean;
  /** A series the chart's breaks do not apply to keeps its line joined across them. */
  continuousAcrossBreaks?: boolean;
  /** Draws a hollow point on each `preliminary` value, so it is marked without hovering. */
  hollowPreliminary?: boolean;
};

type EditorialLineChartProps = {
  years: number[];
  series: ChartSeries[];
  share: boolean;
  unit: ValueUnit;
  shareLabel: string;
  preliminaryLabel?: string;
  showAxisUnit?: boolean;
  formatTooltipValue?: (value: number) => string;
  /** Periods per calendar year on the x axis. Omit for years. */
  periodsPerYear?: number;
  /** Axis label or tooltip header for a period value. Omit to print the value. */
  formatPeriod?: (period: number, kind: "axis" | "tooltip") => string;
  /** Annual charts only. No line joins the year before one of these years to it; a dashed rule and the short label mark the gap. */
  breaks?: ReadonlyArray<{ year: number; label: string }>;
};

const W = 920;
const H = 320;
// The house minimum (DESIGN.md §8.3). Wider labels ("50.0 მლრდ", "10,000 მლნ")
// widen it through axisLeftPaddingFor, or their first digit clips at the viewBox edge.
const PAD_L = 74;
const PAD_R = 30;
const PAD_T = 16;
const PAD_B = 26;
const DOT_R = 0.7;
const FONT = 11;
// The phone drawing (one unit per CSS pixel): tick labels carry numbers only and
// the unit is printed once above the axis, so the labels leave the plot its width.
const MOBILE_PAD_L = 30;
const MOBILE_PAD_R = 12;
const MOBILE_PAD_T = 26;
const LATTICE_ID = "chart-dot-lattice";
const MIN_LATTICE_PITCH = 12;

export type TooltipRow = {
  id: string;
  label: string;
  color: string;
  value: number;
  preliminary?: boolean;
  /** Draws a coloured arrow in place of the colour bar: "up" for a gain, "down" for a loss. */
  marker?: "up" | "down";
  /** The full name read to screen readers when `label` is a shortened visible one. */
  srLabel?: string;
};

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
    present.push({ id: line.id, label: line.label, color: line.color, value, ...(line.preliminary?.[hover] ? { preliminary: true } : {}) });
  }
  present.sort((a, b) => b.value - a.value);

  return { rows: present.slice(0, cap), hidden: Math.max(0, present.length - cap) };
}

/** Phone lattices keep the 12px floor by joining whole periods into one column. */
export function coarsenLattice(lattice: DotLattice | null): DotLattice | null {
  if (lattice === null || lattice.colPitch >= MIN_LATTICE_PITCH) return lattice;
  return { ...lattice, colPitch: lattice.colPitch * Math.ceil(MIN_LATTICE_PITCH / lattice.colPitch - 1e-9) };
}

type Plot = {
  mobile: boolean;
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  axisLabels: string[];
  labelIndices: Set<number>;
  lattice: DotLattice | null;
  x: (index: number) => number;
  y: (value: number) => number;
};

export function EditorialLineChart({
  years,
  series,
  share,
  unit,
  shareLabel,
  showAxisUnit = true,
  periodsPerYear = 1,
  formatPeriod,
  preliminaryLabel,
  formatTooltipValue,
  breaks,
}: EditorialLineChartProps) {
  const { messages } = useI18n();
  const { ref: layoutRef, mobileWidth } = useChartLayout();
  const n = years.length;

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
  // An amount axis never prints finer than its unit's last decimal, so the
  // gridline step is a whole multiple of that quantum; a share axis has none.
  const amountQuantum = unit.divisor / 10 ** unit.decimals;
  const { top, bottom, step } = niceScale(minValue, maxValue, share ? 0 : amountQuantum);
  const span = top - bottom;

  // Axis precision follows the gridline STEP, not the unit's data-derived
  // decimals. The unit carries enough precision for the smallest value in the
  // table (which is what sets amountQuantum above, so a small series still gets
  // a readable domain); the axis only ever prints multiples of the step, so
  // borrowing those decimals would render a 12.5 gridline as "12.50".
  const shareDigits = decimalsFor(step, 2);
  const axisUnit = { ...unit, decimals: decimalsFor(step / unit.divisor, 4) };
  const formatAxis = (value: number, withUnit: boolean) =>
    (share
      ? `${value.toFixed(shareDigits)}%`
      : withUnit && showAxisUnit
        ? `${formatInUnit(value, axisUnit)} ${unit.label}`
        : formatInUnit(value, axisUnit)
    ).replace("-", "−");
  // The phone drawing prints the amount unit once, above the axis.
  const unitCaption = share || unit.label.trim() === "" ? null : unit.label;

  const formatValue = (value: number | null) =>
    formatTooltipValue && value !== null ? formatTooltipValue(value) : share ? formatShare(value === null ? null : value / 100) : formatInUnit(value, unit);
  const axisPeriod = (index: number) => (formatPeriod ? formatPeriod(years[index]!, "axis") : String(years[index]));

  const gridLines = Array.from({ length: Math.round(span / step) + 1 }, (_, index) => bottom + step * index);
  // A break needs the year before it on the axis too; a range that starts at the break year has nothing to separate.
  const breakMarks = (breaks ?? [])
    .map((entry) => ({ ...entry, index: years.indexOf(entry.year) }))
    .filter((entry) => entry.index > 0);
  const breakIndices = new Set(breakMarks.map((entry) => entry.index));

  const buildPlot = (mobile: boolean, width: number): Plot => {
    const height = mobile ? mobileChartHeight(width, 0.72, 220, 320) : H;
    const padRight = mobile ? MOBILE_PAD_R : PAD_R;
    const padTop = mobile && unitCaption !== null ? MOBILE_PAD_T : PAD_T;
    const axisLabels = gridLines.map((value) => formatAxis(value, !mobile));
    const padLeft = axisLeftPaddingFor(axisLabels, mobile ? MOBILE_PAD_L : PAD_L);
    const plotWidth = width - padLeft - padRight;
    const x = (index: number) => padLeft + (n <= 1 ? plotWidth / 2 : (index * plotWidth) / (n - 1));
    const y = (value: number) => padTop + ((top - value) / span) * (height - padTop - PAD_B);
    const labelIndices = new Set(
      mobile
        ? fitAxisLabels(n, periodAnchors(years, periodsPerYear), (index) => {
            const labelWidth = axisLabelWidth(axisPeriod(index), FONT);
            if (index === 0) return [x(index) - 4, x(index) - 4 + labelWidth];
            if (index === n - 1) return [x(index) + 4 - labelWidth, x(index) + 4];
            return [x(index) - labelWidth / 2, x(index) + labelWidth / 2];
          })
        : periodLabelIndices(years, periodsPerYear),
    );
    const lattice = buildDotLattice({
      plotWidth,
      plotHeight: height - padTop - PAD_B,
      yearCount: n,
      gridStepCount: Math.round(span / step),
      periodsPerYear,
      firstPeriod: years[0],
    });
    return { mobile, width, height, padLeft, padRight, padTop, axisLabels, labelIndices, lattice: mobile ? coarsenLattice(lattice) : lattice, x, y };
  };

  const desktop = buildPlot(false, W);
  // Before the browser has measured (server render, hydration) both drawings
  // exist and CSS shows one; afterwards only the one that fits is rendered.
  const phone = mobileWidth === null ? null : buildPlot(true, mobileWidth ?? MOBILE_PREVIEW_WIDTH);
  const measured = mobileWidth !== undefined;
  const active = mobileWidth === null || mobileWidth === undefined ? desktop : phone!;

  const { svgRef, hover, pinned, handlers } = useChartPointer(n, active.width, active.padLeft, active.padRight);

  const axisText = (plot: Plot, value: number, index: number) => (
    <text key={`axis-${index}`} x={plot.padLeft - AXIS_LABEL_GAP} y={plot.y(value) + 3} fontSize={FONT} fill={CHART_AXIS_LABEL} textAnchor="end" style={{ fontFamily: "var(--font-numeric)" }}>
      {plot.axisLabels[index]}
    </text>
  );
  // The sticky copy stops above the year labels, so it never covers the first one.
  // Only a desktop drawing that overflows its frame shows it; phones fit.
  const stickyAxis = {
    widthPercent: (desktop.padLeft / W) * 100,
    node: (
      <svg viewBox={`0 0 ${desktop.padLeft} ${H - PAD_B + 6}`} className="block h-auto w-full">
        {gridLines.map((value, index) => axisText(desktop, value, index))}
        <line x1={desktop.padLeft - 0.5} x2={desktop.padLeft - 0.5} y1={PAD_T} y2={H - PAD_B} stroke="#D9CFBE" strokeWidth={1} />
      </svg>
    ),
  };
  const scrollKey = `${years[0]}-${years[n - 1]}-${series.map((line) => line.id).join(",")}`;

  const tooltip = hover === null ? null : buildTooltipRows(series, hover);
  const readout =
    hover !== null && tooltip !== null ? (
      <ChartTooltip
        leftPercent={(active.x(hover) / active.width) * 100}
        pinned={pinned}
        header={formatPeriod ? formatPeriod(years[hover]!, "tooltip") : String(years[hover])}
        headerRight={share ? shareLabel : null}
        rows={tooltip.rows}
        hidden={tooltip.hidden}
        formatValue={formatValue}
        preliminaryLabel={preliminaryLabel}
        variant={active.mobile ? "panel" : "float"}
      />
    ) : null;

  const renderSvg = (plot: Plot, className: string) => {
    const { width, height, padLeft, padRight, padTop, x, y, lattice, labelIndices } = plot;
    const latticeId = plot.mobile ? `${LATTICE_ID}-mobile` : LATTICE_ID;
    return (
      <svg
        key={plot.mobile ? "mobile" : "desktop"}
        ref={plot === active ? svgRef : undefined}
        data-geometry={plot.mobile ? "mobile" : "desktop"}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={message(messages, "controls.chartTrend")}
        className={`h-auto w-full ${className}`}
        {...handlers}
      >
        {lattice ? (
          <>
            <defs>
              <pattern
                id={latticeId}
                patternUnits="userSpaceOnUse"
                x={padLeft + lattice.colOffset - lattice.colPitch / 2}
                y={padTop - lattice.rowPitch / 2}
                width={lattice.colPitch}
                height={lattice.rowPitch}
              >
                <circle cx={lattice.colPitch / 2} cy={lattice.rowPitch / 2} r={DOT_R} fill={CHART_LATTICE} />
              </pattern>
            </defs>
            {/* Grown by one dot radius on every side: the pitch divides the plot
                box exactly, so dots land on all four bounds, and a pattern fill
                clips to the shape it fills — without this the border columns and
                rows draw as half dots (quarters at the corners). */}
            <rect
              data-testid="chart-dot-lattice"
              x={padLeft - DOT_R}
              y={padTop - DOT_R}
              width={width - padLeft - padRight + DOT_R * 2}
              height={height - padTop - PAD_B + DOT_R * 2}
              fill={`url(#${latticeId})`}
              opacity={0.6}
            />
          </>
        ) : null}
        {plot.mobile && unitCaption !== null ? (
          <text data-unit-caption x={0} y={FONT} fontSize={FONT} fill={CHART_AXIS_LABEL} textAnchor="start" style={{ fontFamily: "var(--font-numeric)" }}>
            {unitCaption}
          </text>
        ) : null}
        {gridLines.map((value, index) => (
          <g key={`grid-${index}`}>
            {/* The lattice carries the grid, so only zero keeps a drawn rule — a
                negative domain is unreadable without it. When there is no lattice
                (a single-year range has no interval to divide) the rules come back,
                or the axis labels would have nothing to sit against. */}
            {value === 0 || lattice === null ? (
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y(value)}
                y2={y(value)}
                stroke={value === 0 ? "#1E1B16" : "#E7DECF"}
                strokeWidth={1}
              />
            ) : null}
            {axisText(plot, value, index)}
          </g>
        ))}
        <line x1={padLeft} x2={padLeft} y1={padTop} y2={height - PAD_B} stroke="#D9CFBE" strokeWidth={1} />
        {years.map((year, index) => {
          if (!labelIndices.has(index)) return null;
          const isLast = index === n - 1;
          const anchor = index === 0 ? "start" : isLast ? "end" : "middle";
          const tx = index === 0 ? x(index) - 4 : isLast ? x(index) + 4 : x(index);

          return (
            <text key={`year-${year}`} x={tx} y={height - 8} fontSize={FONT} fill={CHART_AXIS_LABEL} textAnchor={anchor} style={{ fontFamily: "var(--font-numeric)" }}>
              {axisPeriod(index)}
            </text>
          );
        })}
        {hover !== null && plot === active ? (
          <line x1={x(hover)} x2={x(hover)} y1={padTop - 6} y2={height - PAD_B} stroke={CHART_LATTICE} strokeWidth={1} />
        ) : null}
        {breakMarks.map((entry) => {
          const bx = (x(entry.index - 1) + x(entry.index)) / 2;
          const toTheLeft = bx > width / 2;
          return (
            <g key={`break-${entry.year}`} data-testid="chart-break">
              <line x1={bx} x2={bx} y1={padTop} y2={height - PAD_B} stroke={CHART_AXIS_LABEL} strokeWidth={1} strokeDasharray="4 3" />
              <text x={toTheLeft ? bx - 5 : bx + 5} y={padTop + 10} fontSize={FONT} fill={CHART_AXIS_LABEL} textAnchor={toTheLeft ? "end" : "start"} style={{ fontFamily: "var(--font-numeric)" }}>
                {entry.label}
              </text>
            </g>
          );
        })}
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
              if (!line.continuousAcrossBreaks && breakIndices.has(index) && run.length > 0) {
                segments.push(run);
                run = [];
              }
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
                  {...(line.forecastFromYear !== undefined
                    ? { "data-testid": `chart-series-${line.id}-actual` }
                    : line.dashed
                      ? { "data-testid": `chart-series-${line.id}-dashed` }
                      : {})}
                  d={actualPath}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2.2}
                  strokeDasharray={line.dashed ? "6 5" : undefined}
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
              {line.dashed ? null : <circle cx={last[0]} cy={last[1]} r={3.5} fill={line.color} />}
              {points
                .filter(([, , index]) => line.planned[index] || (line.hollowPreliminary && line.preliminary?.[index]))
                .map(([px, py, index]) => (
                  <circle key={`planned-${index}`} cx={px} cy={py} r={3} fill="#F7F2E9" stroke={line.color} strokeWidth={1.5} />
                ))}
              {hover !== null && plot === active && line.vals[hover] !== null && line.vals[hover] !== undefined ? (
                <circle cx={x(hover)} cy={y(line.vals[hover] as number)} r={3.5} fill="#F7F2E9" stroke={line.color} strokeWidth={2} />
              ) : null}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div ref={layoutRef}>
      <ChartScrollFrame
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
    </div>
  );
}
