import type { ClientEnergyFoodFact } from "../data/energyFood/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildEnergyFoodModel, energyFoodDisplayLabels, energyFoodUnit, type EnergyFoodSectionId, type EnergyFoodState } from "./energyFood";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

/** The Data sheet's columns in order; the numeric format is keyed by the 1-based position of each `value` column. */
const ANALYSIS_COLUMNS = ["year", "series", "value", "status"] as const;

export function buildEnergyFoodWorkbookExportModel(input: { section: EnergyFoodSectionId; facts: readonly ClientEnergyFoodFact[]; state: EnergyFoodState; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string }, presentation: Presentation): WorkbookExportModel {
  const { section, facts, state } = input, { locale, messages } = presentation;
  const labels = energyFoodDisplayLabels(section, input.labels);
  const t = (key: string) => message(messages, `energyFood.${key}`);
  const model = buildEnergyFoodModel(section, facts, state);
  const byCell = new Map(facts.map(f => [`${f.indicatorId}:${f.year}`, f]));
  const neededYears = neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId);
  // A value without its source link would leave the workbook uncited.
  const known = new Set(input.sources.map(source => source.sourceId));
  for (const sourceId of neededYears.keys()) if (!known.has(sourceId)) throw new Error(`Missing public source for energy and food source ${sourceId}`);
  const originals = sourcesForNeededYears(input.sources, neededYears);
  const unit = energyFoodUnit(section);
  const numberFormat = unit === "percent" ? "0" : "#,##0.0";
  const status = (fact: ClientEnergyFoodFact | undefined) => fact ? t(`status.${fact.valueStatus}`) : workbookMessage(locale, "workbook.unavailable");
  const header: Record<typeof ANALYSIS_COLUMNS[number], string> = { year: workbookMessage(locale, "workbook.year"), series: t("series"), value: t(`unit.${unit}`), status: workbookMessage(locale, "workbook.status") };
  return {
    locale, filename: workbookFilename(`energy-food-${section}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title ?? t(`page.${section}.title`), subtitle: `${model.range.start}–${model.range.end} · ${t(`unit.${unit}`)}`,
      unitLabel: t(`unit.${unit}`), amountDecimals: model.decimals, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => ({ kind: series.reference ? "total" : "item", parentLabel: null, label: labels[series.id], change: null,
        valuesByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year]])),
        basisByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year] === null ? null : "published"])),
      })),
    },
    analysis: {
      headers: ANALYSIS_COLUMNS.map(column => header[column]),
      rows: model.years.flatMap(year => model.selected.map(series => {
        const fact = byCell.get(`${series.id}:${year}`);
        return [year, labels[series.id], series.valuesByYear[year], status(fact)];
      })),
      numericFormats: Object.fromEntries(ANALYSIS_COLUMNS.flatMap((column, index) => column === "value" ? [[index + 1, numberFormat]] : [])),
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
