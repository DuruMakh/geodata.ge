import type { MunicipalComparisonRow, MunicipalIndicatorPresentation, MunicipalKpiSet, MunicipalMover } from "../../lib/explorer/municipalData";
import { formatAmount, formatAmountParts, formatShare, formatSignedAmount } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { Sparkline } from "../ui/sparkline";
import { Overline, SectionTitle, SwatchBar } from "../ui/editorial";
import { NO_PERIOD_NOTE } from "../main-explorer/indicators";

// KPI row (DESIGN.md §7.11), movers board (§7.13) and the period comparison.

function MoverRow({ mover, maxAbs }: { mover: MunicipalMover; maxAbs: number }) {
  const growth = mover.growth;
  const width = growth === null || maxAbs === 0 ? 0 : Math.max(4, (Math.abs(growth) / maxAbs) * 100);

  return (
    <div title={mover.kaLabel} className="grid grid-cols-[24px_minmax(0,1fr)_96px_72px] items-center gap-3 border-t border-[var(--hairline-soft)] py-2.5">
      <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
        {String(mover.rank).padStart(2, "0")}
      </span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-medium leading-[1.4] text-[var(--ink)]">{mover.kaLabel}</span>
      <span className="block h-[3px] overflow-hidden bg-[var(--hairline-soft)]">
        <span className="block h-full" style={{ width: `${width.toFixed(0)}%`, backgroundColor: growthColor(growth) }} />
      </span>
      <span className="text-right font-[family-name:var(--font-numeric)] text-xs" style={{ color: growthColor(growth) }}>
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
  entityLabel: string;
  kpis: MunicipalKpiSet;
  movers: { up: MunicipalMover[]; down: MunicipalMover[] };
  comparison: MunicipalComparisonRow[];
  presentation: MunicipalIndicatorPresentation;
  startYear: number;
  endYear: number;
};

export function MunicipalIndicators({ entityLabel, kpis, movers, comparison, presentation, startYear, endYear }: MunicipalIndicatorsProps) {
  // Same degenerate case as the national section (indicators.tsx): a one-year
  // range leaves every delta at zero. All three side KPIs here are point-in-time
  // (level, rank, share), so only the hero, movers and comparison stand down —
  // `#r=2015-2015` is a supported way to read that year's rank.
  const singleYear = startYear === endYear;
  const maxAbs = Math.max(
    ...[...movers.up, ...movers.down].map((mover) => Math.abs(mover.growth ?? 0)),
    Number.EPSILON,
  );
  const { headline, sideSeries } = presentation;
  const gaugeMax = Math.max(headline.start ?? 0, headline.end ?? 0);
  const gaugeBase = gaugeMax > 0 ? Math.min(headline.start ?? 0, headline.end ?? 0) / gaugeMax : 0;
  const grew = (headline.end ?? 0) >= (headline.start ?? 0);
  const deltaParts = formatAmountParts(Math.abs((headline.end ?? 0) - (headline.start ?? 0)));
  const showSentence = headline.start !== null && headline.end !== null && headline.start !== headline.end;
  const sideKpis = [kpis.official, kpis.largestField, kpis.standing];

  return (
    <section data-testid="period-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <SectionTitle>ძირითადი ინდიკატორები</SectionTitle>
          <p className="text-[12.5px] text-[var(--muted)]">
            არჩეული პერიოდი: <span className="font-[family-name:var(--font-numeric)]">{singleYear ? startYear : `${startYear}–${endYear}`}</span>
          </p>
        </div>

        <div data-testid="entity-kpi-grid" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {singleYear ? (
            <div className="min-w-0 @min-[1100px]:pr-11">
              <p data-testid="period-single-year-note" className="max-w-[420px] text-[13px] leading-relaxed text-[var(--muted)]">
                {NO_PERIOD_NOTE}
              </p>
            </div>
          ) : (
          <div data-testid="entity-kpi" className="min-w-0 @min-[1100px]:pr-11">
            <Overline>პერიოდის ცვლილება</Overline>
            <p
              className="mt-3.5 whitespace-nowrap font-[family-name:var(--font-display)] text-[44px] font-semibold leading-none tracking-[-0.02em] min-[768px]:text-[62px]"
              style={{ color: headline.change !== null && headline.change < 0 ? NEGATIVE : "var(--ink)" }}
            >
              {formatShare(headline.change, true)}
            </p>
            <div className="mt-7 max-w-[480px]">
              <div data-testid="municipal-change-gauge" className="flex h-[3px] bg-[var(--hairline-soft)]">
                <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${(gaugeBase * 100).toFixed(1)}%` }} />
                <div className="h-[3px] bg-[var(--accent)]" style={{ width: `${((1 - gaugeBase) * 100).toFixed(1)}%` }} />
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <p data-testid="municipal-change-start" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {startYear} · {formatAmount(headline.start)}
                </p>
                <p data-testid="municipal-change-end" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {endYear} · {formatAmount(headline.end)}
                </p>
              </div>
              {showSentence ? (
                <p data-testid="municipal-change-sentence" className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
                  {startYear}–{endYear} წლებში ოფიციალური ბიუჯეტი {grew ? "გაიზარდა" : "შემცირდა"}{" "}
                  <span className="font-[family-name:var(--font-numeric)] text-xs">{`${deltaParts.num} ${deltaParts.unit}`.trim()}</span>
                  -ით
                  {headline.cagr !== null ? (
                    <>
                      {" — საშუალო წლიური "}
                      {headline.cagr >= 0 ? "ზრდა " : "ცვლილება "}
                      <span className="font-[family-name:var(--font-numeric)] text-xs">{formatShare(headline.cagr, true)}</span>.
                    </>
                  ) : (
                    "."
                  )}
                </p>
              ) : null}
            </div>
          </div>
          )}
          <div className="mt-[26px] flex min-w-0 flex-col border-t border-[var(--hairline)] pt-[18px] @min-[1100px]:mt-0 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:pt-0 @min-[1100px]:pl-9">
            {sideKpis.map((kpi, index) => (
              <div key={kpi.label} data-testid="entity-kpi" className={index === 0 ? "pt-0.5 pb-3.5" : index === 2 ? "border-t border-[var(--hairline-soft)] pt-3.5" : "border-t border-[var(--hairline-soft)] py-3.5"}>
                <div data-testid="side-kpi">
                  <Overline>{kpi.label}</Overline>
                  <div className="mt-[7px] flex items-baseline justify-between gap-4">
                    <span className="whitespace-nowrap font-[family-name:var(--font-display)] text-2xl font-semibold leading-[1.1] tracking-[-0.02em]">
                      {kpi.value}
                      {kpi.unit ? (
                        <span className="ml-1.5 font-[family-name:var(--font-numeric)] text-xs font-medium tracking-normal text-[var(--body)]">
                          {kpi.unit}
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-xs text-[var(--muted)]" title={kpi.detail}>{kpi.detail}</span>
                  </div>
                  <Sparkline values={sideSeries[index]!} color="var(--ink)" />
                </div>
              </div>
            ))}
          </div>
        </div>

      {singleYear ? null : (
      <div data-testid="period-movers" className="mt-9 grid gap-7 border-t border-[var(--hairline)] pt-6 @min-[1100px]:grid-cols-2 @min-[1100px]:gap-x-10">
        <div className="min-w-0">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--ink)]">ყველაზე მზარდი</h3>
          <div className="flex flex-col">
            {movers.up.map((mover) => (
              <MoverRow key={mover.kaLabel} mover={mover} maxAbs={maxAbs} />
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--ink)]">ყველაზე ნელი ზრდა</h3>
          <div className="flex flex-col">
            {movers.down.map((mover) => (
              <MoverRow key={mover.kaLabel} mover={mover} maxAbs={maxAbs} />
            ))}
          </div>
        </div>
      </div>
      )}

      {singleYear ? null : (
      <div data-testid="period-comparison" className="mt-9 border-t border-[var(--hairline)] pt-6">
        <h3 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">პერიოდის შედარება</h3>
        <div className="overflow-x-auto">
          <table data-testid="comparison-table" className="min-w-[560px] w-full table-fixed border-collapse">
            <caption className="sr-only">{`${entityLabel} — პერიოდის შედარება, ${startYear}–${endYear}`}</caption>
            <colgroup>
              <col className="w-[44%]" />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                {["ფუნქცია", String(startYear), "ცვლილება", String(endYear)].map((label, index) => (
                  <th
                    key={`comparison-header-${index}`}
                    className={`border-b-2 border-[var(--ink)] ${index === 0 ? "pr-3 pt-1.5 pb-2 text-left" : index === 3 ? "pl-3 pt-1.5 pb-2 text-right" : "px-3 pt-1.5 pb-2 text-right"} text-[11px] font-semibold ${index === 1 || index === 3 ? "font-[family-name:var(--font-numeric)]" : "uppercase tracking-[0.06em]"} text-[var(--muted)]`}
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
                  className={`border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)] ${row.isTotal ? "bg-[var(--tint)]" : ""}`}
                >
                  <td className="py-2.5 pr-3" title={row.kaLabel}>
                    <span className="inline-flex min-w-0 items-start gap-[9px]">
                      <SwatchBar color={row.color} className="mt-[7px]" />
                      <span className="text-[12.5px] leading-[1.4] text-[var(--ink)]" style={{ fontWeight: row.isTotal ? 600 : 500 }}>
                        {row.kaLabel}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap text-[var(--muted)]" style={{ fontWeight: row.isTotal ? 600 : 500 }}>
                    {formatAmount(row.fromGel)}
                  </td>
                  <td
                    data-testid="comparison-change-cell"
                    className="px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap"
                    style={{ color: growthColor(row.changeShare) }}
                  >
                    {formatSignedAmount(row.changeGel)}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap text-[var(--ink)]" style={{ fontWeight: row.isTotal ? 600 : 500 }}>
                    {formatAmount(row.toGel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </section>
  );
}
