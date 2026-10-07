import type { ReactNode } from "react";
import { Overline } from "../ui/editorial";
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

export function HeroKpi({ label, value, valueColor = "var(--ink)", children }: { label: string; value: string; valueColor?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 @min-[1100px]:pr-11">
      <Overline>{label}</Overline>
      <p
        className={HERO_KPI_VALUE_CLASS}
        style={{ color: valueColor }}
      >
        {value}
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
};

export function SideKpiList({ kpis }: { kpis: SideKpi[] }) {
  return (
    <div className={SIDE_KPI_LIST_CLASS}>
      {kpis.map((kpi, index) => (
        <div
          key={kpi.label}
          data-testid="side-kpi"
          className={sideKpiRowClass(index, kpis.length)}
        >
          <Overline>{kpi.label}</Overline>
          <div className="mt-[7px] flex items-baseline justify-between gap-4">
            <p
              className={SIDE_KPI_VALUE_CLASS}
              style={{ color: kpi.color }}
            >
              {kpi.value}
              {kpi.unit ? (
                <span className={KPI_UNIT_CLASS}>
                  {kpi.unit}
                </span>
              ) : null}
            </p>
            <p title={kpi.detail} className={`min-w-0 text-right text-xs text-[var(--muted)] ${kpi.wrapDetail ? "break-words" : KPI_DETAIL_CLIP_CLASS}`}>
              {kpi.detail}
            </p>
          </div>
          {kpi.spark ? <Sparkline values={kpi.spark.values} color={kpi.spark.color} /> : null}
        </div>
      ))}
    </div>
  );
}
