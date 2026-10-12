import type { ClientTradePartnersData } from "../data/tradePartners/importTradePartners";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { buildTradePartnersModel } from "./tradePartners";
import { tradePartnersTotalId, type TradePartnersState } from "./tradePartnersState";
import { applySignedAmountFormat, buildWorkbookExportModel, EXACT_SIGNED_FORMAT, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

export function buildTradePartnersWorkbookModel(input: { dataset?: "services"; data: ClientTradePartnersData; state: TradePartnersState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel {
  const model = buildTradePartnersModel(input.data, input.state, presentation);
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const entities = new Map(input.data.entities.map(entity => [entity.id, entity]));
  const services = input.dataset === "services" || input.data.dataset === "services", domestic = !services && Boolean(input.data.measures);
  const totalId = tradePartnersTotalId(input.data);
  const indicatorLabel = t(`${services ? "services." : ""}indicator.${input.state.measure}`);
  const filenames = new Set<string>();
  for (const id of model.selectedIds) {
    if (services) {
      if (input.state.measure !== "trade.imports") filenames.add("georgian-exports-of-services-by-types.xlsx");
      if (input.state.measure !== "trade.exports") filenames.add("georgian-imports-of-services-by-types.xlsx");
      continue;
    }
    if (domestic) {
      filenames.add("domestic-export-country-2014-2026.xlsx");
      if (input.state.measure === "trade.reexports") filenames.add(id === totalId ? "ftrade_1995-2026.xlsx" : "export-country-1995-2026.xlsx");
      continue;
    }
    if (id === totalId) { filenames.add("ftrade_1995-2026.xlsx"); continue; }
    const kind = entities.get(id)!.kind, suffix = kind === "country" ? "country" : "country-group";
    if (input.state.measure !== "trade.imports") filenames.add(`export-${suffix}-1995-2026.xlsx`);
    if (input.state.measure !== "trade.exports") filenames.add(`import-${suffix}-1995-2026.xlsx`);
  }
  const exportModel = buildWorkbookExportModel({
    locale: presentation.locale, filenameBase: services ? "trade-services-types" : domestic ? "trade-domestic-countries" : "trade-partners", title: t(services ? "services.typesTitle" : domestic ? "domestic.countriesTitle" : "partners.title"), groupLabel: indicatorLabel, years: model.years,
    measure: { kind: "amount", unitLabel: model.unit.label, readableScale: model.unit.divisor }, totalId: totalId, includeTotalsInAnalysis: true, showChangeColumn: false,
    series: model.selectedIds.map(id => {
      const entity = entities.get(id);
      return { id, kind: id === totalId ? "total" : "item", label: entity ? publicLabel(presentation.locale, id, entity.labelKa, presentation.englishLabels) : t(services ? "services.total" : "partners.total"), parentLabel: entity ? t(services ? "services.types" : entity.kind === "country" ? "partners.countries" : "partners.groups") : t(services ? "services.total" : "partners.total"), pointsByYear: Object.fromEntries(model.years.map(year => [year, { amountGel: model.valuesByEntity[id][year], basis: model.valuesByEntity[id][year] === null ? "not_available" as const : "actual" as const }])) };
    }), sources: input.sources.filter(source => filenames.has(services ? source.downloadHref.split("/").at(-1)!.toLowerCase() : source.downloadHref.split("/").at(-1)!)), siteOrigin: input.siteOrigin,
  });
  const groupNote = model.selectedIds.some(id => entities.get(id)?.kind === "group") ? ` · ${t("partners.groupOverlap")}` : "";
  exportModel.readable.subtitle = `${indicatorLabel} · ${model.range.start}–${model.range.end} · ${model.unit.label} · ${t(services ? "services.workbookNote" : domestic ? "domestic.workbookNote" : "workbook.formulas")}${groupNote}`;
  if (domestic || services) exportModel.readable.fitSubtitle = true;
  const values = model.selectedIds.flatMap(id => model.years.map(year => model.valuesByEntity[id][year])).filter((value): value is number => value !== null);
  applySignedAmountFormat(exportModel, values, model.unit);
  exportModel.analysis.headers[3] = t("workbook.amount");
  exportModel.analysis.headers.push(t("workbook.publication"));
  exportModel.analysis.rows = exportModel.analysis.rows.map(row => [...row, t("publicationUnspecified")]);
  exportModel.analysis.numericFormats = { 4: EXACT_SIGNED_FORMAT };
  return exportModel;
}
