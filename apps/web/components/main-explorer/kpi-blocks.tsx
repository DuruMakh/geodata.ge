import type { ReactNode } from "react";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { formatShare } from "../../lib/explorer/format";
import { Overline, SwatchBar } from "../ui/editorial";
import { withLari } from "../ui/lari";
import { Sparkline } from "../ui/sparkline";

// The two presentational halves of ძირითადი ინდიკატორები (DESIGN.md §8.5),
// shared by the budget Indicators and the inflation overview. Callers own the
// figures, the gauge and the sentence; these own the anatomy.
//
// The sector, regional and municipal pages lay out their own cards (their own
// test ids, spans and sparklines), so the anatomy they repeat is exported as
// class strings too: one place to change the grid, the side column and its rules.

/** Hero column beside the side KPIs, stacked below 1100px of column width. */
/** A side-KPI detail line: one ellipsized line on wide screens, wrapping on phones, where the full name is the information. */
export const KPI_DETAIL_CLIP_CLASS =
  "overflow-hidden text-ellipsis whitespace-nowrap @max-[768px]:overflow-visible @max-[768px]:whitespace-normal @max-[768px]:break-words";

/** A mover-row label (DESIGN.md §7.13): ellipsized on wide screens, wrapping on phones so names stay distinguishable. */
export const MOVER_LABEL_CLASS = KPI_DETAIL_CLIP_CLASS;

export const KPI_GRID_CLASS = "mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]";
export const HERO_KPI_VALUE_CLASS = "mt-3.5 whitespace-nowrap font-[family-name:var(--font-display)] text-[44px] font-semibold leading-none tracking-[-0.02em] min-[768px]:text-[62px]";
export const SIDE_KPI_LIST_CLASS = "mt-[26px] flex min-w-0 flex-col border-t border-[var(--hairline)] pt-[18px] @min-[1100px]:mt-0 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:pt-0 @min-[1100px]:pl-9";
export const SIDE_KPI_VALUE_CLASS = "whitespace-nowrap font-[family-name:var(--font-display)] text-2xl font-semibold leading-[1.1] tracking-[-0.02em]";
export const KPI_UNIT_CLASS = "ml-1.5 font-[family-name:var(--font-numeric)] text-xs font-medium tracking-normal text-[var(--body)]";

/** A hairline between side KPIs; the first row has none and the last no bottom padding. */
export function sideKpiRowClass(index: number, count: number): string {
  return index === 0 ? "pt-0.5 pb-3.5" : index === count - 1 ? "border-t border-[var(--hairline-soft)] pt-3.5" : "border-t border-[var(--hairline-soft)] py-3.5";
}

/** `unit` sits after the figure in the UI face (₾ in the sans lari glyph); the ids are for pages that test their hero. */
export function HeroKpi({ label, value, unit, valueColor = "var(--ink)", testId, valueTestId, children }: { label: string; value: string; unit?: string; valueColor?: string; testId?: string; valueTestId?: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="min-w-0 @min-[1100px]:pr-11">
      <Overline>{label}</Overline>
      <p
        data-testid={valueTestId}
        className={HERO_KPI_VALUE_CLASS}
        style={{ color: valueColor }}
      >
        {value}
        {unit ? <span className="ml-1.5 font-[family-name:var(--font-numeric)] text-base font-medium tracking-normal text-[var(--body)]">{withLari(unit)}</span> : null}
      </p>
      <div className="mt-7 max-w-[480px]">{children}</div>
    </div>
  );
}

export type SideKpi = {
  label: string;
  value: string;
  unit: string;
  color: string;
  detail: string;
  wrapDetail?: boolean;
  spark: { values: (number | null)[]; color: string } | null;
  /** Replaces the row's `side-kpi` test id. */
  testId?: string;
};

/** `testId` names the list; `rowTestId` wraps each row in an outer element with that id (municipal pages). */
export function SideKpiList({ kpis, testId, rowTestId }: { kpis: SideKpi[]; testId?: string; rowTestId?: string }) {
  return (
    <div data-testid={testId} className={SIDE_KPI_LIST_CLASS}>
      {kpis.map((kpi, index) => {
        const body = (
          <>
            <Overline>{kpi.label}</Overline>
            <div className="mt-[7px] flex items-baseline justify-between gap-4">
              <p
                className={SIDE_KPI_VALUE_CLASS}
                style={{ color: kpi.color }}
              >
                {kpi.value}
                {kpi.unit ? (
                  <span className={KPI_UNIT_CLASS}>
                    {withLari(kpi.unit)}
                  </span>
                ) : null}
              </p>
              <p title={kpi.detail} className={`min-w-0 text-right text-xs text-[var(--muted)] ${kpi.wrapDetail ? "break-words" : KPI_DETAIL_CLIP_CLASS}`}>
                {kpi.detail}
              </p>
            </div>
            {kpi.spark ? <Sparkline values={kpi.spark.values} color={kpi.spark.color} /> : null}
          </>
        );
        const rowClass = sideKpiRowClass(index, kpis.length);
        return rowTestId ? (
          <div key={kpi.label} data-testid={rowTestId} className={rowClass}>
            <div data-testid={kpi.testId ?? "side-kpi"}>{body}</div>
          </div>
        ) : (
          <div key={kpi.label} data-testid={kpi.testId ?? "side-kpi"} className={rowClass}>{body}</div>
        );
      })}
    </div>
  );
}

/** One "fastest / slowest growth" row: rank, name, a bar sized against the largest change, the signed share. */
export function MoverRow({ rank, label, change, maxAbs }: { rank: number; label: string; change: number | null; maxAbs: number }) {
  const color = change === null ? "var(--muted)" : change >= 0 ? POSITIVE : NEGATIVE;
  const width = change === null || maxAbs === 0 ? 0 : Math.max(4, Math.round((Math.abs(change) / maxAbs) * 100));
  return (
    <div title={label} className="grid grid-cols-[24px_minmax(0,1fr)_96px_72px] items-center gap-3 border-t border-[var(--hairline-soft)] py-2.5">
      <span className="font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--muted)]">
        {String(rank).padStart(2, "0")}
      </span>
      <span className={`text-[0.78125rem] font-medium leading-[1.4] text-[var(--ink)] ${MOVER_LABEL_CLASS}`}>{label}</span>
      <span className="block h-[3px] overflow-hidden bg-[var(--hairline-soft)]">
        <span className="block h-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </span>
      <span className="text-right font-[family-name:var(--font-numeric)] text-xs" style={{ color }}>
        {formatShare(change, true)}
      </span>
    </div>
  );
}

/** A start-year / change / end-year row; the cells arrive formatted. `emphasis` is the total row. */
export type ComparisonRow = { key: string; label: string; title: string; color: string; start: ReactNode; change: ReactNode; end: ReactNode; changeColor: string; emphasis: boolean };

// The national table sits in the budget column; the municipal one may scroll below
// 560px and narrows its name column on small phones, and its cells carry test ids.
const COMPARISON_CLASSES = {
  national: {
    cols: ["w-[44%]", undefined, "@max-[768px]:w-[76px]", undefined],
    th: [
      "border-b-2 border-[var(--ink)] pr-3 pt-1.5 pb-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]",
      "border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-2 text-right font-[family-name:var(--font-numeric)] text-[0.6875rem] font-semibold text-[var(--muted)] @max-[768px]:px-1",
      "border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] @max-[768px]:px-1 @max-[768px]:tracking-normal",
      "border-b-2 border-[var(--ink)] pl-3 pt-1.5 pb-2 text-right font-[family-name:var(--font-numeric)] text-[0.6875rem] font-semibold text-[var(--muted)] @max-[768px]:pl-1",
    ],
    nameCell: "py-2.5 pr-3",
    name: "min-w-0 text-[0.78125rem] leading-[1.4] text-[var(--ink)] [overflow-wrap:anywhere] @max-[768px]:text-[0.75rem]",
    start: "px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[0.78125rem] whitespace-nowrap text-[var(--muted)] @max-[768px]:px-1",
    change: "px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[0.78125rem] whitespace-nowrap @max-[768px]:px-1",
    end: "py-2.5 pl-3 text-right font-[family-name:var(--font-numeric)] text-[0.78125rem] whitespace-nowrap text-[var(--ink)] @max-[768px]:pl-1",
  },
  municipal: {
    // Phones: the change header needs ~76px on every platform, so the name column narrows
    // (12px names, tighter swatch gap) and leaves the two amounts (6,134.2) their room.
    cols: ["w-[44%] @max-[768px]:w-[40%] @max-[340px]:w-[33%]", undefined, "@max-[768px]:w-[76px] @max-[340px]:w-[80px]", undefined],
    th: [0, 1, 2, 3].map((index) => `border-b-2 border-[var(--ink)] ${index === 0 ? "pr-3 pt-1.5 pb-2 text-left" : index === 3 ? "pl-3 pt-1.5 pb-2 text-right @max-[768px]:pl-1" : "px-3 pt-1.5 pb-2 text-right @max-[768px]:px-1"} text-[0.6875rem] font-semibold ${index === 1 || index === 3 ? "font-[family-name:var(--font-numeric)]" : "uppercase tracking-[0.06em] @max-[768px]:tracking-normal"} text-[var(--muted)]`),
    nameCell: "py-2.5 pr-3 @max-[768px]:pr-2",
    name: "min-w-0 break-words text-[0.78125rem] leading-[1.4] text-[var(--ink)] @max-[768px]:text-[0.75rem]",
    start: "px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[0.78125rem] text-[var(--muted)] @max-[768px]:px-1",
    change: "px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[0.78125rem] @max-[768px]:px-1",
    end: "py-2.5 pl-3 text-right font-[family-name:var(--font-numeric)] text-[0.78125rem] text-[var(--ink)] @max-[768px]:pl-1",
  },
};

/** The period comparison under the movers (DESIGN.md §8.5): one row per series, start year, change, end year. */
export function PeriodComparisonTable({ heading, caption, firstColumnLabel, changeLabel, startYear, endYear, rows, variant = "national" }: {
  heading: string; caption: string; firstColumnLabel: string; changeLabel: string; startYear: number; endYear: number; rows: ComparisonRow[]; variant?: "national" | "municipal";
}) {
  const c = COMPARISON_CLASSES[variant];
  const municipal = variant === "municipal";
  const table = (
    <table data-testid={municipal ? "comparison-table" : undefined} className={municipal ? "w-full min-w-[560px] table-fixed border-collapse @max-[768px]:min-w-0" : "w-full table-fixed border-collapse"}>
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        {c.cols.map((className, index) => <col key={index} className={className} />)}
      </colgroup>
      <thead>
        <tr>
          {[firstColumnLabel, String(startYear), changeLabel, String(endYear)].map((label, index) => <th key={index} className={c.th[index]}>{label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const weight = row.emphasis ? 600 : 500;
          return (
            <tr key={row.key} className={municipal ? `border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)] ${row.emphasis ? "bg-[var(--tint)]" : ""}` : "border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)]"}>
              <td className={c.nameCell} title={row.title}>
                <span className="inline-flex min-w-0 items-start gap-[9px] @max-[768px]:gap-1.5">
                  <SwatchBar color={row.color} className="mt-[7px]" />
                  <span className={c.name} style={{ fontWeight: weight }}>{row.label}</span>
                </span>
              </td>
              <td className={c.start} style={{ fontWeight: weight }}>{row.start}</td>
              <td data-testid={municipal ? "comparison-change-cell" : undefined} className={c.change} style={{ color: row.changeColor }}>{row.change}</td>
              <td className={c.end} style={{ fontWeight: weight }}>{row.end}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <div data-testid="period-comparison" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h3 className="mb-1 text-[0.8125rem] font-semibold text-[var(--ink)]">{heading}</h3>
      {municipal ? <div className="overflow-x-auto">{table}</div> : table}
    </div>
  );
}
