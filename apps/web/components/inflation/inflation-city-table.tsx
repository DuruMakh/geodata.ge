"use client";

import { MOM_BINS, YOY_BINS, buildMonthGrid, legendLabels } from "../../lib/explorer/inflationGrid";
import {
  cityAnnualAverages,
  cityTableOptions,
  cityValues,
  effectiveCityTableSeries,
  type CityIndex,
  type CityLineId,
  type CityState,
  type ResolvedPeriodRange,
} from "../../lib/explorer/inflationCities";
import { cityCategoryLabel, cityLineLabel, formatCityValue } from "../../lib/explorer/inflationCityLabels";
import { MONTH_NUMBERS, periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { MonthGridTable } from "../main-explorer/month-grid-table";
import { TextTab } from "../ui/editorial";

// ცხრილი: one line at a time, like the overview. წლის საშუალო appears for the
// total on the annual tab only — Geostat publishes no category average (spec §6).
export function InflationCityTable({
  index,
  state,
  range,
  onTableSeriesChange,
}: {
  index: CityIndex;
  state: CityState;
  range: ResolvedPeriodRange;
  onTableSeriesChange: (lineId: CityLineId) => void;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const active = effectiveCityTableSeries(index, state);
  if (active === null) return null;
  const options = cityTableOptions(index, state);
  const edges = state.tab === "yoy" ? YOY_BINS : MOM_BINS;
  const measure = state.tab === "yoy" ? "yoy_pct" : "mom_pct";
  const summaryByYear = cityAnnualAverages(index, state, active);
  const rows = buildMonthGrid({ values: cityValues(index, active, state.category, measure)!, range, edges, summaryByYear });

  return (
    <MonthGridTable
      caption={t("tableCaption", {
        series: `${cityLineLabel(messages, active)} · ${cityCategoryLabel(messages, state.category)}`,
        tab: t(`categoryTab.${state.tab}`),
        unit: t(`categoryWorkbookUnit.${state.tab}`),
        start: periodLabel(messages, range.start, "short"),
        end: periodLabel(messages, range.end, "short"),
      })}
      yearLabel={t("year")}
      monthLabels={MONTH_NUMBERS.map((month) => message(messages, `inflation.monthShort.${month}`))}
      monthNames={MONTH_NUMBERS.map((month) => message(messages, `inflation.month.${month}`))}
      summaryLabel={summaryByYear ? t("annualAverage") : undefined}
      rows={rows}
      formatValue={(value) => formatCityValue(value, state.tab)}
      legend={legendLabels(edges).map((label, tint) => ({ label, tint }))}
      legendLabel={t("legend")}
      picker={
        options.length > 1 ? (
          <div role="group" aria-label={t("tableSeries")} data-testid="inflation-city-table-series" className="flex flex-wrap gap-5">
            {options.map((lineId) => (
              <TextTab
                key={lineId}
                testId={`inflation-city-table-series-${lineId}`}
                label={cityLineLabel(messages, lineId)}
                active={lineId === active}
                onClick={() => onTableSeriesChange(lineId)}
              />
            ))}
          </div>
        ) : null
      }
    />
  );
}
