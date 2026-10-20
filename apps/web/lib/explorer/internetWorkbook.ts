import { internetFactKey, type ClientInternetFact } from "../data/internet/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildInternetModel, internetSeriesLabel, type InternetModel, type InternetSeriesModel, type InternetState, type InternetTopicId } from "./internet";
import { buildInternetAreaModel, internetAreaSlug, type InternetArea, type InternetAreaState } from "./internetAreas";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

type InternetWorkbookInput = {
  facts: readonly ClientInternetFact[]; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
} & ({ section: InternetTopicId; state: InternetState } | { area: InternetArea; state: InternetAreaState });

/**
 * A topic page's or an area page's selection as a workbook: shares to one decimal, as Geostat prints them; a year Geostat
 * did not publish is an empty cell, never zero. The Sources sheet lists only the Geostat tables the exported values come from.
 */
export function buildInternetWorkbookExportModel(input: InternetWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `internet.${key}`);
  const model: InternetModel = "area" in input ? buildInternetAreaModel(input.area, input.facts, input.state) : buildInternetModel(input.section, input.facts, input.state);
  const stem = "area" in input ? `internet-homes-${internetAreaSlug(input.area)}` : `internet-${input.section}`;
  const byCell = new Map(input.facts.map(f => [internetFactKey(f), f]));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId));
  const unitLabel = t("unitPercent"), numberFormat = "0.0";
  const status = (id: string, year: number) => byCell.has(`${id}:${year}`) ? t("status.survey_estimate") : workbookMessage(locale, "workbook.unavailable");
  // A group's name repeats under every heading, so it carries the heading's text before the "·".
  const labelled = (series: InternetSeriesModel) => internetSeriesLabel(series, labels, t);
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(`${stem}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, years: model.years, showChangeColumn: false, numberFormat,
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
