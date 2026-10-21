import type { ClientTaxBreaksRefundsFact } from "../data/taxBreaksRefunds/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import type { ClientNationalGdpFact } from "./clientData";
import { buildTaxBreaksRefundsModel, taxBreaksRefundsViewFacts, type TaxBreaksRefundsState } from "./taxBreaksRefunds";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

const MILLION = 1_000_000;

/**
 * The selected rows and years in million GEL, or as shares of GDP to two decimals. The Sources sheet lists only the
 * originals the exported cells come from, plus national GDP's Geostat files on % of GDP (as on Money supply).
 */
export function buildTaxBreaksRefundsWorkbookExportModel(input: {
  facts: readonly ClientTaxBreaksRefundsFact[]; state: TaxBreaksRefundsState; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string;
  gdpFacts: readonly ClientNationalGdpFact[]; gdpSources: readonly WorkbookPublicSource[];
}, presentation: Presentation): WorkbookExportModel {
  const { state, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `taxBreaksRefunds.${key}`);
  const model = buildTaxBreaksRefundsModel(input.facts, state, input.gdpFacts);
  const byCell = new Map(taxBreaksRefundsViewFacts(state.view, input.facts, input.gdpFacts).map(f => [`${f.indicatorId}:${f.year}`, f]));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId));
  const isGdp = state.view === "gdp";
  const unitLabel = isGdp ? workbookMessage(locale, "workbook.percentGdp") : t("unitMlnGel");
  const numberFormat = isGdp ? "0.00" : "#,##0.0";
  const toExport = (value: number | null) => value === null ? null : isGdp ? value : value / MILLION;
  // Every published amount is official; a share of GDP is Fiscal.ge's calculation.
  const status = (id: string, year: number) => byCell.has(`${id}:${year}`) ? t(isGdp ? "status.calculated" : "status.official") : workbookMessage(locale, "workbook.unavailable");
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(`tax-breaks-refunds${isGdp ? "-gdp" : ""}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${input.title ?? t("title")} · ${t(`tab.${state.view}`)}`, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, amountDecimals: 1, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => {
        const values = Object.fromEntries(model.years.map(year => [year, toExport(series.valuesByYear[year])]));
        return {
          kind: "item", parentLabel: null, label: labels[series.id], change: null, valuesByYear: values,
          basisByYear: Object.fromEntries(model.years.map(year => [year, values[year] === null ? null : "actual"])),
        };
      }),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("series"), isGdp ? workbookMessage(locale, "workbook.gdpHeader") : t("amountHeader"), workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [year, labels[series.id], toExport(series.valuesByYear[year]), status(series.id, year)]),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls([...originals, ...(isGdp ? input.gdpSources : [])], input.siteOrigin),
  };
}
