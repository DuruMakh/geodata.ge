import type { ClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_SOURCES } from "../data/tradeProducts/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { unitFor } from "./format";
import { buildTradeProductsModel, tradeProductLabel } from "./tradeProducts";
import { TRADE_PRODUCT_TOTAL_ID, type TradeProductsState } from "./tradeProductsState";
import { buildWorkbookExportModel, mergeSourcesByHref, withAbsoluteUrls, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

export function buildTradeProductsWorkbookModel(input: { data: ClientTradeProductsData; state: TradeProductsState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel {
  const model = buildTradeProductsModel(input.data, input.state, presentation);
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const entities = new Map(input.data.entities.map(entity => [entity.id, entity]));
  const filenames = new Set<string>();
  for (const id of model.selectedIds) {
    if (id === TRADE_PRODUCT_TOTAL_ID) { filenames.add("ftrade_1995-2026.xlsx"); continue; }
    const entity = entities.get(id)!;
    const sourceId = TRADE_PRODUCT_SOURCES[entity.sourceBlock][input.state.measure === "trade.exports" ? "export" : "import"];
    filenames.add(`${sourceId.replace("geostat_trade_", "").replace("-eng", "_eng")}.xlsx`);
  }
  const sources = input.sources.filter(source => filenames.has(source.downloadHref.split("/").at(-1)!));
  const exportModel = buildWorkbookExportModel({
    locale: presentation.locale, filenameBase: "trade-products", title: t("products.title"), groupLabel: t(`indicator.${input.state.measure}`), years: model.years,
    measure: { kind: "amount", unitLabel: model.unit.label, readableScale: model.unit.divisor }, totalId: TRADE_PRODUCT_TOTAL_ID, includeTotalsInAnalysis: true, showChangeColumn: false,
    series: model.selectedIds.map(id => {
      const entity = entities.get(id);
      return { id, kind: id === TRADE_PRODUCT_TOTAL_ID ? "total" : "item", label: entity ? tradeProductLabel(entity, presentation, !input.data.sourceBlock) : t("partners.total"), parentLabel: t(`indicator.${input.state.measure}`), pointsByYear: Object.fromEntries(model.years.map(year => [year, { amountGel: model.valuesByEntity[id][year], basis: "actual" as const }])) };
    }), sources, siteOrigin: input.siteOrigin,
  });
  exportModel.sources = withAbsoluteUrls(mergeSourcesByHref(sources, source => {
    const active = source.years.filter(year => model.years.includes(year));
    return active.length ? active : source.years;
  }), input.siteOrigin);
  exportModel.readable.subtitle = `${t(`indicator.${input.state.measure}`)} · ${model.range.start}–${model.range.end} · ${model.unit.label}${input.data.sourceBlock ? "" : ` · ${t("products.historicalNote")}`} · ${t("products.workbookNote")}`;
  const values = model.selectedIds.flatMap(id => model.years.map(year => model.valuesByEntity[id][year])).filter((value): value is number => value !== null);
  const amountDecimals = Math.max(model.unit.decimals, unitFor(values, model.unit, 15).decimals);
  const amountFormat = "#,##0." + "0".repeat(amountDecimals);
  exportModel.readable.amountDecimals = amountDecimals;
  exportModel.readable.numberFormat = `${amountFormat};"−"${amountFormat}`;
  exportModel.analysis.headers[3] = t("workbook.amount");
  exportModel.analysis.headers.push(t("workbook.publication"));
  exportModel.analysis.rows = exportModel.analysis.rows.map(row => [...row, t("publicationUnspecified")]);
  exportModel.analysis.numericFormats = { 4: '#,##0.###############;"−"#,##0.###############' };
  return exportModel;
}
