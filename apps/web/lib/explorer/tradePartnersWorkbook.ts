import type { ClientTradePartnersData } from "../data/tradePartners/importTradePartners";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { buildTradePartnersModel } from "./tradePartners";
import { TRADE_PARTNER_TOTAL_ID, type TradePartnersState } from "./tradePartnersState";
import { buildWorkbookExportModel, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

export function buildTradePartnersWorkbookModel(input: { data: ClientTradePartnersData; state: TradePartnersState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel {
  const model = buildTradePartnersModel(input.data, input.state, presentation);
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const entities = new Map(input.data.entities.map(entity => [entity.id, entity]));
  const filenames = new Set<string>();
  for (const id of model.selectedIds) {
    if (id === TRADE_PARTNER_TOTAL_ID) { filenames.add("ftrade_1995-2026.xlsx"); continue; }
    const kind = entities.get(id)!.kind, suffix = kind === "country" ? "country" : "country-group";
    if (input.state.measure !== "trade.imports") filenames.add(`export-${suffix}-1995-2026.xlsx`);
    if (input.state.measure !== "trade.exports") filenames.add(`import-${suffix}-1995-2026.xlsx`);
  }
  const exportModel = buildWorkbookExportModel({
    locale: presentation.locale, filenameBase: "trade-partners", title: t("partners.title"), groupLabel: t(`indicator.${input.state.measure}`), years: model.years,
    measure: { kind: "amount", unitLabel: model.unit.label, readableScale: model.unit.divisor }, totalId: TRADE_PARTNER_TOTAL_ID, includeTotalsInAnalysis: true, showChangeColumn: false,
    series: model.selectedIds.map(id => {
      const entity = entities.get(id);
      return { id, kind: id === TRADE_PARTNER_TOTAL_ID ? "total" : "item", label: entity ? publicLabel(presentation.locale, id, entity.labelKa, presentation.englishLabels) : t("partners.total"), parentLabel: entity ? t(entity.kind === "country" ? "partners.countries" : "partners.groups") : t("partners.total"), pointsByYear: Object.fromEntries(model.years.map(year => [year, { amountGel: model.valuesByEntity[id][year], basis: "actual" as const }])) };
    }), sources: input.sources.filter(source => filenames.has(source.downloadHref.split("/").at(-1)!)), siteOrigin: input.siteOrigin,
  });
  const groupNote = model.selectedIds.some(id => entities.get(id)?.kind === "group") ? ` · ${t("partners.groupOverlap")}` : "";
  exportModel.readable.subtitle = `${t(`indicator.${input.state.measure}`)} · ${model.range.start}–${model.range.end} · ${model.unit.label} · ${t("workbook.formulas")}${groupNote}`;
  exportModel.readable.amountDecimals = model.unit.decimals;
  exportModel.readable.numberFormat = "#,##0." + "0".repeat(model.unit.decimals) + ";−#,##0." + "0".repeat(model.unit.decimals);
  exportModel.analysis.headers[3] = t("workbook.amount");
  exportModel.analysis.headers.push(t("workbook.publication"));
  exportModel.analysis.rows = exportModel.analysis.rows.map(row => [...row, t("publicationUnspecified")]);
  exportModel.analysis.numericFormats = { 4: "#,##0.###############;−#,##0.###############" };
  return exportModel;
}
