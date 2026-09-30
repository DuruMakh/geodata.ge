import { periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { HEADLINE_ID, buildCityLines, cityAnnualAverages, cityLineSource, type CityIndex, type CityState, type CityView, type ResolvedPeriodRange } from "./inflationCities";
import { cityCategoryLabel, cityLineLabel, cityPlaceLabel } from "./inflationCityLabels";
import { citySlug } from "./inflationCityRoutes";
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

// Spec 2026-09-30 §5: the readable sheet mirrors ცხრილი — one row per selected line
// and year, months across, plus წლის საშუალო when a total line is selected (blank
// for divisions). Annual rates only, as fractions under Excel's % format. The
// same-price-everywhere note travels on the sheet. Implied city weights never appear.
export function buildInflationCityWorkbookExportModel(input: {
  index: CityIndex;
  view: CityView;
  state: CityState;
  range: ResolvedPeriodRange;
  presentation: Presentation;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const { index, view, state, range, presentation, sources, siteOrigin } = input;
  const { messages, locale } = presentation;
  const t = (key: string) => message(messages, `inflation.${key}`);
  const scale = (value: number) => value / 100;
  const { periods, lines } = buildCityLines(index, view, state, range);
  const withSummary = lines.some((line) => cityLineSource(view, line.key).seriesId === HEADLINE_ID);
  const columns: number[] = [...MONTH_NUMBERS, ...(withSummary ? [SUMMARY_COLUMN] : [])];
  const calendarYears = calendarYearsOf(range);
  const rowLabel = (lineId: string) => (view.kind === "georgia" ? cityLineLabel(messages, lineId) : cityCategoryLabel(messages, lineId));

  const rows: WorkbookReadableRow[] = lines.flatMap((line) => {
    const byPeriod = new Map(periods.map((period, position) => [period, line.values[position] ?? null]));
    const averages = cityAnnualAverages(index, view, line.key);
    return monthlyReadableRows(rowLabel(line.key), byPeriod, calendarYears, scale, withSummary ? (year) => averages?.get(year) ?? null : undefined);
  });

  const analysisRows = periods.flatMap((period, position) =>
    lines.flatMap((line) => {
      const value = line.values[position];
      if (value === null || value === undefined) return [];
      const { entityId, seriesId } = cityLineSource(view, line.key);
      const coicop = seriesId === HEADLINE_ID ? "" : seriesId.replace("cpi.cat.", "");
      return [[periodYear(period), periodMonth(period), cityLineLabel(messages, entityId), cityCategoryLabel(messages, seriesId), coicop, scale(value), "%", t("published")]];
    }),
  );

  const usedSourceIds = new Set<string>(["source.geostat_cpi_yoy"]);
  if (withSummary) usedSourceIds.add("source.geostat_cpi_avg12");
  const chosen = pickLocaleEditions(sources, usedSourceIds, locale);
  const subtitle = `${periodLabel(messages, range.start, "long")} – ${periodLabel(messages, range.end, "long")} · ${t("categoryUnit.yoy")}`;
  const stem = view.kind === "georgia" ? "inflation-cities" : `inflation-${citySlug(view.cityId)}`;

  return {
    locale,
    filename: workbookFilename(`${stem}-${periodKey(range.start)}-${periodKey(range.end)}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${t("citiesHeading")} · ${cityPlaceLabel(messages, view)}`,
      subtitle: `${subtitle} · ${t("cityCentralPricesNote")}`,
      unitLabel: t("categoryWorkbookUnit.yoy"),
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
