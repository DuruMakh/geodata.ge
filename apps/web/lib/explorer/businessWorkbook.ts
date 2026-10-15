import { businessFactKey, type ClientBusinessFact } from "../data/business/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildBusinessModel, type BusinessModel, type BusinessState, type BusinessTopicId } from "./business";
import { buildBusinessAreaModel, type BusinessArea, type BusinessAreaState } from "./businessAreas";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

const MILLION = 1_000_000;

type BusinessWorkbookInput = {
  facts: readonly ClientBusinessFact[]; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
} & ({ section: BusinessTopicId; state: BusinessState } | { area: BusinessArea; state: BusinessAreaState });

/**
 * A topic page's or an area page's selection as a workbook. Amounts are exported in million GEL, persons and firms as
 * whole numbers and rates to one decimal; a year Geostat left blank is an empty cell, never zero. The Sources sheet
 * lists only the Geostat workbooks the exported values come from.
 */
export function buildBusinessWorkbookExportModel(input: BusinessWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `business.${key}`);
  const model: BusinessModel = "area" in input ? buildBusinessAreaModel(input.area, input.facts, input.state) : buildBusinessModel(input.section, input.facts, input.state);
  const stem = "area" in input
    ? `business-${input.area}-${input.state.measure}`
    : `business-${input.section}${input.state.view === "rate" ? "-rate" : ""}`;
  const byCell = new Map(input.facts.map(f => [businessFactKey(f), f]));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId));
  const isAmount = model.unit === "gel";
  const unitLabel = t({ gel: "unitMlnGel", persons: "unitPersons", enterprises: "unitFirms", percent: "unitPercent" }[model.unit]);
  const numberFormat = isAmount ? "#,##0.0" : model.unit === "percent" ? "0.0" : "#,##0";
  const toExport = (value: number | null) => value === null ? null : isAmount ? value / MILLION : value;
  const status = (id: string, year: number) => byCell.has(`${id}:${year}`) ? t("status.official") : workbookMessage(locale, "workbook.unavailable");
  // A nested series (a sector under profit, say) carries its parent's name, so the same sector under another measure stays apart.
  const parentLabel = (parentId: string | undefined) => parentId === undefined ? null : labels[parentId] ?? null;
  const labelled = (series: { id: string; parentId?: string }) => parentLabel(series.parentId) === null ? labels[series.id] : `${parentLabel(series.parentId)} — ${labels[series.id]}`;
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(`${stem}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, amountDecimals: 1, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => {
        const values = Object.fromEntries(model.years.map(year => [year, toExport(series.valuesByYear[year])]));
        return {
          kind: series.reference ? "total" : "item", parentLabel: parentLabel(series.parentId), label: labels[series.id], change: null, valuesByYear: values,
          basisByYear: Object.fromEntries(model.years.map(year => [year, values[year] === null ? null : "actual"])),
        };
      }),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), workbookMessage(locale, "workbook.category"), unitLabel, workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [year, labelled(series), toExport(series.valuesByYear[year]), status(series.id, year)]),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
