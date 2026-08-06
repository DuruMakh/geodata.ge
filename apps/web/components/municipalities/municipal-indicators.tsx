import type { MunicipalComparisonRow, MunicipalKpi, MunicipalMover } from "../../lib/explorer/municipalData";
import { formatAmount, formatShare, MISSING } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { SwatchBar } from "../ui/editorial";

// KPI row (DESIGN.md §7.11), movers board (§7.13) and the period comparison.

function MoverRow({ mover, maxAbs }: { mover: MunicipalMover; maxAbs: number }) {
  const growth = mover.growth;
  const width = growth === null || maxAbs === 0 ? 0 : (Math.abs(growth) / maxAbs) * 100;

  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)_96px_72px] items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2">
      <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
        {String(mover.rank).padStart(2, "0")}
      </span>
      <span className="truncate text-[12.5px]">{mover.kaLabel}</span>
      <span className="h-[3px] bg-[var(--hairline-soft)]">
        <span
          className="block h-[3px]"
          style={{ width: `${width.toFixed(0)}%`, backgroundColor: growthColor(growth) }}
        />
      </span>
      <span className="text-right font-[family-name:var(--font-numeric)] text-[11.5px]" style={{ color: growthColor(growth) }}>
        {formatShare(growth, true)}
      </span>
    </div>
  );
}

/** Positive/negative token for a growth figure; muted when there is no value. */
function growthColor(growth: number | null): string {
  if (growth === null) return "var(--muted)";
  return growth >= 0 ? POSITIVE : NEGATIVE;
}

type MunicipalIndicatorsProps = {
  kpis: MunicipalKpi[];
  movers: { up: MunicipalMover[]; down: MunicipalMover[] };
  comparison: MunicipalComparisonRow[];
  startYear: number;
  endYear: number;
};

export function MunicipalIndicators({ kpis, movers, comparison, startYear, endYear }: MunicipalIndicatorsProps) {
  const maxAbs = Math.max(
    ...[...movers.up, ...movers.down].map((mover) => Math.abs(mover.growth ?? 0)),
    Number.EPSILON,
  );

  return (
    <>
      <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
        <h2 className="mb-[18px] font-[family-name:var(--font-display)] text-[22px] font-semibold">ძირითადი ინდიკატორები</h2>
        <div data-testid="entity-kpi-grid" className="grid grid-cols-2 gap-8 @min-[1100px]:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} data-testid="entity-kpi" className="flex flex-col gap-[5px]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{kpi.label}</span>
              <span className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] whitespace-nowrap">
                {kpi.value}
              </span>
              <span className="text-[11.5px] leading-snug text-[var(--muted)]">{kpi.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-11 grid grid-cols-1 gap-10 border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:grid-cols-2">
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">ყველაზე მზარდი</div>
          {movers.up.map((mover) => (
            <MoverRow key={mover.kaLabel} mover={mover} maxAbs={maxAbs} />
          ))}
        </div>
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">ყველაზე ნელი ზრდა</div>
          {movers.down.map((mover) => (
            <MoverRow key={mover.kaLabel} mover={mover} maxAbs={maxAbs} />
          ))}
        </div>
      </div>

      <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
        <div className="mb-3.5 flex items-baseline justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold whitespace-nowrap">პერიოდის შედარება</h2>
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
            {startYear} → {endYear}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table data-testid="comparison-table" className="w-full border-collapse" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                {["ფუნქცია", String(startYear), "ცვლილება", String(endYear)].map((label, index) => (
                  <th
                    key={label}
                    className={`border-b-2 border-[var(--ink)] pb-[7px] text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)] ${
                      index === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr
                  key={row.kaLabel}
                  className={`border-b border-[var(--hairline-soft)] ${row.isTotal ? "bg-[var(--tint)]" : ""}`}
                >
                  <td className="py-[9px]">
                    <span className="inline-flex items-center gap-[9px]">
                      <SwatchBar color={row.color} />
                      <span className={`truncate text-[12.5px] ${row.isTotal ? "font-semibold" : "font-medium"}`}>
                        {row.kaLabel}
                      </span>
                    </span>
                  </td>
                  <td className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--body)]">
                    {formatAmount(row.fromGel)}
                  </td>
                  <td
                    className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px]"
                    style={{ color: growthColor(row.changeShare) }}
                  >
                    {row.changeShare === null ? MISSING : `${formatShare(row.changeShare, true)}  ${formatAmount(row.changeGel)}`}
                  </td>
                  <td className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px] font-semibold">
                    {formatAmount(row.toGel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
