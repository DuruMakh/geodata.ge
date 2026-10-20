import { transportFactKey, type ClientTransportFact } from "../data/transport/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildTransportModel, transportSeriesLabel, transportUnitLabel, type TransportModel, type TransportSeriesModel, type TransportState, type TransportTopicId } from "./transport";
import { buildTransportAreaModel, transportAreaSlug, type TransportArea, type TransportAreaState } from "./transportAreas";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

type TransportWorkbookInput = {
  facts: readonly ClientTransportFact[]; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
} & ({ section: TransportTopicId; state: TransportState } | { area: TransportArea; state: TransportAreaState });

/**
 * A topic page's or an area page's selection as a workbook, in Geostat's published units and precision (one decimal,
 * whole km per person); a year Geostat left blank is an empty cell, never zero. The Sources sheet lists only the
 * Geostat workbooks the exported values come from.
 */
export function buildTransportWorkbookExportModel(input: TransportWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `transport.${key}`);
  const model: TransportModel = "area" in input ? buildTransportAreaModel(input.area, input.facts, input.state) : buildTransportModel(input.section, input.facts, input.state);
  const stem = "area" in input ? `transport-${transportAreaSlug(input.area)}` : `transport-${input.section}`;
  const byCell = new Map(input.facts.map(f => [transportFactKey(f), f]));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId));
  const unitLabel = transportUnitLabel(model.unit, t);
  const numberFormat = model.unit === "pkmPerPerson" ? "#,##0" : "#,##0.0";
  const status = (id: string, year: number) => byCell.has(`${id}:${year}`) ? t("status.official") : workbookMessage(locale, "workbook.unavailable");
  // A fuel or age row has the same label under every vehicle type, so its name carries the heading (the text before the heading's unit).
  const labelled = (series: TransportSeriesModel) => transportSeriesLabel(series, labels, t);
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
