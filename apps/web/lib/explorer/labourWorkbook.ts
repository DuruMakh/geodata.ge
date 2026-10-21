import { labourFactKey, type ClientLabourFact } from "../data/labour/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildLabourModel, labourFullLabel, type LabourSectionId, type LabourSeriesModel, type LabourState } from "./labour";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

/** The Data sheet's columns in order; the numeric format is keyed by the 1-based position of the `value` column. */
const ANALYSIS_COLUMNS = ["year", "series", "value", "unit", "status"] as const;
const VALUE_COLUMN = ANALYSIS_COLUMNS.indexOf("value") + 1;
/** Thousands of people, hours and percentages all carry Geostat's one decimal. */
const NUMBER_FORMAT = "#,##0.0";

export type LabourWorkbookInput = {
  section: LabourSectionId; facts: readonly ClientLabourFact[]; state: LabourState;
  /** A label for every row the page lists, keyed by series id. */
  labels: Readonly<Record<string, string>>;
  /** A label for each heading the page lists; outside the list a row is named with it ("Women — Construction"). */
  headingLabels: Readonly<Record<string, string>>;
  sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
};

/**
 * A page's selection as a workbook: Geostat's published one-decimal figures, a year without a value as an empty cell
 * (never zero; a published zero stays zero), and only the Geostat workbooks the exported values come from.
 */
export function buildLabourWorkbookExportModel(input: LabourWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { section, facts, state, labels, headingLabels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `labour.${key}`);
  const model = buildLabourModel(section, facts, state);
  const byCell = new Map(facts.map(f => [labourFactKey(f), f]));
  const cell = (series: LabourSeriesModel, year: number) => byCell.get(labourFactKey({ indicatorId: series.id, year }));
  const neededYears = neededSourceYears(model.selected, model.years, (series, year) => cell(series, year)?.sourceId);
  // A value without its source link would leave the workbook uncited.
  const known = new Set(input.sources.map(source => source.sourceId));
  for (const sourceId of neededYears.keys()) if (!known.has(sourceId)) throw new Error(`Missing public source for labour source ${sourceId}`);
  const unitLabel = t(`unit.${model.unit}`);
  const parentOf = (series: LabourSeriesModel) => series.heading === "all" ? null : headingLabels[series.heading];
  const fullLabel = (series: LabourSeriesModel) => labourFullLabel(series.heading, headingLabels[series.heading], labels[series.id]);
  const status = (series: LabourSeriesModel, year: number) => cell(series, year) ? t("status.published") : workbookMessage(locale, "workbook.unavailable");
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  const header: Record<typeof ANALYSIS_COLUMNS[number], string> = {
    year: workbookMessage(locale, "workbook.year"), series: t("series"), value: t("value"), unit: t("unitColumn"), status: workbookMessage(locale, "workbook.status"),
  };
  return {
    locale, filename: workbookFilename(`labour-${section}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, amountDecimals: 1, years: model.years, showChangeColumn: false, numberFormat: NUMBER_FORMAT,
      rows: model.selected.map(series => ({
        // The Summary sheet prefixes only an item with its heading, so the page total carries its full name ("Ages 15–24 — Total").
        ...(series.reference ? { kind: "total" as const, parentLabel: null, label: fullLabel(series) } : { kind: "item" as const, parentLabel: parentOf(series), label: labels[series.id] }),
        change: null, valuesByYear: series.valuesByYear,
        basisByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year] === null ? null : "published"])),
      })),
    },
    analysis: {
      headers: ANALYSIS_COLUMNS.map(column => header[column]),
      rows: cells.map(({ year, series }) => [year, fullLabel(series), series.valuesByYear[year], unitLabel, status(series, year)]),
      numericFormats: { [VALUE_COLUMN]: NUMBER_FORMAT },
    },
    sources: withAbsoluteUrls(sourcesForNeededYears(input.sources, neededYears), input.siteOrigin),
  };
}
