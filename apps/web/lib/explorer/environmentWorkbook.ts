import { environmentFactKey, type ClientEnvironmentFact, type EnvironmentCity } from "../data/environment/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildEnvironmentModel, environmentSeriesLabel, environmentUnitLabelKey, type EnvironmentModel, type EnvironmentState, type EnvironmentTopicId } from "./environment";
import { buildEnvironmentAreaModel, environmentAreaRoutes, type EnvironmentArea, type EnvironmentAreaTopic } from "./environmentAreas";
import { buildEnvironmentCityModel } from "./environmentCities";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

/** The page a workbook is downloaded from: a topic page, a city page or a waste or forests area page. */
export type EnvironmentWorkbookPage = { section: EnvironmentTopicId } | { city: EnvironmentCity } | { topic: EnvironmentAreaTopic; area: EnvironmentArea };
export type EnvironmentWorkbookInput = {
  facts: readonly ClientEnvironmentFact[]; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string; title: string; state: EnvironmentState;
} & EnvironmentWorkbookPage;

/** The model and filename stem of the page the workbook is downloaded from. */
function pageModel(input: EnvironmentWorkbookInput): { model: EnvironmentModel; stem: string } {
  if ("section" in input) return { model: buildEnvironmentModel(input.section, input.facts, input.state), stem: `environment-${input.section}` };
  if ("city" in input) return { model: buildEnvironmentCityModel(input.city, input.facts, input.state), stem: `environment-air-quality-${input.city}` };
  return { model: buildEnvironmentAreaModel(input.topic, input.area, input.facts, input.state), stem: `environment-${input.topic}-${environmentAreaRoutes(input.topic).areaSlug(input.area)}` };
}

/**
 * A page's selection as a workbook: the published values in the selection's unit, to the most decimals any of them was
 * published with (a negative stays negative); a year Geostat left blank is an empty cell, never zero. The Sources sheet
 * lists only the archived Geostat workbooks the exported values come from.
 */
export function buildEnvironmentWorkbookExportModel(input: EnvironmentWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `environment.${key}`);
  const { model, stem } = pageModel(input);
  const byCell = new Map(input.facts.map(f => [environmentFactKey(f), f]));
  const neededYears = neededSourceYears(model.selected, model.years, (series, year) => byCell.get(environmentFactKey({ indicatorId: series.id, year }))?.sourceId);
  // A value without its source link would leave the workbook uncited.
  const known = new Set(input.sources.map(source => source.sourceId));
  for (const sourceId of neededYears.keys()) if (!known.has(sourceId)) throw new Error(`Missing public source for environment source ${sourceId}`);
  const unitLabel = t(environmentUnitLabelKey(model.unit));
  const numberFormat = model.decimals ? `#,##0.${"0".repeat(model.decimals)}` : "#,##0";
  const status = (id: string, year: number) => byCell.has(environmentFactKey({ indicatorId: id, year })) ? t("status.official") : workbookMessage(locale, "workbook.unavailable");
  // A station, a place or a measure repeated under several headings carries its heading's name, as in the chart.
  const labelled = (series: EnvironmentModel["selected"][number]) => environmentSeriesLabel(series, labels, key => message(messages, `environment.${key}`));
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(`${stem}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, amountDecimals: model.decimals, years: model.years, showChangeColumn: false, numberFormat,
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
    sources: withAbsoluteUrls(sourcesForNeededYears(input.sources, neededYears), input.siteOrigin),
  };
}
