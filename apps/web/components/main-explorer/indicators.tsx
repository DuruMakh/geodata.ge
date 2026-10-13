"use client";

import type { ExplorerModel } from "../../lib/explorer/explorerData";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { Message } from "../../lib/i18n/message";
import type { ExplorerScope, ExplorerTableRow } from "../../lib/explorer/types";
import { ACCENT, NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { compoundAnnualGrowth, isGrowthRankable, rankPeriodDeltas } from "../../lib/explorer/indicators";
import { buildKpiShareSeries } from "../../lib/explorer/sparkline";
import { formatAmount, formatAmountParts, formatBn, formatShare, MISSING } from "../../lib/explorer/format";
import { SectionTitle } from "../ui/editorial";
import { withLari } from "../ui/lari";
import { HeroKpi, KPI_GRID_CLASS, MoverRow, PeriodComparisonTable, SideKpiList } from "./kpi-blocks";

// "ძირითადი ინდიკატორები" per DESIGN.md §8.5: hero KPI with a two-segment gauge and
// an editorial sentence, three side KPIs, the movers board, and the period comparison.

type IndicatorsProps = {
  model: ExplorerModel;
  scope: ExplorerScope;
};

/** The first table column's message key per scope; the explorer table uses it too. */
export const FIRST_COL_LABEL: Record<ExplorerScope, string> = {
  fields: "main.field",
  ministries: "main.institution",
  revenue: "main.budgetItem",
};

const SCOPE_LABEL: Record<ExplorerScope, string> = {
  fields: "main.fieldsScope",
  ministries: "main.ministriesScope",
  revenue: "main.revenueScope",
};

export function Indicators({ model, scope }: IndicatorsProps) {
  const { locale, messages, englishLabels } = useI18n();
  const rowLabel = (value: ExplorerTableRow) => publicLabel(locale, value.itemId, value.kaLabel, englishLabels);
  const { years, totalRow, comparisonRows, topGrowth, bottomGrowth } = model;
  const startYear = years[0];
  const endYear = years.at(-1);
  if (startYear === undefined || endYear === undefined) return null;

  // A range of one year has no start-to-end delta, so every delta-derived figure
  // here would read exactly zero — a headline 0.0%, movers falling back to row
  // order, and one category named both the largest and the slowest growing.
  // Only those blocks go; a point-in-time KPI is still a fact about the year.
  const singleYear = startYear === endYear;

  const totalStart = totalRow?.valuesByYear[startYear] ?? 0;
  const totalEnd = totalRow?.valuesByYear[endYear] ?? 0;
  const totalChange = totalRow?.change ?? null;
  const gaugeMax = Math.max(totalStart, totalEnd);
  const gaugeBase = gaugeMax > 0 ? Math.min(totalStart, totalEnd) / gaugeMax : 0;
  const grew = totalEnd >= totalStart;
  const cagr = compoundAnnualGrowth(totalStart, totalEnd, startYear, endYear);
  // The sentence already states the direction (გაიზარდა/შემცირდა), so the amount is unsigned.
  const deltaParts = formatAmountParts(Math.abs(totalEnd - totalStart), false, locale);
  const sideNoun = message(messages, scope === "revenue" ? "main.totalRevenue" : "main.totalExpenditure");
  const showSentence = totalStart > 0 && totalEnd > 0 && totalStart !== totalEnd;

  // Side KPIs, movers, and the period comparison all rank every top-level scope
  // row. The chart and chart-mode table remain scoped to the user's selection.
  const scopeRows = comparisonRows.filter((row) => row.level !== "major_program");
  // Growth KPIs skip residual buckets and rows that are zero in the end year (D11).
  const growthRows = scopeRows.filter((row) => isGrowthRankable(row.itemId, row.valuesByYear[endYear]));
  const biggestIncrease = rankPeriodDeltas(growthRows, startYear, endYear)[0] ?? null;
  const biggestParts = biggestIncrease ? formatAmountParts(biggestIncrease.delta, true, locale) : { num: MISSING, unit: "" };
  const slowest = growthRows.filter((row) => row.change !== null).sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0] ?? null;
  const largestShare = [...scopeRows].sort((a, b) => (b.valuesByYear[endYear] ?? 0) - (a.valuesByYear[endYear] ?? 0))[0] ?? null;

  const seriesValues = (source: ExplorerTableRow | null) =>
    source === null ? null : years.map((year) => source.valuesByYear[year] ?? null);

  const sideKpis = [
    {
      isDelta: true,
      label: message(messages, "main.biggestIncrease"),
      value: biggestParts.num,
      unit: biggestParts.unit,
      color: "var(--ink)",
      detail: biggestIncrease ? rowLabel(biggestIncrease.row) : MISSING,
      spark: biggestIncrease ? { values: seriesValues(biggestIncrease.row) ?? [], color: biggestIncrease.row.color } : null,
    },
    {
      isDelta: true,
      label: message(messages, "main.slowestGrowth"),
      value: slowest ? formatShare(slowest.change, true) : MISSING,
      unit: "",
      color: slowest && (slowest.change ?? 0) < 0 ? NEGATIVE : "var(--ink)",
      detail: slowest ? rowLabel(slowest) : MISSING,
      spark: slowest ? { values: seriesValues(slowest) ?? [], color: slowest.color } : null,
    },
    {
      isDelta: false,
      label: message(messages, "main.largestGdpShare"),
      value: largestShare ? formatShare(largestShare.shareByYear?.[endYear] ?? null) : MISSING,
      unit: "",
      color: "var(--ink)",
      detail: largestShare ? `${rowLabel(largestShare)}, ${endYear}` : MISSING,
      spark: largestShare ? { values: buildKpiShareSeries(largestShare, years), color: ACCENT } : null,
    },
  ].filter((kpi) => !singleYear || !kpi.isDelta);

  const maxAbsChange = Math.max(
    ...comparisonRows.filter((row) => row.level !== "major_program").map((row) => Math.abs(row.change ?? 0)),
    0.001,
  );
  const comparisonSorted = comparisonRows
    .filter((row) => row.level !== "major_program")
    .sort((a, b) => (b.valuesByYear[endYear] ?? 0) - (a.valuesByYear[endYear] ?? 0));

  const comparisonCell = (value: number | null | undefined) => (value === null || value === undefined ? MISSING : formatBn(value));

  return (
    <section data-testid="period-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
        <p className="text-[0.78125rem] text-[var(--muted)]">
          <Message messages={messages} id="main.selectedPeriod" values={{ years: <span className="font-[family-name:var(--font-numeric)]">{singleYear ? startYear : `${startYear}–${endYear}`}</span> }} />
        </p>
      </div>

      <div data-testid="period-kpi-cards" className={KPI_GRID_CLASS}>
        {singleYear ? (
          // No overline: it would title a block that has no value under it.
          <div className="min-w-0 @min-[1100px]:pr-11">
            <p data-testid="period-single-year-note" className="max-w-[420px] text-[0.8125rem] leading-relaxed text-[var(--muted)]">
              {message(messages, "main.noPeriod")}
            </p>
          </div>
        ) : (
        <HeroKpi
          label={message(messages, "main.periodChange")}
          value={formatShare(totalChange, true)}
          valueColor={totalChange !== null && totalChange < 0 ? NEGATIVE : "var(--ink)"}
        >
            <div className="flex h-[3px] bg-[var(--hairline-soft)]">
              <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${(gaugeBase * 100).toFixed(1)}%` }} />
              <div className="h-[3px] bg-[var(--accent)]" style={{ width: `${((1 - gaugeBase) * 100).toFixed(1)}%` }} />
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <p className="font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--muted)]">
                {startYear} · {formatAmount(totalStart, locale)}
              </p>
              <p className="font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--muted)]">
                {endYear} · {formatAmount(totalEnd, locale)}
              </p>
            </div>
            {showSentence ? (
              <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">
                <Message messages={messages} id={grew ? "main.periodIncrease" : "main.periodDecrease"} values={{
                  years: startYear + "–" + endYear, totalLabel: sideNoun,
                  amount: <span className="font-[family-name:var(--font-numeric)] text-xs">{withLari((deltaParts.num + " " + deltaParts.unit).trim())}</span>,
                }} />
                {cagr !== null ? <Message messages={messages} id={cagr >= 0 ? "main.annualGrowth" : "main.annualChange"} values={{ rate: <span className="font-[family-name:var(--font-numeric)] text-xs">{formatShare(cagr, true)}</span> }} /> : null}.
              </p>
            ) : null}
        </HeroKpi>
        )}
        <SideKpiList kpis={sideKpis} />
      </div>

      {singleYear ? null : (
      <div data-testid="period-movers" className="mt-9 grid gap-7 border-t border-[var(--hairline)] pt-6 @min-[1100px]:grid-cols-2 @min-[1100px]:gap-x-10">
        <div className="min-w-0">
          <h3 className="mb-3 text-[0.8125rem] font-semibold text-[var(--ink)]">{message(messages, "main.fastestGrowth")}</h3>
          <div className="flex flex-col">
            {topGrowth.map((row, index) => (
              <MoverRow key={row.itemId} rank={index + 1} label={rowLabel(row)} change={row.change} maxAbs={maxAbsChange} />
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 text-[0.8125rem] font-semibold text-[var(--ink)]">{message(messages, "main.slowestGrowth")}</h3>
          <div className="flex flex-col">
            {bottomGrowth.map((row, index) => (
              <MoverRow key={row.itemId} rank={index + 1} label={rowLabel(row)} change={row.change} maxAbs={maxAbsChange} />
            ))}
          </div>
        </div>
      </div>
      )}

      {singleYear ? null : (
        <PeriodComparisonTable
          heading={message(messages, "main.comparison")}
          caption={message(messages, "main.comparisonCaption", { scope: message(messages, SCOPE_LABEL[scope]), startYear, endYear })}
          firstColumnLabel={message(messages, FIRST_COL_LABEL[scope])}
          changeLabel={message(messages, "controls.change")}
          startYear={startYear}
          endYear={endYear}
          rows={[
            ...(totalRow ? [{ row: totalRow, label: rowLabel(totalRow), emphasis: true, color: "var(--ink)" }] : []),
            ...comparisonSorted.map((row) => ({ row, label: rowLabel(row), emphasis: false, color: row.color })),
          ].map(({ row, label, emphasis, color }) => {
            const startValue = row.valuesByYear[startYear] ?? null;
            const endValue = row.valuesByYear[endYear] ?? null;
            const delta = startValue === null || endValue === null ? null : endValue - startValue;
            return {
              key: row.itemId, label, title: rowLabel(row), color, emphasis,
              start: comparisonCell(startValue),
              change: delta === null ? MISSING : `${delta >= 0 ? "+" : "−"}${formatBn(Math.abs(delta))}`,
              changeColor: delta === null ? "var(--muted)" : delta >= 0 ? POSITIVE : NEGATIVE,
              end: comparisonCell(endValue),
            };
          })}
        />
      )}
    </section>
  );
}
