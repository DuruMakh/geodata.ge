"use client";

import { YOY_BINS, buildMonthGrid, legendLabels } from "../../lib/explorer/inflationGrid";
import {
  cityAnnualAverages,
  cityLineSource,
  cityTableOptions,
  cityValues,
  effectiveCityTableSeries,
  type CityIndex,
  type CityState,
  type CityView,
  type ResolvedPeriodRange,
} from "../../lib/explorer/inflationCities";
import { cityCategoryLabel, cityLineLabel, cityViewLineLabel, formatCityValue } from "../../lib/explorer/inflationCityLabels";
import { MONTH_NUMBERS, periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { MonthGridTable } from "../main-explorer/month-grid-table";
import { TextTab } from "../ui/editorial";

// ცხრილი: one line at a time. წლის საშუალო appears for a total line only —
// Geostat publishes no division average (spec 2026-09-30 §4–§5).
export function InflationCityTable({
  index,
  view,
  state,
  range,
  onTableSeriesChange,
}: {
  index: CityIndex;
  view: CityView;
  state: CityState;
  range: ResolvedPeriodRange;
  onTableSeriesChange: (lineId: string) => void;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const active = effectiveCityTableSeries(index, view, state);
  if (active === null) return null;
  const options = cityTableOptions(index, view, state);
  const { entityId, seriesId } = cityLineSource(view, active);
  const summaryByYear = cityAnnualAverages(index, view, active);
  const rows = buildMonthGrid({ values: cityValues(index, entityId, seriesId, "yoy_pct")!, range, edges: YOY_BINS, summaryByYear });

  return (
    <MonthGridTable
      caption={t("tableCaption", {
        series: `${cityLineLabel(messages, entityId)} · ${cityCategoryLabel(messages, seriesId)}`,
        tab: t("categoryTab.yoy"),
        unit: t("categoryWorkbookUnit.yoy"),
        start: periodLabel(messages, range.start, "short"),
        end: periodLabel(messages, range.end, "short"),
      })}
      yearLabel={t("year")}
      monthLabels={MONTH_NUMBERS.map((month) => message(messages, `inflation.monthShort.${month}`))}
      monthNames={MONTH_NUMBERS.map((month) => message(messages, `inflation.month.${month}`))}
      summaryLabel={summaryByYear ? t("annualAverage") : undefined}
      rows={rows}
      formatValue={(value) => formatCityValue(value)}
      legend={legendLabels(YOY_BINS).map((label, tint) => ({ label, tint }))}
      legendLabel={t("legend")}
      picker={
        options.length > 1 ? (
          <div role="group" aria-label={t("tableSeries")} data-testid="inflation-city-table-series" className="flex flex-wrap gap-5">
            {options.map((lineId) => (
              <TextTab
                key={lineId}
                testId={`inflation-city-table-series-${lineId}`}
                label={cityViewLineLabel(messages, view, lineId)}
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
