import { periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { HEADLINE_ID, buildCityLines, cityAnnualAverages, type CityIndex, type CityState, type ResolvedPeriodRange } from "./inflationCities";
import { cityCategoryLabel, cityLineLabel } from "./inflationCityLabels";
import { MONTH_NUMBERS, periodLabel } from "./inflationLabels";
import {
  SUMMARY_COLUMN,
  calendarYearsOf,
  monthlyReadableRows,
  monthlyWorkbookSources,
  pickLocaleEditions,
  type InflationWorkbookSource,
} from "./inflationWorkbook";
import { SHEET_NAMES, type WorkbookExportModel, type WorkbookReadableRow, workbookFilename } from "./workbookModel";

// Spec §9: the readable sheet mirrors ცხრილი — one row per selected line and year,
// months across, plus წლის საშუალო for the total on the annual tab. Rates leave as
// fractions under Excel's % format. The same-price-everywhere note travels on the
// sheet. Implied city weights never appear here.
export function buildInflationCityWorkbookExportModel(input: {
  index: CityIndex;
  state: CityState;
  range: ResolvedPeriodRange;
  presentation: Presentation;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const { index, state, range, presentation, sources, siteOrigin } = input;
  const { messages, locale } = presentation;
  const t = (key: string) => message(messages, `inflation.${key}`);
  const scale = (value: number) => value / 100;
  const { periods, lines } = buildCityLines(index, state, range);
  const withSummary = state.tab === "yoy" && state.category === HEADLINE_ID;
  const columns: number[] = [...MONTH_NUMBERS, ...(withSummary ? [SUMMARY_COLUMN] : [])];
  const calendarYears = calendarYearsOf(range);
  const category = cityCategoryLabel(messages, state.category);

  const rows: WorkbookReadableRow[] = lines.flatMap((line) => {
    const byPeriod = new Map(periods.map((period, position) => [period, line.values[position] ?? null]));
    const averages = cityAnnualAverages(index, state, line.key);
    return monthlyReadableRows(cityLineLabel(messages, line.key), byPeriod, calendarYears, scale, withSummary ? (year) => averages?.get(year) ?? null : undefined);
  });

  const coicop = state.category === HEADLINE_ID ? "" : state.category.replace("cpi.cat.", "");
  const analysisRows = periods.flatMap((period, position) =>
    lines.flatMap((line) => {
      const value = line.values[position];
      return value === null || value === undefined
        ? []
        : [[periodYear(period), periodMonth(period), cityLineLabel(messages, line.key), category, coicop, scale(value), "%", t("published")]];
    }),
  );

  const usedSourceIds = new Set<string>([state.tab === "yoy" ? "source.geostat_cpi_yoy" : "source.geostat_cpi_mom"]);
  if (withSummary) usedSourceIds.add("source.geostat_cpi_avg12");
  const chosen = pickLocaleEditions(sources, usedSourceIds, locale);
  const subtitle = `${periodLabel(messages, range.start, "long")} – ${periodLabel(messages, range.end, "long")} · ${t(`categoryUnit.${state.tab}`)}`;

  return {
    locale,
    filename: workbookFilename(`inflation-cities-${state.tab}-${coicop || "total"}-${periodKey(range.start)}-${periodKey(range.end)}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${t("citiesHeading")} · ${category}`,
      subtitle: `${subtitle} · ${t("cityCentralPricesNote")}`,
      unitLabel: t(`categoryWorkbookUnit.${state.tab}`),
      numberFormat: "0.0%",
      showChangeColumn: false,
      years: columns,
      headerLabels: {
        category: t("seriesYear"),
        columns: columns.map((column) => (column === SUMMARY_COLUMN ? t("annualAverage") : message(messages, `inflation.month.${column}`))),
      },
      rows,
    },
    analysis: {
      headers: [t("year"), t("month"), t("cityColumn"), t("categoryColumn"), t("coicopColumn"), t("value"), t("unitColumn"), t("status")],
      rows: analysisRows,
      numericFormats: { 6: "0.00%" },
    },
    sources: monthlyWorkbookSources(chosen, calendarYears, siteOrigin),
    sourceYears: calendarYears,
  };
}
