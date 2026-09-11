import type { ReactNode } from "react";
import { Overline } from "../ui/editorial";
import { Sparkline } from "../ui/sparkline";

// The two presentational halves of ძირითადი ინდიკატორები (DESIGN.md §8.5),
// shared by the budget Indicators and the inflation overview. Callers own the
// figures, the gauge and the sentence; these own the anatomy.

export function HeroKpi({ label, value, valueColor = "var(--ink)", children }: { label: string; value: string; valueColor?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 @min-[1100px]:pr-11">
      <Overline>{label}</Overline>
      <p
        className="mt-3.5 whitespace-nowrap font-[family-name:var(--font-display)] text-[44px] font-semibold leading-none tracking-[-0.02em] min-[768px]:text-[62px]"
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
  spark: { values: (number | null)[]; color: string } | null;
};

export function SideKpiList({ kpis }: { kpis: SideKpi[] }) {
  return (
    <div className="mt-[26px] flex min-w-0 flex-col border-t border-[var(--hairline)] pt-[18px] @min-[1100px]:mt-0 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:pt-0 @min-[1100px]:pl-9">
      {kpis.map((kpi, index) => (
        <div
          key={kpi.label}
          data-testid="side-kpi"
          className={index === 0 ? "pt-0.5 pb-3.5" : index === kpis.length - 1 ? "border-t border-[var(--hairline-soft)] pt-3.5" : "border-t border-[var(--hairline-soft)] py-3.5"}
        >
          <Overline>{kpi.label}</Overline>
          <div className="mt-[7px] flex items-baseline justify-between gap-4">
            <p
              className="whitespace-nowrap font-[family-name:var(--font-display)] text-2xl font-semibold leading-[1.1] tracking-[-0.02em]"
              style={{ color: kpi.color }}
            >
              {kpi.value}
              {kpi.unit ? (
                <span className="ml-1.5 font-[family-name:var(--font-numeric)] text-xs font-medium tracking-normal text-[var(--body)]">
                  {kpi.unit}
                </span>
              ) : null}
            </p>
            <p title={kpi.detail} className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-xs text-[var(--muted)]">
              {kpi.detail}
            </p>
          </div>
          {kpi.spark ? <Sparkline values={kpi.spark.values} color={kpi.spark.color} /> : null}
        </div>
      ))}
    </div>
  );
}
