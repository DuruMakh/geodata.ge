import { housingFactKey, type ClientHousingFact } from "../data/housing/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildHousingModel, type HousingModel, type HousingSeriesModel, type HousingState, type HousingTopicId } from "./housing";
import { buildHousingAreaModel, housingAreaSlug, type HousingArea, type HousingAreaState } from "./housingAreas";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

type HousingWorkbookInput = {
  facts: readonly ClientHousingFact[]; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
} & ({ section: HousingTopicId; state: HousingState } | { area: HousingArea; state: HousingAreaState });

/**
 * A topic page's or an area page's selection as a workbook. Objects are exported as whole numbers, floor area in square
 * metres, prices in GEL per m² and the price index to one decimal; a year Geostat left blank is an empty cell, never zero.
 * The Sources sheet lists only the Geostat workbooks the exported values come from.
 */
export function buildHousingWorkbookExportModel(input: HousingWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `housing.${key}`);
  const model: HousingModel = "area" in input ? buildHousingAreaModel(input.area, input.facts, input.state) : buildHousingModel(input.section, input.facts, input.state);
  const stem = "area" in input ? `housing-${housingAreaSlug(input.area)}` : `housing-${input.section}`;
  const byCell = new Map(input.facts.map(f => [housingFactKey(f), f]));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId));
  const unitLabel = t({ count: "unitCount", area: "unitSquareMetres", index: "unitIndex", price: "unitGelPerSquareMetre" }[model.unit]);
  const numberFormat = model.unit === "index" ? "0.0" : "#,##0";
  const status = (id: string, year: number) => byCell.has(`${id}:${year}`) ? t("status.official") : workbookMessage(locale, "workbook.unavailable");
  // A Tbilisi district sits under both flats and houses with the same label, so its name carries the heading (the text before the heading's unit).
  const labelled = (series: HousingSeriesModel) => series.heading === "flats" || series.heading === "houses"
    ? `${labels[series.id]} — ${t(`heading.${series.heading}`).split(" · ")[0]}` : labels[series.id];
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
