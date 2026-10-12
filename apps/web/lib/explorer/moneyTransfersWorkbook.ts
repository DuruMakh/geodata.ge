import type { ClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { MONEY_TRANSFER_TOTAL_ID } from "../data/externalFlows/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { buildMoneyTransfersModel } from "./moneyTransfers";
import { unitFor } from "./format";
import type { MoneyTransfersState } from "./moneyTransfersState";
import { buildWorkbookExportModel, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

const TRANSFERS_FILE = "remc_money-transfers-by-countries-eng.xlsx";
export function buildMoneyTransfersWorkbookModel(input: { data: ClientMoneyTransfersData; state: MoneyTransfersState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel {
  const model = buildMoneyTransfersModel(input.data, input.state, presentation);
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const months = new Map(input.data.facts.filter(f => f.measure === input.state.measure).map(f => [`${f.entityId}:${f.year}`, f.monthsReported]));
  const exportModel = buildWorkbookExportModel({
    locale: presentation.locale, filenameBase: "money-from-abroad", title: t("money.title"), groupLabel: t(`measure.${input.state.measure}`), years: model.years,
    measure: { kind: "amount", unitLabel: model.unit.label, readableScale: model.unit.divisor }, totalId: MONEY_TRANSFER_TOTAL_ID, includeTotalsInAnalysis: true, showChangeColumn: false,
    series: model.selectedIds.map(id => {
      return { id, kind: id === MONEY_TRANSFER_TOTAL_ID ? "total" : "item", label: model.series.find(item => item.id === id)!.label, parentLabel: null, pointsByYear: Object.fromEntries(model.years.map(year => [year, { amountGel: model.valuesByEntity[id][year], basis: "actual" as const }])) };
    }), sources: input.sources.filter(source => model.selectedCount > 0 && source.downloadHref.split("/").at(-1) === TRANSFERS_FILE), siteOrigin: input.siteOrigin,
  });
  const partial = model.selectedIds.some(id => model.partialMonths[id]);
  const notes = [partial && t("workbook.partialNote")].filter(Boolean);
  exportModel.readable.subtitle = [`${t(`measure.${input.state.measure}`)} · ${model.range.start}–${model.range.end} · ${model.unit.label}`, ...notes].join(" · ");
  const values = model.selectedIds.flatMap(id => model.years.map(year => model.valuesByEntity[id][year])).filter((value): value is number => value !== null);
  const amountDecimals = Math.max(model.unit.decimals, unitFor(values, model.unit, 15).decimals);
  const amountFormat = "#,##0." + "0".repeat(amountDecimals);
  exportModel.readable.amountDecimals = amountDecimals;
  exportModel.readable.numberFormat = `${amountFormat};"−"${amountFormat}`;
  exportModel.analysis.headers[3] = t("workbook.amount");
  exportModel.analysis.headers.push(t("workbook.months"));
  // Analysis rows run year by year, then series by series.
  const keys = model.years.flatMap(year => model.selectedIds.map(id => `${id}:${year}`));
  exportModel.analysis.rows = exportModel.analysis.rows.map((row, index) => [...row, months.get(keys[index]) ?? null]);
  exportModel.analysis.numericFormats = { 4: '#,##0.###############;"−"#,##0.###############' };
  return exportModel;
}
