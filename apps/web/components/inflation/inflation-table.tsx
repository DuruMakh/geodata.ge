"use client";

import { formatInflationValue, MONTH_NUMBERS, periodLabel, seriesLabel } from "../../lib/explorer/inflationLabels";
import { MOM_BINS, YOY_BINS, buildMonthGrid, decemberAverages, legendLabels } from "../../lib/explorer/inflationGrid";
import { effectiveTableSeries, seriesValues, tableSeriesOptions, type InflationIndex, type InflationSeriesKey, type InflationState, type ResolvedPeriodRange } from "../../lib/explorer/inflationOverview";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { MonthGridTable } from "../main-explorer/month-grid-table";
import { TextTab } from "../ui/editorial";

// ცხრილი: one series at a time (spec §7.1); several selected series get a picker.
export function InflationTable({ index, state, range, onTableSeriesChange }: {
  index: InflationIndex;
  state: InflationState;
  range: ResolvedPeriodRange;
  onTableSeriesChange: (key: InflationSeriesKey) => void;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const active = effectiveTableSeries(index, state);
  if (active === null) return null;
  const options = tableSeriesOptions(index, state);
  const edges = state.tab === "yoy" ? YOY_BINS : state.tab === "mom" ? MOM_BINS : null;
  const summaryByYear = state.tab === "yoy" && active === "cpi" ? decemberAverages(index.values.get("cpi.headline:avg12_pct")) : undefined;
  const rows = buildMonthGrid({ values: seriesValues(index, active, state.tab)!, range, edges, summaryByYear });

  return (
    <MonthGridTable
      caption={t("tableCaption", {
        series: seriesLabel(messages, active, state.tab),
        tab: t(`tab.${state.tab}`),
        unit: t(`unit.${state.tab}`),
        start: periodLabel(messages, range.start, "short"),
        end: periodLabel(messages, range.end, "short"),
      })}
      yearLabel={t("year")}
      monthLabels={MONTH_NUMBERS.map((month) => message(messages, `inflation.monthShort.${month}`))}
      monthNames={MONTH_NUMBERS.map((month) => message(messages, `inflation.month.${month}`))}
      summaryLabel={summaryByYear ? t("annualAverage") : undefined}
      rows={rows}
      formatValue={(value) => formatInflationValue(value, state.tab)}
      legend={edges ? legendLabels(edges).map((label, tint) => ({ label, tint })) : null}
      legendLabel={t("legend")}
      picker={options.length > 1 ? (
        <div role="group" aria-label={t("tableSeries")} data-testid="inflation-table-series" className="flex flex-wrap gap-5">
          {options.map((key) => (
            <TextTab key={key} testId={`inflation-table-series-${key}`} label={seriesLabel(messages, key, state.tab)} active={key === active} onClick={() => onTableSeriesChange(key)} />
          ))}
        </div>
      ) : null}
    />
  );
}
