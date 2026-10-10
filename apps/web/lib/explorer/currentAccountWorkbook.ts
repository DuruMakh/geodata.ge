import type { ClientCurrentAccountFact } from "../data/externalFlows/importCurrentAccount";
import { CURRENT_ACCOUNT_SERIES } from "../data/externalFlows/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { buildCurrentAccountModel, type CurrentAccountGdp } from "./currentAccount";
import { unitFor } from "./format";
import type { CurrentAccountState } from "./currentAccountState";
import { buildWorkbookExportModel, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

const SOURCE_FILE = "bop-6_bopbpm6eng.xlsx";
/** The active tab's series, years and unit. The Balance tab always exports all five; % of GDP keeps the USD amount beside the share. */
export function buildCurrentAccountWorkbookModel(input: { facts: readonly ClientCurrentAccountFact[]; gdp: readonly CurrentAccountGdp[]; state: CurrentAccountState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel {
  const model = buildCurrentAccountModel(input.facts, input.gdp, input.state, presentation);
  const usd = input.state.unit === "gdp" ? buildCurrentAccountModel(input.facts, input.gdp, { ...input.state, unit: "usd" }, presentation) : model;
  const t = (key: string) => message(presentation.messages, `external.${key}`), tab = t(`account.tab.${input.state.tab}`);
  const ids = input.state.tab === "balance" ? [...CURRENT_ACCOUNT_SERIES] : model.selectedIds;
  const percent = input.state.unit === "gdp";
  const exportModel = buildWorkbookExportModel({
    locale: presentation.locale, filenameBase: "current-account", title: t("account.title"), groupLabel: tab, years: model.years,
    measure: percent ? { kind: "percentage", unitLabel: model.unit.label, analysisHeader: model.unit.label } : { kind: "amount", unitLabel: model.unit.label, readableScale: model.unit.divisor },
    totalId: "ca.balance", includeTotalsInAnalysis: true, showChangeColumn: false,
    series: ids.map(id => ({ id, kind: id === "ca.balance" ? "total" : "item", label: model.series.find(item => item.id === id)!.label, parentLabel: null, pointsByYear: Object.fromEntries(model.years.map(year => [year, { amountGel: usd.valuesById[id][year], measureValue: percent ? model.valuesById[id][year] : undefined, basis: "actual" as const }])) })),
    sources: input.sources.filter(source => ids.length > 0 && source.downloadHref.split("/").at(-1) === SOURCE_FILE), siteOrigin: input.siteOrigin,
  });
  exportModel.readable.subtitle = `${tab} · ${model.range.start}–${model.range.end} · ${model.unit.label}`;
  const values = ids.flatMap(id => model.years.map(year => model.valuesById[id][year])).filter((value): value is number => value !== null);
  const decimals = Math.max(model.unit.decimals, unitFor(values, model.unit, 15).decimals), format = "#,##0." + "0".repeat(decimals);
  exportModel.readable.amountDecimals = decimals;
  exportModel.readable.numberFormat = `${format};"−"${format}`;
  exportModel.analysis.headers[3] = t("workbook.amount");
  const exact = '#,##0.###############;"−"#,##0.###############';
  exportModel.analysis.numericFormats = percent ? { 4: exact, [exportModel.analysis.headers.length]: exact } : { 4: exact };
  return exportModel;
}
