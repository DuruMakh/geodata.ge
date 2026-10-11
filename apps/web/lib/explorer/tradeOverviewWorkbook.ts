import type { ClientTradeOverviewFact } from "../data/tradeOverview/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { buildTradeOverviewModel } from "./tradeOverview";
import { tradeOverviewIndicators, type TradeOverviewState } from "./tradeOverviewState";
import { buildWorkbookExportModel, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

export function buildTradeOverviewWorkbookExportModel(input: { facts: readonly ClientTradeOverviewFact[]; state: TradeOverviewState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel {
  const model = buildTradeOverviewModel(input.facts, input.state, presentation);
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const domestic = input.facts.some(f => f.indicatorId === "trade.domestic_exports"), totalId = tradeOverviewIndicators(input.facts)[0];
  const title = t(domestic ? "domestic.title" : "title");
  const sourceNames = new Set<string>();
  if (domestic) for (const id of model.selectedIds) {
    if (id !== "trade.domestic_exports") sourceNames.add("ftrade_1995-2026.xlsx");
    if (id !== "trade.exports") sourceNames.add("domestic-export-country-2014-2026.xlsx");
  }
  const sources = domestic ? input.sources.filter(source => sourceNames.has(source.downloadHref.split("/").at(-1)!)) : [...input.sources];
  const exportModel = buildWorkbookExportModel({
    locale: presentation.locale, filenameBase: domestic ? "trade-domestic-overview" : "trade-overview", title, groupLabel: title, years: model.years,
    measure: { kind: "amount", unitLabel: model.unit.label, readableScale: model.unit.divisor }, totalId, includeTotalsInAnalysis: true, showChangeColumn: false,
    series: model.selectedIds.map(id => ({ id, kind: id === totalId ? "total" : "item", parentLabel: null, label: t(domestic && id === "trade.exports" ? "domestic.totalExports" : `indicator.${id}`),
      pointsByYear: Object.fromEntries(model.years.map(year => [year, model.valuesByIndicator[id][year] === null ? null : { amountGel: model.valuesByIndicator[id][year], basis: "actual" as const }])),
    })), sources: model.selectedIds.length ? sources : [], siteOrigin: input.siteOrigin,
  });
  exportModel.readable.subtitle = `${model.range.start}–${model.range.end} · ${model.unit.label} · ${t(domestic ? "domestic.workbookNote" : "workbook.formulas")}`;
  if (domestic) exportModel.readable.fitSubtitle = true;
  exportModel.readable.amountDecimals = model.unit.decimals;
  exportModel.readable.numberFormat = "#,##0." + "0".repeat(model.unit.decimals) + ";−#,##0." + "0".repeat(model.unit.decimals);
  exportModel.analysis.headers[3] = t("workbook.amount");
  exportModel.analysis.headers.push(t("workbook.publication"));
  exportModel.analysis.rows = exportModel.analysis.rows.map(row => [...row, t("publicationUnspecified")]);
  exportModel.analysis.numericFormats = { 4: "#,##0.########;−#,##0.########" };
  return exportModel;
}
