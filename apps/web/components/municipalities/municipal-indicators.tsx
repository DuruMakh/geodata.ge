import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import type { MunicipalComparisonRow, MunicipalIndicatorPresentation, MunicipalKpiSet, MunicipalMover } from "../../lib/explorer/municipalData";
import { formatAmount, formatAmountParts, formatShare } from "../../lib/explorer/format";
import type { Locale } from "../../lib/i18n/types";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { SectionTitle } from "../ui/editorial";
import { withLari } from "../ui/lari";
import { HeroKpi, KPI_GRID_CLASS, MoverRow, PeriodComparisonTable, SideKpiList } from "../main-explorer/kpi-blocks";

// KPI row (DESIGN.md §7.11), movers board (§7.13) and the period comparison.

/**
 * An amount whose unit may drop under its number: below 768px the comparison table
 * fits the phone column (as the national one does) instead of scrolling, and each
 * row carries its own magnitude (მლნ / მლრდ), so the unit cannot move to the header.
 */
function AmountText({ value, signed = false, locale }: { value: number | null | undefined; signed?: boolean; locale: Locale }) {
  const parts = formatAmountParts(value, signed, locale);
  return (
    <>
      <span className="whitespace-nowrap">{parts.num}</span>
      {parts.unit ? <> <span className="whitespace-nowrap @max-[768px]:text-[0.6875rem]">{parts.unit}</span></> : null}
    </>
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
  const { locale, messages } = useI18n();
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
  const deltaParts = formatAmountParts(Math.abs((headline.end ?? 0) - (headline.start ?? 0)), false, locale);
  const showSentence = headline.start !== null && headline.end !== null && headline.start !== headline.end;
  const sideKpis = [kpis.official, kpis.largestField, kpis.standing];

  return (
    <section data-testid="period-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <SectionTitle>{message(messages, "municipal.indicators")}</SectionTitle>
          <p className="text-[0.78125rem] text-[var(--muted)]">
            <Message messages={messages} id="municipal.selectedPeriod" values={{ period: <span className="font-[family-name:var(--font-numeric)]">{singleYear ? startYear : `${startYear}–${endYear}`}</span> }} />
          </p>
        </div>

        <div data-testid="entity-kpi-grid" className={KPI_GRID_CLASS}>
          {singleYear ? (
            <div className="min-w-0 @min-[1100px]:pr-11">
              <p data-testid="period-single-year-note" className="max-w-[420px] text-[0.8125rem] leading-relaxed text-[var(--muted)]">
                {message(messages, "main.noPeriod")}
              </p>
            </div>
          ) : (
          <HeroKpi label={message(messages, "municipal.periodChange")} value={formatShare(headline.change, true)} valueColor={headline.change !== null && headline.change < 0 ? NEGATIVE : "var(--ink)"} testId="entity-kpi">
            <div data-testid="municipal-change-gauge" className="flex h-[3px] bg-[var(--hairline-soft)]">
              <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${(gaugeBase * 100).toFixed(1)}%` }} />
              <div className="h-[3px] bg-[var(--accent)]" style={{ width: `${((1 - gaugeBase) * 100).toFixed(1)}%` }} />
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <p data-testid="municipal-change-start" className="font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--muted)]">
                {startYear} · {formatAmount(headline.start, locale)}
              </p>
              <p data-testid="municipal-change-end" className="font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--muted)]">
                {endYear} · {formatAmount(headline.end, locale)}
              </p>
            </div>
            {showSentence ? (
              <p data-testid="municipal-change-sentence" className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">
                <Message messages={messages} id={grew ? "municipal.changeIncreased" : "municipal.changeDecreased"} values={{
                  start: startYear, end: endYear,
                  amount: <span className="font-[family-name:var(--font-numeric)] text-xs">{withLari(`${deltaParts.num} ${deltaParts.unit}`.trim())}</span>,
                  annual: headline.cagr !== null ? <Message messages={messages} id={headline.cagr >= 0 ? "municipal.annualGrowth" : "municipal.annualChange"} values={{ rate: <span className="font-[family-name:var(--font-numeric)] text-xs">{formatShare(headline.cagr, true)}</span> }} /> : ".",
                }} />
              </p>
            ) : null}
          </HeroKpi>
          )}
          <SideKpiList rowTestId="entity-kpi" kpis={sideKpis.map((kpi, index) => ({ label: kpi.label, value: kpi.value, unit: kpi.unit ?? "", color: "var(--ink)", detail: kpi.detail, spark: { values: sideSeries[index]!, color: "var(--ink)" } }))} />
        </div>

      {singleYear ? null : (
      <div data-testid="period-movers" className="mt-9 grid gap-7 border-t border-[var(--hairline)] pt-6 @min-[1100px]:grid-cols-2 @min-[1100px]:gap-x-10">
        <div className="min-w-0">
          <h3 className="mb-3 text-[0.8125rem] font-semibold text-[var(--ink)]">{message(messages, "municipal.fastestGrowth")}</h3>
          <div className="flex flex-col">
            {movers.up.map((mover) => (
              <MoverRow key={mover.label} rank={mover.rank} label={mover.label} change={mover.growth} maxAbs={maxAbs} />
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 text-[0.8125rem] font-semibold text-[var(--ink)]">{message(messages, "municipal.slowestGrowth")}</h3>
          <div className="flex flex-col">
            {movers.down.map((mover) => (
              <MoverRow key={mover.label} rank={mover.rank} label={mover.label} change={mover.growth} maxAbs={maxAbs} />
            ))}
          </div>
        </div>
      </div>
      )}

      {singleYear ? null : (
        <PeriodComparisonTable
          variant="municipal"
          heading={message(messages, "municipal.periodComparison")}
          caption={message(messages, "municipal.comparisonCaption", { name: entityLabel, start: startYear, end: endYear })}
          firstColumnLabel={message(messages, "municipal.function")}
          changeLabel={message(messages, "municipal.change")}
          startYear={startYear}
          endYear={endYear}
          rows={comparison.map((row) => ({
            key: row.label, label: row.label, title: row.label, color: row.color, emphasis: row.isTotal,
            start: <AmountText value={row.fromGel} locale={locale} />,
            change: <AmountText value={row.changeGel} signed locale={locale} />,
            changeColor: growthColor(row.changeShare),
            end: <AmountText value={row.toGel} locale={locale} />,
          }))}
        />
      )}
    </section>
  );
}
