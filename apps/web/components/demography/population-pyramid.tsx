"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { axisLabelWidth, decimalsFor } from "../../lib/explorer/chartScale";
import { INK, SERIES_COLORS } from "../../lib/explorer/colors";
import { ageGroupLabel, bandShares, shareOf, type AgeMeasure, type Pyramid } from "../../lib/explorer/demographyAgeSex";
import { formatInUnit, formatShare, thousandsUnit } from "../../lib/explorer/format";
import { PYRAMID, pyramidLayout } from "../../lib/explorer/pyramidLayout";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { TemplateValues } from "../../lib/i18n/types";
import { ChartTooltip, MOBILE_CHART_QUERY } from "../main-explorer/chart-frame";
import type { TooltipRow } from "../main-explorer/editorial-line-chart";
import { SwatchBar } from "../ui/editorial";
import { persons } from "./demography-helpers";

const MALE = SERIES_COLORS["sex.male"]!;
const FEMALE = SERIES_COLORS["sex.female"]!;
const MONO = { fontFamily: "var(--font-numeric)" };
/** Room kept between the header row and the first bar. */
const HEADER_GAP = 6;
/** Room kept between two tick labels on one side. */
const TICK_GAP = 8;

type Comparison = { pyramid: Pyramid; year: number } | null;

/** The pyramid's values in the displayed measure: percent of its own total, or persons. */
function measured(pyramid: Pyramid, measure: AgeMeasure) {
  const value = (count: number) => (measure === "share" ? shareOf(count, pyramid.total) : count);
  return {
    male: pyramid.rows.map((row) => value(row.male)),
    female: pyramid.rows.map((row) => value(row.female)),
    total: pyramid.rows.map((row) => value(row.male + row.female)),
  };
}

/**
 * Men left, women right, one row per five-year age group (design spec §6). The drawing
 * is laid out at its container's measured width, so 11px labels never scale; before
 * measurement (and on the server) it lays out at 520px and scales to fit.
 */
export function PopulationPyramid({ pyramid, year, compare, measure, ariaLabel, testId }: {
  pyramid: Pyramid;
  /** The drawn year, named in the legend beside the comparison year. */
  year?: number;
  compare: Comparison;
  measure: AgeMeasure;
  ariaLabel: string;
  testId: string;
}) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const frame = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [phone, setPhone] = useState(false);
  const [roving, setRoving] = useState(pyramid.rows.length - 1);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ index: number; visible: boolean } | null>(null);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const query = typeof window.matchMedia === "function" ? window.matchMedia(MOBILE_CHART_QUERY) : null;
    const measure = () => {
      setFrameWidth(Math.round(element.clientWidth));
      setPhone(query?.matches ?? false);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    query?.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      query?.removeEventListener("change", measure);
    };
  }, []);

  const values = measured(pyramid, measure);
  const compared = compare === null ? null : measured(compare.pyramid, measure);
  const layout = pyramidLayout({ width: frameWidth ?? PYRAMID.serverWidth, male: values.male, female: values.female, compare: compared });
  const { width, height, centreLeft, centreRight } = layout;
  const plotBottom = PYRAMID.header + pyramid.rows.length * PYRAMID.rowPitch;

  const percent = (value: number) => formatShare(value / 100);
  const formatValue = measure === "share" ? percent : persons;

  // Tick labels: percent with the step's decimals, or thousands with the unit on the outermost label.
  const step = layout.ticks[1]!.value - layout.ticks[0]!.value;
  const thousands = thousandsUnit(locale);
  const tickUnit = { ...thousands, decimals: decimalsFor(step / thousands.divisor, 4) };
  const tickText = (value: number, outermost: boolean) =>
    measure === "share"
      ? `${value.toFixed(decimalsFor(step, 2))}%`
      : outermost ? `${formatInUnit(value, tickUnit)} ${thousands.label}` : formatInUnit(value, tickUnit);
  const widest = Math.max(...layout.ticks.map((tick) => axisLabelWidth(tickText(tick.value, true))));
  const pixelStep = centreLeft - layout.ticks[1]!.leftX;
  const stride = Math.max(1, Math.ceil((widest + TICK_GAP) / pixelStep));
  const labelled = layout.ticks.map((_, index) => index).filter((index) => index % stride === 0);
  const outermost = labelled.at(-1)!;
  const clampX = (x: number, label: string) => {
    const halfLabel = axisLabelWidth(label) / 2;
    return Math.min(width - halfLabel, Math.max(halfLabel, x));
  };

  const rowAria = (index: number) => {
    const row = pyramid.rows[index]!;
    const own = {
      age: ageGroupLabel(row.group),
      men: persons(row.male),
      women: persons(row.female),
      total: persons(row.male + row.female),
      share: formatShare((row.male + row.female) / pyramid.total),
    };
    if (compare === null) return t("rowAria", own);
    // The national table is gone, so the comparison year is spoken here rather than left unreachable.
    const other = compare.pyramid.rows[index]!;
    return t("rowAriaCompare", {
      ...own,
      year: compare.year,
      cmpMen: persons(other.male),
      cmpWomen: persons(other.female),
      cmpTotal: persons(other.male + other.female),
      cmpShare: formatShare((other.male + other.female) / compare.pyramid.total),
    });
  };

  const moveFocus = (event: KeyboardEvent<SVGGElement>, index: number) => {
    const last = pyramid.rows.length - 1;
    const next =
      event.key === "ArrowUp" ? Math.min(last, index + 1)
      : event.key === "ArrowDown" ? Math.max(0, index - 1)
      : event.key === "Home" ? last
      : event.key === "End" ? 0
      : null;
    if (next === null) return;
    event.preventDefault();
    setRoving(next);
    event.currentTarget.parentElement?.querySelector<SVGGElement>(`[data-pyramid-row="${next}"]`)?.focus();
  };

  const active = hover ?? focus?.index ?? null;
  const tooltipRows: TooltipRow[] =
    active === null
      ? []
      : [
          { id: "male", label: t("sexMale"), color: MALE, value: values.male[active]! },
          { id: "female", label: t("sexFemale"), color: FEMALE, value: values.female[active]! },
          { id: "total", label: t("totalHeader"), color: INK, value: values.total[active]! },
          ...(compare === null || compared === null
            ? []
            : [
                { id: "compare-male", label: `${t("sexMale")} ${compare.year}`, color: MALE, value: compared.male[active]! },
                { id: "compare-female", label: `${t("sexFemale")} ${compare.year}`, color: FEMALE, value: compared.female[active]! },
                { id: "compare-total", label: `${t("totalHeader")} ${compare.year}`, color: INK, value: compared.total[active]! },
              ]),
        ];
  const tooltip =
    active === null ? null : (
      <ChartTooltip
        leftPercent={(centreRight / width) * 100}
        header={ageGroupLabel(pyramid.rows[active]!.group)}
        headerRight={compare !== null && year !== undefined ? String(year) : null}
        rows={tooltipRows}
        hidden={0}
        formatValue={formatValue}
        testId={`${testId}-tooltip`}
        variant={phone ? "panel" : "float"}
      />
    );

  const sideHeader = (side: "male" | "female", label: string, color: string, count: number) => (
    <span data-testid={`pyramid-header-${side}`} className={`${side === "female" ? "ml-auto " : ""}inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-[var(--ink)]`}>
      <SwatchBar color={color} />
      {label}
      <span className="font-[family-name:var(--font-numeric)]">{measure === "share" ? formatShare(count / pyramid.total) : persons(count)}</span>
    </span>
  );

  // DOM order is the reading order, oldest first, so Tab and a screen reader meet 85+ first.
  const order = pyramid.rows.map((_, index) => index).reverse();

  return (
    <div data-testid={testId}>
      {compare !== null ? (
        <div data-testid="pyramid-legend" className="mb-2 flex flex-wrap items-center gap-4 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
          {year === undefined ? null : (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="flex">
                <span className="h-2.5 w-[7px]" style={{ backgroundColor: MALE }} />
                <span className="h-2.5 w-[7px]" style={{ backgroundColor: FEMALE }} />
              </span>
              {year}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-3.5 border-[1.5px]" style={{ borderColor: INK }} />
            {compare.year}
          </span>
        </div>
      ) : null}
      <div ref={frame} className="relative">
        {/* In flow, so two long Georgian labels wrap onto two lines at 320px instead of overlapping; the drawing below is cropped to its plot. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" style={{ paddingInline: PYRAMID.pad }}>
          {sideHeader("male", t("sexMale"), MALE, pyramid.male)}
          {sideHeader("female", t("sexFemale"), FEMALE, pyramid.female)}
        </div>
        {/* The drawing's height comes from its rows, not its width: a fixed CSS height keeps the server's 520px layout and
            the measured one in the same box, so nothing below moves on hydration (U27-06). */}
        <svg viewBox={`0 ${PYRAMID.header - HEADER_GAP} ${width} ${height - PYRAMID.header + HEADER_GAP}`} role="group" aria-label={ariaLabel} className="block w-full" style={{ height: height - PYRAMID.header + HEADER_GAP }}>
          <rect x={0} y={layout.oldBandY} width={width} height={layout.oldBandHeight} fill="var(--tint)" aria-hidden />
          <text x={PYRAMID.pad} y={layout.oldBandY + 15} fontSize={11} fill="var(--muted)" style={MONO} aria-hidden>
            {t("oldBand", { share: formatShare(bandShares(pyramid).old / 100) })}
          </text>
          {layout.ticks.map((tick) => (
            <g key={tick.value} aria-hidden>
              <line x1={tick.leftX} x2={tick.leftX} y1={PYRAMID.header} y2={plotBottom} stroke="var(--hairline-soft)" strokeWidth={1} />
              <line x1={tick.rightX} x2={tick.rightX} y1={PYRAMID.header} y2={plotBottom} stroke="var(--hairline-soft)" strokeWidth={1} />
            </g>
          ))}
          {labelled.map((index) => {
            const tick = layout.ticks[index]!;
            const label = tickText(tick.value, index === outermost);
            return (
              <g key={tick.value} aria-hidden>
                <text x={clampX(tick.leftX, label)} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor="middle" style={MONO}>{label}</text>
                <text x={clampX(tick.rightX, label)} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor="middle" style={MONO}>{label}</text>
              </g>
            );
          })}
          {order.map((index) => {
            const row = layout.rows[index]!;
            const cellTop = row.y - (PYRAMID.rowPitch - PYRAMID.bar) / 2;
            return (
              <g
                key={index}
                data-pyramid-row={index}
                role="img"
                aria-label={rowAria(index)}
                tabIndex={index === roving ? 0 : -1}
                className="outline-none"
                onPointerEnter={(event) => { if (event.pointerType !== "touch") setHover(index); }}
                onPointerLeave={(event) => { if (event.pointerType !== "touch") setHover(null); }}
                onFocus={(event) => {
                  setRoving(index);
                  setFocus({ index, visible: event.currentTarget.matches(":focus-visible") });
                }}
                onBlur={() => setFocus(null)}
                onKeyDown={(event) => moveFocus(event, index)}
              >
                <rect x={0} y={cellTop} width={width} height={PYRAMID.rowPitch} fill="transparent" />
                <rect x={row.maleX} y={row.y} width={row.maleWidth} height={PYRAMID.bar} fill={MALE} />
                <rect x={centreRight} y={row.y} width={row.femaleWidth} height={PYRAMID.bar} fill={FEMALE} />
                <text x={(centreLeft + centreRight) / 2} y={row.y + PYRAMID.bar / 2 + 4} fontSize={11} fill="var(--ink)" textAnchor="middle" style={MONO}>
                  {ageGroupLabel(pyramid.rows[index]!.group)}
                </text>
                {focus?.index === index && focus.visible ? (
                  <rect x={1} y={cellTop + 1} width={width - 2} height={PYRAMID.rowPitch - 2} fill="none" stroke="var(--accent)" strokeWidth={2} />
                ) : null}
              </g>
            );
          })}
          {layout.outline === null ? null : (
            <g aria-hidden fill="none" stroke={INK} strokeWidth={1.5}>
              <path data-testid="pyramid-outline-left" d={layout.outline.left} />
              <path data-testid="pyramid-outline-right" d={layout.outline.right} />
            </g>
          )}
        </svg>
        {phone ? null : tooltip}
      </div>
      {phone ? tooltip : null}
    </div>
  );
}

const HEAD_CELL = "border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-[9px] text-right text-[11px] font-semibold text-[var(--muted)] whitespace-nowrap";
const NUMBER_CELL = "px-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap text-[var(--ink)]";
const LABEL_CELL = "sticky left-0 z-[1] bg-[var(--paper)] pr-3 text-left whitespace-nowrap shadow-[1px_0_0_var(--hairline-soft)]";
const CELL_PAD = { paddingTop: 11, paddingBottom: 11 };

/** The pyramid's table twin: persons and shares by age, oldest first, then the total. */
export function PyramidTable({ pyramid, caption }: { pyramid: Pyramid; caption: string }) {
  const { messages } = useI18n();
  const t = (key: string) => message(messages, `demography.${key}`);
  const headers = [t("sexMale"), t("sexFemale"), t("totalHeader"), t("shareHeader")];
  const cells = (male: number, female: number, bold: boolean) =>
    [male, female, male + female].map((value, column) => (
      <td key={column} className={NUMBER_CELL} style={{ ...CELL_PAD, fontWeight: bold ? 600 : 400 }}>
        {persons(value)}
      </td>
    )).concat(
      <td key="share" className={NUMBER_CELL} style={{ ...CELL_PAD, fontWeight: bold ? 600 : 400 }}>
        {formatShare((male + female) / pyramid.total)}
      </td>,
    );

  return (
    <div className="mt-[18px]">
      <div role="region" tabIndex={0} aria-label={caption} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className={`${LABEL_CELL} border-b-2 border-[var(--ink)] pt-1.5 pb-[9px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]`}>
                {t("ageGroupHeader")}
              </th>
              {headers.map((header, column) => (
                <th key={column} scope="col" className={HEAD_CELL}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...pyramid.rows].reverse().map((row) => (
              <tr key={row.group} className="border-b border-[var(--hairline-soft)] hover:bg-[var(--tint)]">
                <th scope="row" className={`${LABEL_CELL} font-[family-name:var(--font-numeric)] text-[12.5px] font-medium text-[var(--ink)]`} style={CELL_PAD}>
                  {ageGroupLabel(row.group)}
                </th>
                {cells(row.male, row.female, false)}
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--ink)]">
              <th scope="row" className={`${LABEL_CELL} text-[13px] font-semibold text-[var(--ink)]`} style={CELL_PAD}>
                {t("totalHeader")}
              </th>
              {cells(pyramid.male, pyramid.female, true)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
