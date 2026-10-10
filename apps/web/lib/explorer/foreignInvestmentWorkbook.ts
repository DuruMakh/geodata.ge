import type { ClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import { FOREIGN_INVESTMENT_TOTAL_ID } from "../data/externalFlows/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { buildForeignInvestmentModel } from "./foreignInvestment";
import { unitFor } from "./format";
import type { ForeignInvestmentState } from "./foreignInvestmentState";
import { buildWorkbookExportModel, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

// The annual total table and Geostat's FDI metadata always apply; each tab adds its own breakdown table.
const SOURCE_FILES = { always: ["fdi_eng_by_quarters.xlsx", "fdi_metadata_1002_090626_en.pdf"], country: "fdi_eng-countries.xlsx", sector: "fdi_eng-sectors-nace-2.xlsx", region: "fdi_eng_regions.xlsx" } as const;
export function buildForeignInvestmentWorkbookModel(input: { data: ClientForeignInvestmentData; state: ForeignInvestmentState; sources: readonly WorkbookPublicSource[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel {
  const model = buildForeignInvestmentModel(input.data, input.state, presentation);
  const t = (key: string) => message(presentation.messages, `external.${key}`), tab = t(`investment.tab.${input.state.dimension}`);
  const files = new Set<string>([...SOURCE_FILES.always, SOURCE_FILES[input.state.dimension]]);
  const exportModel = buildWorkbookExportModel({
    locale: presentation.locale, filenameBase: "foreign-investment", title: t("investment.title"), groupLabel: tab, years: model.years,
    measure: { kind: "amount", unitLabel: model.unit.label, readableScale: model.unit.divisor }, totalId: FOREIGN_INVESTMENT_TOTAL_ID, includeTotalsInAnalysis: true, showChangeColumn: false,
    series: model.selectedIds.map(id => ({ id, kind: id === FOREIGN_INVESTMENT_TOTAL_ID ? "total" : "item", label: model.series.find(item => item.id === id)!.label, parentLabel: null, pointsByYear: Object.fromEntries(model.years.map(year => [year, { amountGel: model.valuesByEntity[id][year], basis: "actual" as const }])) })),
    sources: input.sources.filter(source => model.selectedCount > 0 && files.has(source.downloadHref.split("/").at(-1)!)), siteOrigin: input.siteOrigin,
  });
  exportModel.readable.subtitle = `${tab} · ${model.range.start}–${model.range.end} · ${model.unit.label}`;
  const values = model.selectedIds.flatMap(id => model.years.map(year => model.valuesByEntity[id][year])).filter((value): value is number => value !== null);
  const amountDecimals = Math.max(model.unit.decimals, unitFor(values, model.unit, 15).decimals);
  const amountFormat = "#,##0." + "0".repeat(amountDecimals);
  exportModel.readable.amountDecimals = amountDecimals;
  exportModel.readable.numberFormat = `${amountFormat};"−"${amountFormat}`;
  exportModel.analysis.headers[3] = t("workbook.amount");
  exportModel.analysis.numericFormats = { 4: '#,##0.###############;"−"#,##0.###############' };
  return exportModel;
}
