import { beforeAll, expect, test } from "vitest";
import { loadTaxBreaksRefundsFacts, toClientTaxBreaksRefundsFact } from "../../lib/data/taxBreaksRefunds/importTaxBreaksRefunds";
import { TAX_BREAKS_REFUNDS_SOURCES, type ClientTaxBreaksRefundsFact } from "../../lib/data/taxBreaksRefunds/types";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { SERVED_DATA_FILES } from "../../lib/data/servedData";
import { projectGdpFact, type ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { buildTaxBreaksRefundsWorkbookExportModel } from "../../lib/explorer/taxBreaksRefundsWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";

let facts: ClientTaxBreaksRefundsFact[];
let gdpFacts: ClientNationalGdpFact[];
beforeAll(async () => {
  facts = (await loadTaxBreaksRefundsFacts()).map(toClientTaxBreaksRefundsFact);
  gdpFacts = (await loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts)).map(projectGdpFact);
});
// The page messages arrive with the page text, so the test carries the few labels the workbook reads.
const TEST_MESSAGES = {
  "taxBreaksRefunds.title": "Tax breaks and refunds", "taxBreaksRefunds.series": "Series", "taxBreaksRefunds.unitMlnGel": "million GEL", "taxBreaksRefunds.unitPercent": "%",
  "taxBreaksRefunds.amountHeader": "Amount (million GEL)", "taxBreaksRefunds.status.official": "Official", "taxBreaksRefunds.status.calculated": "Calculated by Fiscal.ge",
  "taxBreaksRefunds.tab.amount": "Amount", "taxBreaksRefunds.tab.gdp": "Compared with GDP",
};
const presentation = async (): Promise<Presentation> => ({ locale: "en", englishLabels: {}, messages: { ...await getMessages("en", ["workbook", "format", "common"]), ...TEST_MESSAGES } });
const SOURCES = TAX_BREAKS_REFUNDS_SOURCES.map(sourceId => ({
  sourceId, years: sourceId === "treasury_tax_refunds_chart" ? Array.from({ length: 18 }, (_, i) => 2008 + i) : Array.from({ length: 7 }, (_, i) => 2018 + i),
  title: sourceId, organization: "Ministry of Finance", retrievedAt: "2026-10-21", downloadHref: `/downloads/methodology/tax-breaks-refunds/files/${sourceId}.xlsx` as const,
}));
const GDP_SOURCES = [{ years: [2008, 2025], title: "Geostat GDP", organization: "Geostat", downloadHref: "https://www.geostat.ge/media/gdp.xlsx" as const, retrievedAt: "2026-08-13" }];
const labels = { "tax_refunds.total": "Tax refunds", "tax_breaks.total": "Total tax breaks", "tax_breaks.vat.child_care": "Child care" };
const workbook = async (view: "amount" | "gdp", selectedIds: string[], start: number, end: number) => buildTaxBreaksRefundsWorkbookExportModel({
  facts, gdpFacts, gdpSources: GDP_SOURCES, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels,
  state: { mode: "table", view, range: { kind: "manual", start, end }, selectedIds },
}, await presentation());

test("a refunds-only workbook for 2008-2017 exports million GEL and cites only the Treasury", async () => {
  const model = await workbook("amount", ["tax_refunds.total"], 2008, 2017);
  expect(model.filename).toBe("fiscal-tax-breaks-refunds-2008-2017-en.xlsx");
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.rows[0].valuesByYear[2008]).toBe(124);
  expect(model.sources.map(source => source.title)).toEqual(["treasury_tax_refunds_chart"]);
  expect(model.analysis.rows[0]).toEqual([2008, "Tax refunds", 124, "Official"]);
});

test("tax-break years outside the report are empty cells, never zeros", async () => {
  const model = await workbook("amount", ["tax_breaks.total", "tax_refunds.total"], 2016, 2025);
  expect(model.readable.rows[0].valuesByYear[2016]).toBeNull();
  expect(model.readable.rows[0].valuesByYear[2025]).toBeNull();
  expect(model.readable.rows[0].valuesByYear[2024]).toBeCloseTo(6403.18, 2);
  expect(model.readable.rows.map(row => row.kind)).toEqual(["item", "item"]);
  expect(model.sources.map(source => source.title)).toEqual(["mof_tax_expenditure_report_2024_xlsx_ka", "treasury_tax_refunds_chart"]);
});

test("the % of GDP workbook exports shares to two decimals and adds the GDP source", async () => {
  const model = await workbook("gdp", ["tax_breaks.total", "tax_breaks.vat.child_care"], 2018, 2024);
  expect(model.filename).toBe("fiscal-tax-breaks-refunds-gdp-2018-2024-en.xlsx");
  expect(model.readable.unitLabel).toBe("% of GDP");
  expect(model.readable.numberFormat).toBe("0.00");
  expect(model.readable.rows[0].valuesByYear[2024]).toBeCloseTo(6.88, 2);
  expect(new Set(model.analysis.rows.map(row => row[3]))).toEqual(new Set(["Calculated by Fiscal.ge"]));
  expect(model.sources.map(source => source.title)).toEqual(["mof_tax_expenditure_report_2024_xlsx_ka", "Geostat GDP"]);
});
