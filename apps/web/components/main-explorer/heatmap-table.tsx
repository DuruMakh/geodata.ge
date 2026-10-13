"use client";
import { useEffect, useRef } from "react";
import { MAP_RAMP } from "../../lib/explorer/colors";
import { unemploymentAgeHeatmapBin } from "../../lib/explorer/unemploymentAge";
import { STATUS_MARK_CLASS } from "./explorer-table";
import { SectionTitle } from "../ui/editorial";

type HeatmapRow = { id: string; label: string; values: (number | null)[] };

/** Rows by years, each cell shaded on the shared six-step ramp, then the scale legend.
 *  With `breakYear`, that year's column gets a rule on its left and the header prints `breakLabel`.
 *  With `wrapRowLabels`, long row labels wrap inside a bounded column instead of staying on one line. */
export function HeatmapTable({ caption, rowHeader, years, rows, maximum, format, scaleLabel, breakYear, breakLabel, wrapRowLabels }: {
  caption: string;
  rowHeader: string;
  years: readonly number[];
  rows: HeatmapRow[];
  maximum: number;
  format: (value: number | null) => string;
  scaleLabel: string;
  breakYear?: number;
  breakLabel?: string;
  wrapRowLabels?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const yearsKey = years.join(",");
  // Where the table is wider than its column (phones), open on the newest years.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [yearsKey]);
  const breakStyle = (year: number) => (year === breakYear ? { borderLeft: "2px solid var(--ink)" } : undefined);
  return <>
    <div className="mt-5">
      <div ref={scroller} data-testid="age-heatmap-scroller" role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
      <table className="w-full border-separate border-spacing-1 text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>
          <th scope="col" className="sticky left-0 z-10 bg-[var(--paper)] px-3 py-2 text-left text-[11px] font-medium text-[var(--muted)]">{rowHeader}</th>
          {years.map(year => <th key={year} scope="col" style={breakStyle(year)} className="min-w-[78px] px-3 py-2 text-center font-[family-name:var(--font-numeric)] text-[11px] font-medium text-[var(--muted)]">
            {year}
            {breakLabel && year === breakYear ? <sup className={`${STATUS_MARK_CLASS} normal-case tracking-normal`}>{breakLabel}</sup> : null}
          </th>)}
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} data-heatmap-group={row.id}>
          <th scope="row" className={`sticky left-0 z-10 ${wrapRowLabels ? "min-w-[150px] max-w-[240px] text-[12px] leading-snug" : "whitespace-nowrap"} bg-[var(--paper)] px-3 py-2 text-left font-normal text-[var(--ink)]`}>{row.label}</th>
          {row.values.map((value, index) => {
            const bin = value === null ? null : unemploymentAgeHeatmapBin(value, maximum, MAP_RAMP.length);
            return <td key={years[index]} data-heatmap-cell={`${row.id}:${years[index]}`} data-value={value ?? ""} data-bin={bin ?? ""} className="px-3 py-2 text-center font-[family-name:var(--font-numeric)] tabular-nums"
              style={{ ...(bin === null ? { color: "var(--ink)" } : { backgroundColor: MAP_RAMP[bin], color: bin === MAP_RAMP.length - 1 ? "var(--paper)" : "var(--ink)" }), ...breakStyle(years[index]) }}>{format(value)}</td>;
          })}
        </tr>)}</tbody>
      </table>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
      <span>{format(0)}</span><span aria-hidden className="flex">{MAP_RAMP.map(fill => <span key={fill} className="h-2 w-[18px]" style={{ backgroundColor: fill }} />)}</span><span>{format(maximum)}</span>
      <span>{scaleLabel}</span>
    </div>
  </>;
}

/** A heat map as its own page section: title, caption (the table's name too), a note, then the table and its scale.
 *  `indicator` and `unit` mark what it shows for tests; the caller supplies every word and the number format. */
export function HeatmapSection({ testId, indicator, unit, title, caption, note, scaleLabel, rowHeader, years, rows, maximum, format, wrapRowLabels }: {
  testId: string;
  indicator: string;
  unit: string;
  title: string;
  caption: string;
  note: string;
  scaleLabel: string;
  rowHeader: string;
  years: readonly number[];
  rows: HeatmapRow[];
  maximum: number;
  format: (value: number | null) => string;
  wrapRowLabels?: boolean;
}) {
  return <section data-testid={testId} data-indicator={indicator} data-unit={unit} className="mt-12 border-t-2 border-[var(--ink)] pt-5">
    <SectionTitle>{title}</SectionTitle>
    <p className="mt-2 text-[12px] text-[var(--body)]">{caption}</p>
    <p className="mt-2 max-w-[800px] text-[12px] leading-relaxed text-[var(--muted)]">{note}</p>
    <HeatmapTable caption={caption} rowHeader={rowHeader} years={years} rows={rows} maximum={maximum} format={format} scaleLabel={scaleLabel} wrapRowLabels={wrapRowLabels} />
  </section>;
}
