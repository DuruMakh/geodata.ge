import { crimeFactKey, type ClientCrimeFact } from "../data/crime/types";
import { SOURCE_ID } from "../data/demography/series";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildCrimeModel, crimeMeasureFacts, crimeUnitKey, type CrimePopulation, type CrimeSectionId, type CrimeState } from "./crime";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";
import { roundShown } from "./format";

/** The Data sheet's columns in order; the numeric format is keyed by the 1-based position of the `value` column. */
const ANALYSIS_COLUMNS = ["year", "series", "value", "unit", "status"] as const;
const VALUE_COLUMN = ANALYSIS_COLUMNS.indexOf("value") + 1;

export type CrimeWorkbookInput = {
  section: CrimeSectionId; facts: readonly ClientCrimeFact[]; population: CrimePopulation; state: CrimeState;
  labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
};

export function buildCrimeWorkbookExportModel(input: CrimeWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { section, facts, population, state, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `crime.${key}`);
  const rates = state.measure === "per100k";
  // The values are the page's: the published counts, or the rates fiscal.ge calculates from them.
  const model = buildCrimeModel(section, facts, population, state, []);
  const byCell = new Map(crimeMeasureFacts(state.measure, facts, population).map(f => [crimeFactKey(f), f]));
  const cell = (id: string, year: number) => byCell.get(crimeFactKey({ indicatorId: id as ClientCrimeFact["indicatorId"], year }));
  const neededYears = neededSourceYears(model.selected, model.years, (series, year) => cell(series.id, year)?.sourceId);
  // A rate also rests on the population it divides by, in each year it has a rate.
  if (rates) {
    const rateYears = model.years.filter(year => model.selected.some(series => cell(series.id, year)));
    if (rateYears.length) neededYears.set(SOURCE_ID.populationUnits, new Set(rateYears));
  }
  // A value without its source link would leave the workbook uncited.
  const known = new Set(input.sources.map(source => source.sourceId));
  for (const sourceId of neededYears.keys()) if (!known.has(sourceId)) throw new Error(`Missing public source for crime source ${sourceId}`);
  const originals = sourcesForNeededYears(input.sources, neededYears);
  const unitLabel = (id: string) => message(messages, crimeUnitKey(state.measure, id));
  const unitLabels = [...new Set(model.selected.map(series => unitLabel(series.id)))].join(" · ");
  const numberFormat = rates ? "#,##0.0" : "#,##0";
  // A rate is written to the one decimal the page shows it with, so the cell holds the figure the reader sees.
  const valueOf = (value: number | null) => roundShown(value, model.decimals);
  // As on Money and banks, a rate fiscal.ge divides out is marked calculated; a count is Geostat's published figure.
  const status = (fact: ReturnType<typeof cell>) => !fact ? workbookMessage(locale, "workbook.unavailable") : fact.calculated ? t("status.calculated") : t("status.published");
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series, fact: cell(series.id, year) })));
  const stem = `crime-${section}${rates ? "-per-100k" : ""}-${model.range.start}-${model.range.end}`;
  const header: Record<typeof ANALYSIS_COLUMNS[number], string> = {
    year: workbookMessage(locale, "workbook.year"), series: t("series"), value: t("value"), unit: t("unit"), status: workbookMessage(locale, "workbook.status"),
  };
  return {
    locale, filename: workbookFilename(stem, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: [`${model.range.start}–${model.range.end} · ${unitLabels}`, ...(rates ? [t("workbook.ratesNote")] : [])].join(" · "),
      unitLabel: unitLabels, amountDecimals: model.decimals, years: model.years, showChangeColumn: false, numberFormat, ...(rates ? { fitSubtitle: true } : {}),
      rows: model.selected.map(series => ({
        kind: series.reference ? "total" : "item", parentLabel: null, label: labels[series.id], change: null,
        valuesByYear: Object.fromEntries(model.years.map(year => [year, valueOf(series.valuesByYear[year])])),
        basisByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year] === null ? null : "published"])),
      })),
    },
    analysis: {
      headers: ANALYSIS_COLUMNS.map(column => header[column]),
      rows: cells.map(({ year, series, fact }) => [year, labels[series.id], valueOf(series.valuesByYear[year]), unitLabel(series.id), status(fact)]),
      numericFormats: { [VALUE_COLUMN]: numberFormat },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
