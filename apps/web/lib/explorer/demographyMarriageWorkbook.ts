import { SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import { buildMarriageModel, marriageSourceId, type MarriagePlaceFacts, type MarriageSeriesId, type MarriageState } from "./demographyMarriage";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

/** The Data sheet's columns in order; the numeric format is keyed by the 1-based position of the `value` column. */
const ANALYSIS_COLUMNS = ["year", "series", "value", "unit", "status"] as const;
const VALUE_COLUMN = ANALYSIS_COLUMNS.indexOf("value") + 1;

export type MarriageWorkbookInput = {
  place: MarriagePlaceFacts; state: MarriageState;
  labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
  /** The place named in the file name, as the other Population workbooks name it (`batumi`, `region-adjara`, `georgia`). */
  scope: string;
};

/** The selection as the page shows it, following the Crime workbook: published counts and averages, or the rates fiscal.ge divides out. */
export function buildMarriageWorkbookExportModel(input: MarriageWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { place, state, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const model = buildMarriageModel(place, state);
  const rates = state.measure === "per1000";
  const isRate = (series: { group: string }) => rates && series.group === "count";
  const neededYears = neededSourceYears(model.selected, model.years, (series, year) => (series.valuesByYear[year] === null ? undefined : marriageSourceId(series.id as MarriageSeriesId)));
  // A rate also rests on the mid-year population it divides by, in each year it has a rate.
  const rateYears = model.years.filter((year) => model.selected.some((series) => isRate(series) && series.valuesByYear[year] !== null));
  if (rateYears.length) neededYears.set(SOURCE_ID.midYear, new Set(rateYears));
  // A value without its source link would leave the workbook uncited.
  const known = new Set(input.sources.map((source) => source.sourceId));
  for (const sourceId of neededYears.keys()) if (!known.has(sourceId)) throw new Error(`Missing public source for marriage source ${sourceId}`);
  const originals = sourcesForNeededYears(input.sources, neededYears);
  const unitLabel = message(messages, model.unitKey);
  const numberFormat = model.decimals ? "#,##0.0" : "#,##0";
  // A rate is written to the one decimal the page shows it with, so the cell holds the figure the reader sees.
  const valueOf = (value: number | null) => (value === null ? null : Number(value.toFixed(model.decimals)));
  const status = (series: { group: string }, value: number | null) =>
    value === null ? workbookMessage(locale, "workbook.unavailable") : isRate(series) ? t("marriageCalculated") : workbookMessage(locale, "workbook.published");
  const stem = `marriages-divorces-${input.scope}${rates ? "-per-1000" : ""}-${model.range.start}-${model.range.end}`;
  const header: Record<(typeof ANALYSIS_COLUMNS)[number], string> = {
    year: workbookMessage(locale, "workbook.year"), series: t("seriesHeader"), value: t("valueHeader"), unit: t("unitHeader"), status: workbookMessage(locale, "workbook.status"),
  };
  return {
    locale, filename: workbookFilename(stem, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: [`${model.range.start}–${model.range.end} · ${unitLabel}`, ...(rateYears.length ? [t("marriageRatesNote")] : [])].join(" · "),
      unitLabel, amountDecimals: model.decimals, years: model.years, showChangeColumn: false, numberFormat, ...(rateYears.length ? { fitSubtitle: true } : {}),
      rows: model.selected.map((series) => ({
        kind: "item", parentLabel: null, label: labels[series.id], change: null,
        valuesByYear: Object.fromEntries(model.years.map((year) => [year, valueOf(series.valuesByYear[year])])),
        basisByYear: Object.fromEntries(model.years.map((year) => [year, series.valuesByYear[year] === null ? null : "published"])),
      })),
    },
    analysis: {
      headers: ANALYSIS_COLUMNS.map((column) => header[column]),
      rows: model.years.flatMap((year) => model.selected.map((series) => [year, labels[series.id], valueOf(series.valuesByYear[year]), unitLabel, status(series, series.valuesByYear[year])])),
      numericFormats: { [VALUE_COLUMN]: numberFormat },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
