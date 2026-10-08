import type { ClientTradeOverviewFact } from "../data/tradeOverview/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { buildTradeOverviewModel } from "./tradeOverview";
import type { TradeOverviewState } from "./tradeOverviewState";
import { buildWorkbookExportModel, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

export function buildTradeOverviewWorkbookExportModel(input: { facts: readonly ClientTradeOverviewFact[]; state: TradeOverviewState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel {
  const model = buildTradeOverviewModel(input.facts, input.state, presentation);
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const exportModel = buildWorkbookExportModel({
    locale: presentation.locale, filenameBase: "trade-overview", title: t("title"), groupLabel: t("title"), years: model.years,
    measure: { kind: "amount", unitLabel: model.unit.label, readableScale: model.unit.divisor }, totalId: "trade.turnover", includeTotalsInAnalysis: true, showChangeColumn: false,
    series: model.selectedIds.map(id => ({ id, kind: id === "trade.turnover" ? "total" : "item", parentLabel: null, label: t(`indicator.${id}`),
      pointsByYear: Object.fromEntries(model.years.map(year => [year, model.valuesByIndicator[id][year] === null ? null : { amountGel: model.valuesByIndicator[id][year], basis: "actual" as const }])),
    })), sources: model.selectedIds.length ? [...input.sources] : [], siteOrigin: input.siteOrigin,
  });
  exportModel.readable.subtitle = `${model.range.start}–${model.range.end} · ${model.unit.label} · ${t("workbook.formulas")}`;
  exportModel.readable.amountDecimals = model.unit.decimals;
  exportModel.readable.numberFormat = "#,##0." + "0".repeat(model.unit.decimals) + ";−#,##0." + "0".repeat(model.unit.decimals);
  exportModel.analysis.headers[3] = t("workbook.amount");
  exportModel.analysis.headers.push(t("workbook.publication"));
  exportModel.analysis.rows = exportModel.analysis.rows.map(row => [...row, t("publicationUnspecified")]);
  exportModel.analysis.numericFormats = { 4: "#,##0.########;−#,##0.########" };
  return exportModel;
}
