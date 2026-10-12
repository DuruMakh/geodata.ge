import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { DEFAULT_FOREIGN_INVESTMENT_STATE } from "../../lib/explorer/foreignInvestmentState";
import { foreignInvestmentEntities, foreignInvestmentFacts } from "../data/externalFlows/fixtures";
const data = toClientForeignInvestmentData({ entities: foreignInvestmentEntities(), facts: foreignInvestmentFacts() });
const names = ["fdi_eng_by_quarters.xlsx", "fdi_eng-countries.xlsx", "fdi_eng-sectors-nace-2.xlsx", "fdi_eng_regions.xlsx", "fdi_metadata_1002_090626_en.pdf"];
const sources: WorkbookPublicSource[] = names.map(name => ({ years: Array.from({ length: 30 }, (_, i) => 1996 + i), title: name, organization: "Geostat", downloadHref: `/downloads/methodology/external-flows/files/${name}`, retrievedAt: "2026-10-10" }));
const englishLabels = { "fdi.total": "Foreign direct investment, total", "fdi.country.m49_826": "United Kingdom", "fdi.country.unknown": "Unknown", "fdi.sector.k": "Financial and insurance activities", "fdi.region.guria": "Guria", "fdi.region.tbilisi": "Tbilisi" };
async function presentation(locale: "en" | "ka"): Promise<Presentation> {
  return { locale, englishLabels, messages: await getMessages(locale, ["workbook", "external"]) };
}
const builder = async () => (await import("../../lib/explorer/foreignInvestmentWorkbook")).buildForeignInvestmentWorkbookModel;
const state = (change: Partial<typeof DEFAULT_FOREIGN_INVESTMENT_STATE>) => ({ ...DEFAULT_FOREIGN_INVESTMENT_STATE, ...change });

test.each(["en", "ka"] as const)("native %s workbook carries the tab, the selection, negative USD amounts and the tab's Geostat sources", async locale => {
  const p = await presentation(locale), build = await builder();
  const model = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ selectedIds: ["fdi.total", "fdi.country.m49_826"], range: { kind: "manual", start: 2015, end: 2015 } }) }, p);
  expect(model.filename).toContain("foreign-investment");
  expect(model.readable.rows.map(row => row.label)).toEqual(locale === "en" ? ["Foreign direct investment, total", "United Kingdom"] : ["პირდაპირი უცხოური ინვესტიციები, სულ", "გაერთიანებული სამეფო"]);
  expect(model.analysis.rows.map(row => row[3])).toEqual([1000, -120.5]);
  expect(model.readable.subtitle).toContain(p.messages["external.investment.tab.country"]);
  expect(model.analysis.headers.join(" ")).not.toMatch(/GEL|₾|entity_id|source_cell/);
  expect(model.sources.map(s => s.title)).toEqual(["fdi_eng_by_quarters.xlsx", "fdi_eng-countries.xlsx", "fdi_metadata_1002_090626_en.pdf"]);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
});

test("missing cells stay blank, the region tab links the region table, and an empty selection exports nothing", async () => {
  const p = await presentation("en"), build = await builder();
  const regions = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ dimension: "region", selectedIds: ["fdi.region.guria"], range: { kind: "all" } }) }, p);
  expect(regions.analysis.rows.map(row => row[3])).toEqual([null, 2]);
  expect(regions.sources.map(s => s.title)).toContain("fdi_eng_regions.xlsx");
  expect(regions.sources.map(s => s.title)).not.toContain("fdi_eng-countries.xlsx");
  const empty = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ selectedIds: [] }) }, p);
  expect(empty.readable.rows).toEqual([]); expect(empty.analysis.rows).toEqual([]); expect(empty.sources).toEqual([]);
});
