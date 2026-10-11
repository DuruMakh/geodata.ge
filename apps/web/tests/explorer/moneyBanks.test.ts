import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadMoneyBanksFacts, toClientMoneyBanksFact } from "../../lib/data/moneyBanks/importMoneyBanks";
import type { ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import { INK } from "../../lib/explorer/colors";
import { buildMoneyBanksHubCards } from "../../lib/explorer/moneyBanksHubCards";
import { buildMoneyBanksWorkbookExportModel } from "../../lib/explorer/moneyBanksWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import {
  MONEY_BANKS_SECTIONS, buildMoneyBanksModel, changeMoneyBanksView, defaultMoneyBanksState, moneyBanksCoverage, moneyBanksViewSeries, moneyBanksViews,
  parseMoneyBanksHash, serializeMoneyBanksHash,
} from "../../lib/explorer/moneyBanks";

let facts: ClientMoneyBanksFact[];
beforeAll(async () => { facts = (await loadMoneyBanksFacts()).map(toClientMoneyBanksFact); });

test("the four sections and their tabs", () => {
  expect(MONEY_BANKS_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["supply", "/explorer/money/supply", "common.moneySupply"],
    ["loans-deposits", "/explorer/money/loans-deposits", "common.moneyLoansDeposits"],
    ["interest-rates", "/explorer/money/interest-rates", "common.moneyInterestRates"],
    ["bank-health", "/explorer/money/bank-health", "common.moneyBankHealth"],
  ]);
  expect(moneyBanksViews("supply")).toEqual(["amount", "gdp"]);
  expect(moneyBanksViews("loans-deposits")).toEqual(["loans", "deposits", "fx_share"]);
  expect(moneyBanksViews("interest-rates")).toEqual(["main"]);
  expect(moneyBanksViews("bank-health")).toEqual(["npl", "profits", "capital"]);
});

test("each page starts with only its first series selected and coverage taken from the facts", () => {
  expect(defaultMoneyBanksState("supply")).toEqual({ mode: "line", range: { kind: "all" }, view: "amount", selectedIds: ["money.m3"] });
  expect(defaultMoneyBanksState("interest-rates")).toEqual({ mode: "line", range: { kind: "all" }, view: "main", selectedIds: ["rates.policy"] });
  expect(defaultMoneyBanksState("bank-health")).toEqual({ mode: "line", range: { kind: "all" }, view: "npl", selectedIds: ["banks.npl_ratio"] });
  expect(moneyBanksCoverage("supply", "amount", facts)).toMatchObject({ min: 1995, max: 2025 });
  expect(moneyBanksCoverage("interest-rates", "main", facts)).toMatchObject({ min: 1996, max: 2025 });
  expect(moneyBanksCoverage("bank-health", "npl", facts)).toMatchObject({ min: 2003, max: 2025 });
  expect(moneyBanksCoverage("bank-health", "capital", facts)).toMatchObject({ min: 2014, max: 2025 });
  expect(moneyBanksCoverage("loans-deposits", "fx_share", facts)).toMatchObject({ min: 1996, max: 2025 });
});

test("totals nest their lari and foreign-currency rows", () => {
  const shape = (section: Parameters<typeof moneyBanksViewSeries>[0], view: Parameters<typeof moneyBanksViewSeries>[1]) =>
    moneyBanksViewSeries(section, view).map(s => [s.id, s.reference, s.parentId]);
  expect(shape("supply", "amount").map(r => r[0])).toEqual(["money.m3", "money.m2", "money.m1", "money.m0"]);
  expect(shape("supply", "gdp").map(r => r[0])).toEqual(["money.m3_to_gdp", "money.m2_to_gdp"]);
  expect(shape("loans-deposits", "loans")).toEqual([
    ["loans.total", true, undefined], ["loans.gel", false, "loans.total"], ["loans.fx", false, "loans.total"],
  ]);
  expect(shape("loans-deposits", "deposits")).toEqual([
    ["deposits.total", true, undefined], ["deposits.gel", false, "deposits.total"], ["deposits.fx", false, "deposits.total"],
    ["deposits.individuals", false, undefined], ["deposits.legal_entities", false, undefined],
  ]);
  expect(shape("loans-deposits", "fx_share").map(r => r[0])).toEqual(["loans.fx_share", "deposits.fx_share"]);
  expect(shape("interest-rates", "main")).toEqual([
    ["rates.policy", true, undefined],
    ["rates.loans_total", false, undefined], ["rates.loans_gel", false, "rates.loans_total"], ["rates.loans_fx", false, "rates.loans_total"],
    ["rates.deposits_total", false, undefined], ["rates.deposits_gel", false, "rates.deposits_total"], ["rates.deposits_fx", false, "rates.deposits_total"],
  ]);
  expect(shape("bank-health", "npl").map(r => r[0])).toEqual(["banks.npl_ratio"]);
  expect(shape("bank-health", "profits").map(r => r[0])).toEqual(["banks.roe", "banks.roa"]);
  expect(shape("bank-health", "capital").map(r => r[0])).toEqual(["banks.capital_ratio", "banks.tier1_ratio"]);
});

test("switching to Capital clamps a range starting 2005 to 2014, and switching back keeps it", () => {
  const start = { ...defaultMoneyBanksState("bank-health"), range: { kind: "manual" as const, start: 2005, end: 2025 } };
  const capital = changeMoneyBanksView(start, "bank-health", "capital", facts);
  expect(capital).toMatchObject({ view: "capital", range: { kind: "manual", start: 2014, end: 2025 }, selectedIds: ["banks.capital_ratio"] });
  const back = changeMoneyBanksView(capital, "bank-health", "npl", facts);
  expect(back).toMatchObject({ view: "npl", range: { kind: "manual", start: 2014, end: 2025 }, selectedIds: ["banks.npl_ratio"] });
});

test("the hash round-trips, drops another tab's series and keeps an explicit empty selection", () => {
  const state = { mode: "table" as const, view: "deposits" as const, range: { kind: "manual" as const, start: 2005, end: 2020 }, selectedIds: ["deposits.total", "deposits.fx"] };
  const hash = serializeMoneyBanksHash(state, "loans-deposits");
  expect(parseMoneyBanksHash(`#${hash}`, "loans-deposits", facts)).toEqual(state);
  expect(parseMoneyBanksHash("#tab=npl&sel=", "bank-health", facts).selectedIds).toEqual([]);
  expect(parseMoneyBanksHash("#tab=capital&sel=banks.roe", "bank-health", facts).selectedIds).toEqual([]);
  expect(parseMoneyBanksHash("#tab=unknown", "bank-health", facts)).toMatchObject({ view: "npl", selectedIds: ["banks.npl_ratio"] });
  const rates = serializeMoneyBanksHash(defaultMoneyBanksState("interest-rates"), "interest-rates");
  expect(rates).not.toContain("tab=");
  expect(parseMoneyBanksHash(`#${rates}`, "interest-rates", facts)).toEqual(defaultMoneyBanksState("interest-rates"));
});

test("the model carries lari amounts, gaps, signed values and per-series precision", () => {
  const supply = buildMoneyBanksModel("supply", facts, defaultMoneyBanksState("supply"));
  expect(supply.unit).toBe("gel");
  expect(supply.selected[0].endValue).toBe(57680200000);
  expect(supply.years).toEqual(Array.from({ length: 31 }, (_, i) => 1995 + i));
  expect(supply.series[0].color).toBe(INK);
  expect(supply.series[1].color).not.toBe(INK);

  const profits = buildMoneyBanksModel("bank-health", facts, { ...defaultMoneyBanksState("bank-health"), view: "profits" });
  expect(profits.unit).toBe("percent");
  expect(profits.series.find(s => s.id === "banks.roa")!.valuesByYear[2008]!).toBeLessThan(0);

  const deposits = buildMoneyBanksModel("loans-deposits", facts, { ...defaultMoneyBanksState("loans-deposits"), view: "deposits" });
  expect(deposits.series.find(s => s.id === "deposits.legal_entities")!.valuesByYear[2014]).toBeNull();

  const rates = buildMoneyBanksModel("interest-rates", facts, defaultMoneyBanksState("interest-rates"));
  expect(rates.series.find(s => s.id === "rates.policy")!.decimals).toBe(2);
  expect(rates.series.find(s => s.id === "rates.loans_total")!.decimals).toBe(1);
});

// The money messages arrive with the page text, so these tests carry the few labels the workbook and hub cards read.
const TEST_MESSAGES = {
  "common.moneySupply": "Money supply", "common.moneyLoansDeposits": "Loans and deposits", "common.moneyInterestRates": "Interest rates", "common.moneyBankHealth": "Bank health",
  "moneyBanks.unitMlnGel": "million GEL", "moneyBanks.unitPercent": "%", "moneyBanks.status.official": "Official", "moneyBanks.status.calculated": "Calculated by fiscal.ge",
  "moneyBanks.series": "Series", "moneyBanks.amountHeader.gel": "Amount (million GEL)", "moneyBanks.amountHeader.percent": "Value (%)",
  "moneyBanks.page.supply.title": "Money supply", "moneyBanks.page.loans-deposits.title": "Loans and deposits", "moneyBanks.page.interest-rates.title": "Interest rates", "moneyBanks.page.bank-health.title": "Bank health",
  "moneyBanks.page.supply.summary": "supply", "moneyBanks.page.loans-deposits.summary": "loans", "moneyBanks.page.interest-rates.summary": "rates", "moneyBanks.page.bank-health.summary": "health",
  "moneyBanks.tab.amount": "Amount", "moneyBanks.tab.deposits": "Deposits", "moneyBanks.tab.profits": "Profits", "moneyBanks.tab.npl": "Bad loans",
};
const presentation = async (): Promise<Presentation> => ({ locale: "en", englishLabels: {}, messages: { ...await getMessages("en", ["workbook", "format", "common"]), ...TEST_MESSAGES } });
const SOURCES = ["nbg_money_aggregates", "nbg_loans_l3_5", "nbg_deposits_d3_17", "nbg_deposits_individuals_d3_23", "nbg_deposits_legal_d3_27", "nbg_policy_rate", "nbg_fsi_archive", "nbg_fsi"].map(sourceId => ({
  sourceId, years: Array.from({ length: 31 }, (_, i) => 1995 + i), title: sourceId, organization: "National Bank of Georgia", retrievedAt: "2026-10-11",
  downloadHref: `/downloads/methodology/money/files/${sourceId}.xlsx` as const,
}));
const labelsFor = (ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, id]));
const workbookFor = async (section: Parameters<typeof moneyBanksViews>[0], view: Parameters<typeof moneyBanksViewSeries>[1], selectedIds: string[], start: number, end: number) =>
  buildMoneyBanksWorkbookExportModel({
    section, facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(selectedIds),
    state: { mode: "table", view, range: { kind: "manual", start, end }, selectedIds },
  }, await presentation());

test("the Deposits workbook exports million GEL, leaves 2010-2014 company deposits blank and cites only the deposit files", async () => {
  const ids = ["deposits.total", "deposits.gel", "deposits.fx", "deposits.individuals", "deposits.legal_entities"];
  const model = await workbookFor("loans-deposits", "deposits", ids, 2010, 2025);
  expect(model.filename).toBe("fiscal-money-loans-deposits-deposits-2010-2025-en.xlsx");
  expect(model.readable.years).toHaveLength(16);
  expect(model.readable.rows).toHaveLength(5);
  expect(model.readable.unitLabel).toBe("million GEL");
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(68496.9);
  const legal = model.readable.rows[4];
  for (let year = 2010; year <= 2014; year++) { expect(legal.valuesByYear[year]).toBeNull(); expect(legal.basisByYear[year]).toBeNull(); }
  expect(legal.valuesByYear[2015]).not.toBeNull();
  const status = (id: string, year: number) => model.analysis.rows.find(r => r[0] === year && r[1] === id)![3];
  expect(status("deposits.total", 2025)).toBe("Calculated by fiscal.ge");
  expect(status("deposits.gel", 2025)).toBe("Official");
  expect(status("deposits.legal_entities", 2012)).toBe("Not available");
  expect(model.analysis.rows).toHaveLength(80);
  expect(model.analysis.headers).not.toContain("source_cell");
  expect(model.sources.map(source => source.title)).toEqual(["nbg_deposits_d3_17", "nbg_deposits_individuals_d3_23", "nbg_deposits_legal_d3_27"]);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
  const sheet = excel.worksheets[0];
  const legalRow = [...Array(sheet.rowCount).keys()].map(i => sheet.getRow(i + 1)).find(row => row.getCell(1).value === "deposits.legal_entities")!;
  expect(legalRow.getCell(2).value).toBeNull();
  expect(legalRow.getCell(17).value).not.toBeNull();
});

test("the interest-rates workbook shows the National Bank rate to two decimals and the rest to one", async () => {
  const ids = ["rates.policy", "rates.loans_total"];
  const model = await workbookFor("interest-rates", "main", ids, 2020, 2025);
  expect(model.filename).toBe("fiscal-money-interest-rates-2020-2025-en.xlsx");
  expect(model.readable.unitLabel).toBe("%");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  const formats = (sheet: ExcelJS.Worksheet, label: string) => {
    const row = [...Array(sheet.rowCount).keys()].map(i => sheet.getRow(i + 1)).find(r => r.getCell(1).value === label)!;
    return [...new Set(model.readable.years.map((_, i) => row.getCell(i + 2).numFmt))];
  };
  expect(formats(excel.worksheets[0], "rates.policy")).toEqual(["0.00"]);
  expect(formats(excel.worksheets[0], "rates.loans_total")).toEqual(["0.0"]);
  const data = excel.worksheets[1];
  expect(data.getCell(2, 3).numFmt).toBe("0.00");
  expect(data.getCell(2, 2).value).toBe("rates.policy");
  expect(data.getCell(3, 3).numFmt).toBe("0.0");
  expect(data.getCell(3, 2).value).toBe("rates.loans_total");
});

test("the Profits workbook keeps the 2008 loss as a negative percent", async () => {
  const model = await workbookFor("bank-health", "profits", ["banks.roe", "banks.roa"], 2008, 2010);
  expect(model.filename).toBe("fiscal-money-bank-health-profits-2008-2010-en.xlsx");
  const roa = model.readable.rows.find(row => row.label === "banks.roa")!;
  expect(roa.valuesByYear[2008]!).toBeLessThan(0);
  expect(model.analysis.rows.find(r => r[0] === 2008 && r[1] === "banks.roa")![2]!).toBeLessThan(0);
  expect(model.sources.map(source => source.title)).toEqual(["nbg_fsi_archive"]);
});

test("the hub has four cards with the first series of each page and their latest values", async () => {
  const cards = buildMoneyBanksHubCards(facts, await presentation());
  expect(cards.map(card => card.href)).toEqual(MONEY_BANKS_SECTIONS.map(section => section.href));
  expect(cards.map(card => card.footer)).toEqual(["2025 · 57.7 bn GEL · 1995–2025", "2025 · 72.5 bn GEL · 2002–2025", "2025 · 8.00% · 2008–2025", "2025 · 2.5% · 2003–2025"]);
  expect(cards.map(card => card.series?.length)).toEqual([31, 24, 18, 23]);
});
