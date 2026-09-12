"use client";

import {
  CONTRIBUTION_BINS,
  MOM_BINS,
  YOY_BINS,
  buildMonthGrid,
  legendLabels,
  legendLabelsPp,
} from "../../lib/explorer/inflationGrid";
import {
  categoryValues,
  effectiveTableSeries,
  tableSeriesOptions,
  type CategoryIndex,
  type CategoryState,
  type ResolvedPeriodRange,
} from "../../lib/explorer/inflationCategories";
import { categoryLabel, formatCategoryValue } from "../../lib/explorer/inflationCategoryLabels";
import { MONTH_NUMBERS, periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { MonthGridTable } from "../main-explorer/month-grid-table";
import { TextTab } from "../ui/editorial";

// ცხრილი: one category at a time, like the overview table. There is no summary
// column — Geostat publishes no annual average per category, and computing one
// here would invent a figure.
export function InflationCategoryTable({
  index,
  state,
  range,
  onTableSeriesChange,
}: {
  index: CategoryIndex;
  state: CategoryState;
  range: ResolvedPeriodRange;
  onTableSeriesChange: (categoryId: string) => void;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const active = effectiveTableSeries(index, state);
  if (active === null) return null;
  const options = tableSeriesOptions(index, state);
  const edges = state.tab === "yoy" ? YOY_BINS : state.tab === "mom" ? MOM_BINS : CONTRIBUTION_BINS;
  const rows = buildMonthGrid({ values: categoryValues(index, active, state.tab)!, range, edges });
  const legend = state.tab === "contrib" ? legendLabelsPp(edges) : legendLabels(edges);

  return (
    <MonthGridTable
      caption={t("tableCaption", {
        series: categoryLabel(messages, active),
        tab: t(`categoryTab.${state.tab}`),
        unit: t(`categoryWorkbookUnit.${state.tab}`),
        start: periodLabel(messages, range.start, "short"),
        end: periodLabel(messages, range.end, "short"),
      })}
      yearLabel={t("year")}
      monthLabels={MONTH_NUMBERS.map((month) => message(messages, `inflation.monthShort.${month}`))}
      monthNames={MONTH_NUMBERS.map((month) => message(messages, `inflation.month.${month}`))}
      rows={rows}
      formatValue={(value) => formatCategoryValue(value, state.tab)}
      legend={legend.map((label, tint) => ({ label, tint }))}
      legendLabel={t("legend")}
      picker={
        options.length > 1 ? (
          <div
            role="group"
            aria-label={t("tableSeries")}
            data-testid="inflation-category-table-series"
            className="flex flex-wrap gap-5"
          >
            {options.map((categoryId) => (
              <TextTab
                key={categoryId}
                testId={`inflation-category-table-series-${categoryId}`}
                label={categoryLabel(messages, categoryId)}
                active={categoryId === active}
                onClick={() => onTableSeriesChange(categoryId)}
              />
            ))}
          </div>
        ) : null
      }
    />
  );
}
