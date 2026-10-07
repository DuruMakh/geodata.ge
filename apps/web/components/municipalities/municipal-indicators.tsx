import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import type { MunicipalComparisonRow, MunicipalIndicatorPresentation, MunicipalKpiSet, MunicipalMover } from "../../lib/explorer/municipalData";
import { formatAmount, formatAmountParts, formatShare } from "../../lib/explorer/format";
import type { Locale } from "../../lib/i18n/types";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { Sparkline } from "../ui/sparkline";
import { Overline, SectionTitle, SwatchBar } from "../ui/editorial";
import { HERO_KPI_VALUE_CLASS, KPI_DETAIL_CLIP_CLASS, KPI_GRID_CLASS, MOVER_LABEL_CLASS, KPI_UNIT_CLASS, SIDE_KPI_LIST_CLASS, SIDE_KPI_VALUE_CLASS, sideKpiRowClass } from "../main-explorer/kpi-blocks";

// KPI row (DESIGN.md §7.11), movers board (§7.13) and the period comparison.

function MoverRow({ mover, maxAbs }: { mover: MunicipalMover; maxAbs: number }) {
  const growth = mover.growth;
  const width = growth === null || maxAbs === 0 ? 0 : Math.max(4, (Math.abs(growth) / maxAbs) * 100);

  return (
    <div title={mover.label} className="grid grid-cols-[24px_minmax(0,1fr)_96px_72px] items-center gap-3 border-t border-[var(--hairline-soft)] py-2.5">
      <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
        {String(mover.rank).padStart(2, "0")}
      </span>
      <span className={`text-[12.5px] font-medium leading-[1.4] text-[var(--ink)] ${MOVER_LABEL_CLASS}`}>{mover.label}</span>
      <span className="block h-[3px] overflow-hidden bg-[var(--hairline-soft)]">
        <span className="block h-full" style={{ width: `${width.toFixed(0)}%`, backgroundColor: growthColor(growth) }} />
      </span>
      <span className="text-right font-[family-name:var(--font-numeric)] text-xs" style={{ color: growthColor(growth) }}>
        {formatShare(growth, true)}
      </span>
    </div>
  );
}

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
      {parts.unit ? <> <span className="whitespace-nowrap @max-[768px]:text-[11px]">{parts.unit}</span></> : null}
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
          <p className="text-[12.5px] text-[var(--muted)]">
            <Message messages={messages} id="municipal.selectedPeriod" values={{ period: <span className="font-[family-name:var(--font-numeric)]">{singleYear ? startYear : `${startYear}–${endYear}`}</span> }} />
          </p>
        </div>

        <div data-testid="entity-kpi-grid" className={KPI_GRID_CLASS}>
          {singleYear ? (
            <div className="min-w-0 @min-[1100px]:pr-11">
              <p data-testid="period-single-year-note" className="max-w-[420px] text-[13px] leading-relaxed text-[var(--muted)]">
                {message(messages, "main.noPeriod")}
              </p>
            </div>
          ) : (
          <div data-testid="entity-kpi" className="min-w-0 @min-[1100px]:pr-11">
            <Overline>{message(messages, "municipal.periodChange")}</Overline>
            <p
              className={HERO_KPI_VALUE_CLASS}
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
                  {startYear} · {formatAmount(headline.start, locale)}
                </p>
                <p data-testid="municipal-change-end" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {endYear} · {formatAmount(headline.end, locale)}
                </p>
              </div>
              {showSentence ? (
                <p data-testid="municipal-change-sentence" className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
                  <Message messages={messages} id={grew ? "municipal.changeIncreased" : "municipal.changeDecreased"} values={{
                    start: startYear, end: endYear,
                    amount: <span className="font-[family-name:var(--font-numeric)] text-xs">{`${deltaParts.num} ${deltaParts.unit}`.trim()}</span>,
                    annual: headline.cagr !== null ? <Message messages={messages} id={headline.cagr >= 0 ? "municipal.annualGrowth" : "municipal.annualChange"} values={{ rate: <span className="font-[family-name:var(--font-numeric)] text-xs">{formatShare(headline.cagr, true)}</span> }} /> : ".",
                  }} />
                </p>
              ) : null}
            </div>
          </div>
          )}
          <div className={SIDE_KPI_LIST_CLASS}>
            {sideKpis.map((kpi, index) => (
              <div key={kpi.label} data-testid="entity-kpi" className={sideKpiRowClass(index, sideKpis.length)}>
                <div data-testid="side-kpi">
                  <Overline>{kpi.label}</Overline>
                  <div className="mt-[7px] flex items-baseline justify-between gap-4">
                    <span className={SIDE_KPI_VALUE_CLASS}>
                      {kpi.value}
                      {kpi.unit ? (
                        <span className={KPI_UNIT_CLASS}>
                          {kpi.unit}
                        </span>
                      ) : null}
                    </span>
                    <span className={`min-w-0 text-right text-xs text-[var(--muted)] ${KPI_DETAIL_CLIP_CLASS}`} title={kpi.detail}>{kpi.detail}</span>
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
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--ink)]">{message(messages, "municipal.fastestGrowth")}</h3>
          <div className="flex flex-col">
            {movers.up.map((mover) => (
              <MoverRow key={mover.label} mover={mover} maxAbs={maxAbs} />
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--ink)]">{message(messages, "municipal.slowestGrowth")}</h3>
          <div className="flex flex-col">
            {movers.down.map((mover) => (
              <MoverRow key={mover.label} mover={mover} maxAbs={maxAbs} />
            ))}
          </div>
        </div>
      </div>
      )}

      {singleYear ? null : (
      <div data-testid="period-comparison" className="mt-9 border-t border-[var(--hairline)] pt-6">
        <h3 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">{message(messages, "municipal.periodComparison")}</h3>
        <div className="overflow-x-auto">
          <table data-testid="comparison-table" className="w-full min-w-[560px] table-fixed border-collapse @max-[768px]:min-w-0">
            <caption className="sr-only">{message(messages, "municipal.comparisonCaption", { name: entityLabel, start: startYear, end: endYear })}</caption>
            <colgroup>
              <col className="w-[44%]" />
              <col />
              <col className="@max-[768px]:w-[70px]" />
              <col />
            </colgroup>
            <thead>
              <tr>
                {[message(messages, "municipal.function"), String(startYear), message(messages, "municipal.change"), String(endYear)].map((label, index) => (
                  <th
                    key={`comparison-header-${index}`}
                    className={`border-b-2 border-[var(--ink)] ${index === 0 ? "pr-3 pt-1.5 pb-2 text-left" : index === 3 ? "pl-3 pt-1.5 pb-2 text-right @max-[768px]:pl-1" : "px-3 pt-1.5 pb-2 text-right @max-[768px]:px-1"} text-[11px] font-semibold ${index === 1 || index === 3 ? "font-[family-name:var(--font-numeric)]" : "uppercase tracking-[0.06em] @max-[768px]:tracking-normal"} text-[var(--muted)]`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr
                  key={row.label}
                  className={`border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)] ${row.isTotal ? "bg-[var(--tint)]" : ""}`}
                >
                  <td className="py-2.5 pr-3" title={row.label}>
                    <span className="inline-flex min-w-0 items-start gap-[9px]">
                      <SwatchBar color={row.color} className="mt-[7px]" />
                      <span className="text-[12.5px] leading-[1.4] text-[var(--ink)]" style={{ fontWeight: row.isTotal ? 600 : 500 }}>
                        {row.label}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[12.5px] text-[var(--muted)] @max-[768px]:px-1" style={{ fontWeight: row.isTotal ? 600 : 500 }}>
                    <AmountText value={row.fromGel} locale={locale} />
                  </td>
                  <td
                    data-testid="comparison-change-cell"
                    className="px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[12.5px] @max-[768px]:px-1"
                    style={{ color: growthColor(row.changeShare) }}
                  >
                    <AmountText value={row.changeGel} signed locale={locale} />
                  </td>
                  <td className="py-2.5 pl-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] text-[var(--ink)] @max-[768px]:pl-1" style={{ fontWeight: row.isTotal ? 600 : 500 }}>
                    <AmountText value={row.toGel} locale={locale} />
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
