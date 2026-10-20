import { scienceCultureFactKey, type ClientScienceCultureFact } from "../data/scienceCulture/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import {
  buildScienceCultureSeriesModel, scienceCultureSeriesLabel, scienceCultureTopicSeries, type ScienceCultureListModel, type ScienceCultureSeriesDefinition, type ScienceCultureState, type ScienceCultureTopicId,
} from "./scienceCulture";
import { buildMuseumAreaModel, museumAreaSlug, type MuseumArea } from "./scienceCultureMuseums";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

type ScienceCultureWorkbookInput = {
  facts: readonly ClientScienceCultureFact[]; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
  state: ScienceCultureState;
} & ({ section: ScienceCultureTopicId } | { area: MuseumArea });

/**
 * A topic page's or a museum area page's selection as a workbook. Values are exported as stored: persons and counts as whole
 * numbers, thousands and million GEL to one decimal by number format only (the cell keeps the exact figure). A year Geostat
 * left blank, and the theatre events before 2021, are empty cells, never zero. The Sources sheet lists only the Geostat
 * workbooks the exported values come from.
 */
export function buildScienceCultureWorkbookExportModel(input: ScienceCultureWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `scienceCulture.${key}`);
  const model: ScienceCultureListModel = "area" in input ? buildMuseumAreaModel(input.area, input.facts, input.state) : buildScienceCultureSeriesModel(scienceCultureTopicSeries(input.section), input.facts, input.state);
  const stem = "area" in input ? `science-culture-museums-${museumAreaSlug(input.area)}` : `science-culture-${input.section}`;
  const byCell = new Map(input.facts.map(f => [scienceCultureFactKey(f), f]));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId));
  const unitLabel = t(`unit.${model.unit}`);
  const tenths = model.unit === "thousand" || model.unit === "gel";
  const numberFormat = tenths ? "#,##0.0" : "#,##0";
  const status = (id: string, year: number) => byCell.has(`${id}:${year}`) ? t("status.official") : workbookMessage(locale, "workbook.unavailable");
  const labelled = (series: Pick<ScienceCultureSeriesDefinition, "id" | "heading">) => scienceCultureSeriesLabel(series, labels, t);
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(`${stem}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, amountDecimals: tenths ? 1 : 0, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => ({
        kind: series.reference ? "total" : "item", parentLabel: null, label: labelled(series), change: null, valuesByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year]])),
        basisByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year] === null ? null : "actual"])),
      })),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), workbookMessage(locale, "workbook.category"), unitLabel, workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [year, labelled(series), series.valuesByYear[year], status(series.id, year)]),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
