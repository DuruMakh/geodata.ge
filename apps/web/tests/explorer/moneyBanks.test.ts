import ExcelJS from "exceljs";
import { beforeAll, expect, test, vi } from "vitest";
import { readCsvRecords } from "../../lib/data/csv";
import { loadMoneyBanksFacts, toClientMoneyBanksFact } from "../../lib/data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_SOURCES, type ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { SERVED_DATA_FILES } from "../../lib/data/servedData";
import { projectGdpFact, type ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { colorForItem, INK, SERIES_COLORS } from "../../lib/explorer/colors";
import { buildMoneyBanksHubCards } from "../../lib/explorer/moneyBanksHubCards";
import { buildMoneyBanksWorkbookExportModel } from "../../lib/explorer/moneyBanksWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { loadMoneyBanksWorkbookSources, moneyBanksPageMetadata, renderMoneyBanksPage } from "../../lib/pages/moneyBanks";
import { renderPageMarkup } from "../helpers/render-localized";
import { ciede2000 } from "../helpers/contrast";
import { loadMoneyBanksCsv, yearSpan } from "../helpers/money-banks-csv";
import {
  MONEY_BANKS_LOAN_BREAKS, MONEY_BANKS_SECTIONS, buildMoneyBanksModel, changeMoneyBanksView, defaultMoneyBanksState, moneyBanksCoverage, moneyBanksDefaultSelection, moneyBanksViewSeries, moneyBanksViews,
  parseMoneyBanksHash, serializeMoneyBanksHash,
} from "../../lib/explorer/moneyBanks";

let facts: ClientMoneyBanksFact[];
let gdpFacts: ClientNationalGdpFact[];
// Expected latest values and years are read from the reviewed CSVs, so an NBG or Geostat refresh does not fail these tests.
let csv: Awaited<ReturnType<typeof loadMoneyBanksCsv>>;
beforeAll(async () => {
  facts = (await loadMoneyBanksFacts()).map(toClientMoneyBanksFact);
  gdpFacts = (await loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts)).map(projectGdpFact);
  csv = await loadMoneyBanksCsv();
});
/** The ids a page lists in one of its views. */
const seriesOf = (section: Parameters<typeof moneyBanksViewSeries>[0], view: Parameters<typeof moneyBanksViewSeries>[1]) => moneyBanksViewSeries(section, view).map(s => s.id);
const span = (years: number[]) => ({ min: years[0], max: years.at(-1) });

test("the six sections and their views", () => {
  expect(MONEY_BANKS_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["supply", "/explorer/money/supply", "common.moneySupply"],
    ["loans-deposits", "/explorer/money/loans-deposits", "common.moneyLoansDeposits"],
    ["borrowers", "/explorer/money/borrowers", "common.moneyBorrowers"],
    ["regions", "/explorer/money/regions", "common.moneyRegions"],
    ["interest-rates", "/explorer/money/interest-rates", "common.moneyInterestRates"],
    ["bank-health", "/explorer/money/bank-health", "common.moneyBankHealth"],
  ]);
  expect(moneyBanksViews("supply")).toEqual(["amount", "gdp"]);
  expect(moneyBanksViews("loans-deposits")).toEqual(["amount", "fx_share"]);
  expect(moneyBanksViews("borrowers")).toEqual(["main"]);
  expect(moneyBanksViews("interest-rates")).toEqual(["main"]);
  expect(moneyBanksViews("bank-health")).toEqual(["main"]);
});

test("each page starts with its first series selected, loans and deposits with both totals, and coverage taken from the facts", () => {
  expect(defaultMoneyBanksState("supply")).toEqual({ mode: "line", range: { kind: "all" }, view: "amount", selectedIds: ["money.m3"] });
  expect(defaultMoneyBanksState("loans-deposits")).toEqual({ mode: "line", range: { kind: "all" }, view: "amount", selectedIds: ["loans.total", "deposits.total"] });
  expect(defaultMoneyBanksState("interest-rates")).toEqual({ mode: "line", range: { kind: "all" }, view: "main", selectedIds: ["rates.policy"] });
  expect(defaultMoneyBanksState("bank-health")).toEqual({ mode: "line", range: { kind: "all" }, view: "main", selectedIds: ["banks.npl_ratio"] });
  expect(moneyBanksDefaultSelection("supply", "gdp")).toEqual(["money.m3"]);
  expect(moneyBanksDefaultSelection("loans-deposits", "fx_share")).toEqual(["loans.fx_share"]);
  for (const [section, view] of [["supply", "amount"], ["loans-deposits", "amount"], ["loans-deposits", "fx_share"], ["interest-rates", "main"], ["bank-health", "main"]] as const) {
    expect(moneyBanksCoverage(section, view, facts)).toMatchObject(span(csv.yearsOf(seriesOf(section, view))));
  }
  // % of GDP covers only the years with a GDP.
  expect(moneyBanksCoverage("supply", "gdp", facts, gdpFacts)).toMatchObject(span(csv.gdpYearsOf(seriesOf("supply", "gdp"))));
});

test("totals nest their lari and foreign-currency rows", () => {
  const shape = (section: Parameters<typeof moneyBanksViewSeries>[0], view: Parameters<typeof moneyBanksViewSeries>[1]) =>
    moneyBanksViewSeries(section, view).map(s => [s.id, s.reference, s.parentId]);
  expect(shape("supply", "amount").map(r => r[0])).toEqual(["money.m3", "money.m2", "money.m1", "money.m0"]);
  expect(shape("supply", "gdp").map(r => r[0])).toEqual(["money.m3", "money.m2", "money.m1", "money.m0"]);
  expect(shape("loans-deposits", "amount")).toEqual([
    ["loans.total", true, undefined], ["loans.gel", false, "loans.total"], ["loans.fx", false, "loans.total"],
    ["deposits.total", false, undefined], ["deposits.gel", false, "deposits.total"], ["deposits.fx", false, "deposits.total"],
    ["deposits.individuals", false, undefined], ["deposits.legal_entities", false, undefined],
  ]);
  expect(shape("loans-deposits", "fx_share").map(r => r[0])).toEqual(["loans.fx_share", "deposits.fx_share"]);
  expect(shape("interest-rates", "main")).toEqual([
    ["rates.policy", true, undefined],
    ["rates.loans_total", false, undefined], ["rates.loans_gel", false, "rates.loans_total"], ["rates.loans_fx", false, "rates.loans_total"],
    ["rates.deposits_total", false, undefined], ["rates.deposits_gel", false, "rates.deposits_total"], ["rates.deposits_fx", false, "rates.deposits_total"],
  ]);
  expect(shape("bank-health", "main")).toEqual([
    ["banks.npl_ratio", true, undefined], ["banks.roa", false, undefined], ["banks.roe", false, undefined],
    ["banks.capital_ratio", false, undefined], ["banks.tier1_ratio", false, undefined],
  ]);
});

test("switching to % of GDP clamps a range starting 1995 to 1996, and switching back keeps it", () => {
  const start = { ...defaultMoneyBanksState("supply"), range: { kind: "manual" as const, start: 1995, end: 2005 } };
  const gdp = changeMoneyBanksView(start, "supply", "gdp", facts, gdpFacts);
  expect(gdp).toMatchObject({ view: "gdp", range: { kind: "manual", start: 1996, end: 2005 }, selectedIds: ["money.m3"] });
  const back = changeMoneyBanksView(gdp, "supply", "amount", facts, gdpFacts);
  expect(back).toMatchObject({ view: "amount", range: { kind: "manual", start: 1996, end: 2005 }, selectedIds: ["money.m3"] });
});

test("the % of GDP switch keeps the selection of M3, M2, M1 and M0 both ways, and falls back to the default when empty", () => {
  const view = (view: "amount" | "gdp", selectedIds: string[]) => ({ ...defaultMoneyBanksState("supply"), view, selectedIds });
  for (const selectedIds of [["money.m3", "money.m2", "money.m1", "money.m0"], ["money.m2", "money.m0"], ["money.m1"]]) {
    expect(changeMoneyBanksView(view("amount", selectedIds), "supply", "gdp", facts, gdpFacts).selectedIds).toEqual(selectedIds);
    expect(changeMoneyBanksView(view("gdp", selectedIds), "supply", "amount", facts, gdpFacts).selectedIds).toEqual(selectedIds);
  }
  expect(changeMoneyBanksView(view("amount", []), "supply", "gdp", facts, gdpFacts).selectedIds).toEqual(["money.m3"]);
});

test("% of GDP shows all four aggregates, each December amount divided by Fiscal.ge's GDP and marked calculated", async () => {
  const model = buildMoneyBanksModel("supply", facts, { ...defaultMoneyBanksState("supply"), view: "gdp", selectedIds: ["money.m3", "money.m2", "money.m1", "money.m0"] }, gdpFacts);
  expect(model.unit).toBe("percent");
  expect(model.series.map(s => s.id)).toEqual(["money.m3", "money.m2", "money.m1", "money.m0"]);
  expect(model.selected.map(s => s.id)).toEqual(["money.m3", "money.m2", "money.m1", "money.m0"]);
  const years = csv.gdpYearsOf(seriesOf("supply", "gdp")), latest = years.at(-1)!;
  expect(model.years[0]).toBe(years[0]);
  for (const series of model.series) { expect(series.decimals).toBe(1); for (const year of model.years) expect(series.valuesByYear[year]).not.toBeNull(); }
  // Each aggregate / GDP × 100, both read from the canonical CSVs; for the latest year NBG's own coefficients use an earlier GDP estimate.
  for (const series of model.series) expect(series.valuesByYear[latest]).toBeCloseTo(csv.shareOfGdp(series.id, latest), 10);
  // Before 2010 NBG's M3 coefficient used the same GDP, so the two agree.
  const nbgM3 = facts.find(f => f.indicatorId === "money.m3_to_gdp" && f.year === 2009)!.value;
  expect(Number(model.series[0].valuesByYear[2009]!.toFixed(1))).toBe(nbgM3);
});

test("the foreign-currency switch carries loans and deposits to their shares and back to the totals", () => {
  const amount = (selectedIds: string[]) => ({ ...defaultMoneyBanksState("loans-deposits"), selectedIds });
  const toShare = (selectedIds: string[]) => changeMoneyBanksView(amount(selectedIds), "loans-deposits", "fx_share", facts).selectedIds;
  // The default pair of totals becomes both shares.
  expect(toShare(["loans.total", "deposits.total"])).toEqual(["loans.fx_share", "deposits.fx_share"]);
  // Any loan maps to the loans share and any deposit to the deposits share, de-duplicated and in the view's order.
  expect(toShare(["loans.gel", "loans.fx"])).toEqual(["loans.fx_share"]);
  expect(toShare(["deposits.legal_entities", "loans.fx"])).toEqual(["loans.fx_share", "deposits.fx_share"]);
  for (const id of ["deposits.total", "deposits.gel", "deposits.fx", "deposits.individuals", "deposits.legal_entities"]) expect(toShare([id])).toEqual(["deposits.fx_share"]);
  // Nothing selected falls back to the share view's default.
  expect(toShare([])).toEqual(["loans.fx_share"]);
  const share = (selectedIds: string[]) => ({ ...defaultMoneyBanksState("loans-deposits"), view: "fx_share" as const, selectedIds });
  const toAmount = (selectedIds: string[]) => changeMoneyBanksView(share(selectedIds), "loans-deposits", "amount", facts).selectedIds;
  expect(toAmount(["loans.fx_share", "deposits.fx_share"])).toEqual(["loans.total", "deposits.total"]);
  expect(toAmount(["deposits.fx_share"])).toEqual(["deposits.total"]);
  expect(toAmount(["loans.fx_share"])).toEqual(["loans.total"]);
  expect(toAmount([])).toEqual(["loans.total", "deposits.total"]);
  // The switch keeps the years, clamped to the view's coverage, and survives the round trip.
  const ranged = { ...amount(["deposits.individuals"]), range: { kind: "manual" as const, start: 2005, end: 2015 } };
  const there = changeMoneyBanksView(ranged, "loans-deposits", "fx_share", facts);
  expect(there).toMatchObject({ view: "fx_share", range: { kind: "manual", start: 2005, end: 2015 }, selectedIds: ["deposits.fx_share"] });
  expect(changeMoneyBanksView(there, "loans-deposits", "amount", facts)).toMatchObject({ view: "amount", range: { kind: "manual", start: 2005, end: 2015 }, selectedIds: ["deposits.total"] });
});

test("the hash round-trips, drops another tab's series and keeps an explicit empty selection", () => {
  const state = { mode: "table" as const, view: "amount" as const, range: { kind: "manual" as const, start: 2005, end: 2020 }, selectedIds: ["deposits.total", "deposits.fx"] };
  const hash = serializeMoneyBanksHash(state, "loans-deposits");
  expect(hash).toContain("tab=amount");
  expect(parseMoneyBanksHash(`#${hash}`, "loans-deposits", facts)).toEqual(state);
  const gdp = { mode: "line" as const, view: "gdp" as const, range: { kind: "all" as const }, selectedIds: ["money.m2", "money.m1"] };
  expect(serializeMoneyBanksHash(gdp, "supply")).toContain("tab=gdp");
  expect(parseMoneyBanksHash(`#${serializeMoneyBanksHash(gdp, "supply")}`, "supply", facts, gdpFacts)).toEqual(gdp);
  expect(parseMoneyBanksHash("#tab=fx_share&sel=", "loans-deposits", facts).selectedIds).toEqual([]);
  expect(parseMoneyBanksHash("#tab=fx_share&sel=loans.total", "loans-deposits", facts).selectedIds).toEqual([]);
  expect(parseMoneyBanksHash("#tab=unknown", "loans-deposits", facts)).toMatchObject({ view: "amount", selectedIds: ["loans.total", "deposits.total"] });
  for (const section of ["interest-rates", "bank-health"] as const) {
    const single = serializeMoneyBanksHash(defaultMoneyBanksState(section), section);
    expect(single).not.toContain("tab=");
    expect(parseMoneyBanksHash(`#${single}`, section, facts)).toEqual(defaultMoneyBanksState(section));
  }
  // Links saved while bank health still had tabs keep their selection.
  expect(parseMoneyBanksHash("#tab=profits&sel=banks.roe,banks.roa", "bank-health", facts).selectedIds).toEqual(["banks.roa", "banks.roe"]);
  expect(parseMoneyBanksHash("#tab=capital&sel=banks.tier1_ratio", "bank-health", facts).selectedIds).toEqual(["banks.tier1_ratio"]);
  expect(parseMoneyBanksHash("#tab=npl&sel=", "bank-health", facts).selectedIds).toEqual([]);
});

test("the model carries lari amounts, gaps, signed values and per-series precision", () => {
  const supply = buildMoneyBanksModel("supply", facts, defaultMoneyBanksState("supply"));
  expect(supply.unit).toBe("gel");
  const supplyYears = csv.yearsOf(seriesOf("supply", "amount"));
  expect(supply.selected[0].endValue).toBe(csv.published("money.m3", csv.latestYear("money.m3")) * 1_000_000);
  expect(supply.years).toEqual(Array.from({ length: supplyYears.at(-1)! - supplyYears[0] + 1 }, (_, i) => supplyYears[0] + i));
  expect(supply.series[0].color).toBe(INK);
  expect(supply.series[1].color).not.toBe(INK);

  const health = buildMoneyBanksModel("bank-health", facts, defaultMoneyBanksState("bank-health"));
  expect(health.unit).toBe("percent");
  expect(health.series.find(s => s.id === "banks.roa")!.valuesByYear[2008]!).toBeLessThan(0);
  expect(health.series.find(s => s.id === "banks.capital_ratio")!.valuesByYear[2013]).toBeNull();
  expect(health.series.find(s => s.id === "banks.capital_ratio")!.valuesByYear[2014]).not.toBeNull();

  const deposits = buildMoneyBanksModel("loans-deposits", facts, defaultMoneyBanksState("loans-deposits"));
  expect(deposits.unit).toBe("gel");
  expect(deposits.selected.map(s => s.id)).toEqual(["loans.total", "deposits.total"]);
  expect(deposits.series.find(s => s.id === "deposits.total")!.color).not.toBe(INK);
  expect(deposits.series.find(s => s.id === "deposits.legal_entities")!.valuesByYear[2014]).toBeNull();

  const rates = buildMoneyBanksModel("interest-rates", facts, defaultMoneyBanksState("interest-rates"));
  expect(rates.series.find(s => s.id === "rates.policy")!.decimals).toBe(2);
  expect(rates.series.find(s => s.id === "rates.loans_total")!.decimals).toBe(2);
});

const INDUSTRY_SECTOR_KEYS = {
  agriculture: "a", industry: "c", construction: "f", trade: "g", hotels_restaurants: "i", transport_communications: "h", financial: "k", real_estate: "l", education: "p", health_social: "q", other_services: "s",
} as const;

test("who borrows lists all loans, then three headed groups", () => {
  const rows = moneyBanksViewSeries("borrowers", "main");
  const industries = Object.keys(INDUSTRY_SECTOR_KEYS).map(industry => `borrowers.industry.${industry}`);
  const purposes = ["consumer", "home", "sme", "large_business", "car", "pawn", "other"].map(purpose => `households.purpose.${purpose}`);
  expect(rows.map(row => row.id)).toEqual([
    "borrowers.total", "borrowers.businesses", "borrowers.households", "borrowers.people", "borrowers.individual_entrepreneurs", ...industries, ...purposes,
  ]);
  expect(rows.map(row => row.heading)).toEqual([
    undefined, ...Array(4).fill("borrowers"), ...Array(11).fill("industry"), ...Array(7).fill("purpose"),
  ]);
  expect(rows.every(row => row.parentId === undefined)).toBe(true);
  expect(defaultMoneyBanksState("borrowers").selectedIds).toEqual(["borrowers.total"]);
});

test("who borrows colours are all different", () => {
  const model = buildMoneyBanksModel("borrowers", facts, defaultMoneyBanksState("borrowers"));
  const colors = new Map<string, string>(model.series.map(s => [s.id, s.color]));
  expect(colors.size).toBe(23);
  expect(new Set(colors.values()).size).toBe(23);
  expect(colors.get("borrowers.total")).toBe(INK);
  expect(colors.get("borrowers.industry.construction")).toBe(colorForItem("sector.f", 0));
  for (const [industry, key] of Object.entries(INDUSTRY_SECTOR_KEYS)) expect(colors.get(`borrowers.industry.${industry}`)).toBe(SERIES_COLORS[`sector.${key}`]);
  // The four borrower rows and seven purposes wear no economic-sector colour.
  const sectorColors = new Set(Object.entries(SERIES_COLORS).filter(([key]) => key.startsWith("sector.")).map(([, color]) => color));
  for (const [id, color] of colors) if (!id.startsWith("borrowers.industry.") && id !== "borrowers.total") expect(sectorColors.has(color), id).toBe(false);
  // The rows this page colours itself (the total, the four borrowers and seven purposes) read as different colours, not only different hexes:
  // "Other loans" is #94856D, so Large business may not be the near-identical #8A7B65. Industries keep their sector colours, some of which sit closer.
  const fixed = [...colors].filter(([id]) => !id.startsWith("borrowers.industry."));
  expect(fixed).toHaveLength(12);
  for (const [i, [leftId, left]] of fixed.entries()) for (const [rightId, right] of fixed.slice(i + 1)) expect(ciede2000(left, right), `${leftId} vs ${rightId}`).toBeGreaterThanOrEqual(10);
});

test("households before 2015 are gaps, not zeros", () => {
  const state = parseMoneyBanksHash("#view=line&sel=borrowers.households&start=2003&end=2010", "borrowers", facts);
  const model = buildMoneyBanksModel("borrowers", facts, state);
  expect(model.range).toMatchObject({ start: 2003, end: 2010 });
  expect(model.selected.map(s => s.id)).toEqual(["borrowers.households"]);
  expect(Object.values(model.selected[0].valuesByYear)).toEqual(Array(8).fill(null));
});

test("the loan breaks mirror the register", async () => {
  const register = (await readCsvRecords("../../data/imports/money-banks-series-breaks.csv")).filter(row => row.break_id.startsWith("loans_"));
  expect(register.length).toBeGreaterThan(0);
  expect(MONEY_BANKS_LOAN_BREAKS).toEqual(register.map(row => ({ breakId: row.break_id, year: Number(row.reference_date.slice(0, 4)), appliesTo: row.applies_to.split(";") })));
});

test("who borrows Excel marks a break year in the status column", async () => {
  const model = await workbookFor("borrowers", "main", ["borrowers.industry.trade"], 2013, 2015);
  const status = (year: number) => model.analysis.rows.find(r => r[0] === year && r[1] === "borrowers.industry.trade")![3] as string;
  expect(status(2014)).toBe("Official · series break");
  expect(status(2013)).toBe("Official");
  expect(status(2015)).toBe("Official · series break");
  // Another page's workbook never carries the mark.
  expect((await workbookFor("loans-deposits", "amount", ["loans.total"], 2014, 2015)).analysis.rows.map(r => r[3])).not.toContain("Official · series break");
});

// The money messages arrive with the page text, so these tests carry the few labels the workbook and hub cards read.
const TEST_MESSAGES = {
  "common.moneySupply": "Money supply", "common.moneyLoansDeposits": "Loans and deposits", "common.moneyBorrowers": "Who borrows", "common.moneyRegions": "Loans by region", "common.moneyInterestRates": "Interest rates", "common.moneyBankHealth": "Bank health",
  "moneyBanks.unitMlnGel": "million GEL", "moneyBanks.unitPercent": "%", "moneyBanks.status.official": "Official", "moneyBanks.status.calculated": "Calculated by Fiscal.ge", "moneyBanks.status.break": "series break",
  "moneyBanks.series": "Series", "moneyBanks.amountHeader.gel": "Amount (million GEL)", "moneyBanks.amountHeader.percent": "Value (%)",
  "moneyBanks.page.supply.title": "Money supply", "moneyBanks.page.loans-deposits.title": "Loans and deposits", "moneyBanks.page.borrowers.title": "Who borrows", "moneyBanks.page.interest-rates.title": "Interest rates", "moneyBanks.page.bank-health.title": "Bank health",
  "moneyBanks.page.supply.summary": "supply", "moneyBanks.page.loans-deposits.summary": "loans", "moneyBanks.page.borrowers.summary": "borrowers", "moneyBanks.page.regions.summary": "regions", "moneyBanks.page.interest-rates.summary": "rates", "moneyBanks.page.bank-health.summary": "health",
  "moneyBanks.tab.amount": "Amount", "moneyBanks.tab.gdp": "Compared with GDP",
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

test("the deposits workbook exports million GEL, leaves 2010-2014 company deposits blank and cites only the deposit files", async () => {
  const ids = ["deposits.total", "deposits.gel", "deposits.fx", "deposits.individuals", "deposits.legal_entities"];
  const model = await workbookFor("loans-deposits", "amount", ids, 2010, 2025);
  expect(model.filename).toBe("fiscal-money-loans-deposits-amount-2010-2025-en.xlsx");
  expect(model.readable.title).toBe("Loans and deposits · Amount");
  expect(model.readable.years).toHaveLength(16);
  expect(model.readable.rows).toHaveLength(5);
  // All deposits is a peer of All loans on this page, not a total over the rows below it.
  expect(model.readable.rows.map(row => row.kind)).not.toContain("total");
  expect(model.readable.unitLabel).toBe("million GEL");
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(csv.published("deposits.total", 2025));
  const legal = model.readable.rows[4];
  for (let year = 2010; year <= 2014; year++) { expect(legal.valuesByYear[year]).toBeNull(); expect(legal.basisByYear[year]).toBeNull(); }
  expect(legal.valuesByYear[2015]).not.toBeNull();
  const status = (id: string, year: number) => model.analysis.rows.find(r => r[0] === year && r[1] === id)![3];
  expect(status("deposits.total", 2025)).toBe("Calculated by Fiscal.ge");
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

test("only the Money supply workbook styles its first series as a total", async () => {
  expect((await workbookFor("supply", "amount", ["money.m3", "money.m2"], 2020, 2025)).readable.rows.map(row => row.kind)).toEqual(["total", "item"]);
  expect((await workbookFor("bank-health", "main", ["banks.npl_ratio", "banks.roa"], 2020, 2025)).readable.rows.map(row => row.kind)).toEqual(["item", "item"]);
});

test("the interest-rates workbook shows every interest rate to two decimals, as NBG prints them", async () => {
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
  expect(formats(excel.worksheets[0], "rates.loans_total")).toEqual(["0.00"]);
  const data = excel.worksheets[1];
  expect(data.getCell(2, 3).numFmt).toBe("0.00");
  expect(data.getCell(2, 2).value).toBe("rates.policy");
  expect(data.getCell(3, 3).numFmt).toBe("0.00");
  expect(data.getCell(3, 2).value).toBe("rates.loans_total");
});

test("the bank-health workbook keeps the 2008 loss as a negative percent", async () => {
  const model = await workbookFor("bank-health", "main", ["banks.roa", "banks.roe"], 2008, 2010);
  expect(model.filename).toBe("fiscal-money-bank-health-2008-2010-en.xlsx");
  const roa = model.readable.rows.find(row => row.label === "banks.roa")!;
  expect(roa.valuesByYear[2008]!).toBeLessThan(0);
  expect(model.analysis.rows.find(r => r[0] === 2008 && r[1] === "banks.roa")![2]!).toBeLessThan(0);
  expect(model.sources.map(source => source.title)).toEqual(["nbg_fsi_archive"]);
});

test("the % of GDP workbook exports the calculated shares and cites the GDP source beside the NBG money file", async () => {
  const gdpSources = [{ years: [2010, 2025], title: "Geostat GDP", organization: "Geostat", downloadHref: "https://www.geostat.ge/media/gdp.xlsx" as const, retrievedAt: "2026-08-13" }];
  const model = buildMoneyBanksWorkbookExportModel({
    section: "supply", facts, gdpFacts, gdpSources, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(["money.m1", "money.m0"]),
    state: { mode: "table", view: "gdp", range: { kind: "manual", start: 2020, end: 2025 }, selectedIds: ["money.m1", "money.m0"] },
  }, await presentation());
  expect(model.filename).toBe("fiscal-money-supply-gdp-2020-2025-en.xlsx");
  expect(model.readable.unitLabel).toBe("% of GDP");
  expect(model.analysis.headers[2]).toBe("Share of GDP (%)");
  expect(model.readable.rows.map(row => Number(row.valuesByYear[2025]!.toFixed(1)))).toEqual(["money.m1", "money.m0"].map(id => Number(csv.shareOfGdp(id, 2025).toFixed(1))));
  expect(new Set(model.analysis.rows.map(row => row[3]))).toEqual(new Set(["Calculated by Fiscal.ge"]));
  expect(model.analysis.rows).toHaveLength(12);
  expect(model.sources.map(source => source.title)).toEqual(["nbg_money_aggregates", "Geostat GDP"]);
  // The amounts cite only the NBG file.
  const amounts = buildMoneyBanksWorkbookExportModel({
    section: "supply", facts, gdpFacts, gdpSources, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(["money.m1"]),
    state: { mode: "table", view: "amount", range: { kind: "manual", start: 2020, end: 2025 }, selectedIds: ["money.m1"] },
  }, await presentation());
  expect(amounts.sources.map(source => source.title)).toEqual(["nbg_money_aggregates"]);
  expect(amounts.analysis.rows[0][3]).toBe("Official");
});

test.each(["ka", "en"] as const)("the %s pages hand Excel the ten archived NBG workbooks with their public links", async locale => {
  const sources = await loadMoneyBanksWorkbookSources(locale);
  expect(sources.map(source => source.sourceId).sort()).toEqual([...MONEY_BANKS_SOURCES].sort());
  for (const source of sources) expect(source.downloadHref).toMatch(/^\/downloads\/methodology\/money\/files\/[a-z0-9._-]+\.xlsx$/);
  const range = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
  // The 2022 break between the archived and the current FSI file is fixed; the current file's last year follows the data.
  expect(sources.find(source => source.sourceId === "nbg_fsi_archive")!.years).toEqual(range(2001, 2021));
  expect(sources.find(source => source.sourceId === "nbg_fsi")!.years).toEqual(range(2022, csv.sourceYears("nbg_fsi").at(-1)!));
  expect(sources.find(source => source.sourceId === "nbg_fsi")!.title).toBe(locale === "en" ? "Financial soundness indicators (FSI)" : "ფინანსური მდგრადობის მაჩვენებლები (FSI)");
  expect(new Set(sources.map(source => source.organization))).toEqual(new Set([locale === "en" ? "National Bank of Georgia (NBG)" : "საქართველოს ეროვნული ბანკი"]));
  const model = buildMoneyBanksWorkbookExportModel({
    section: "bank-health", facts, sources, siteOrigin: "https://fiscal.ge", labels: labelsFor(["banks.npl_ratio"]),
    state: { mode: "table", view: "main", range: { kind: "manual", start: 2020, end: 2025 }, selectedIds: ["banks.npl_ratio"] },
  }, await presentation());
  expect(model.sources.map(source => source.absoluteUrl).sort()).toEqual(["https://fiscal.ge/downloads/methodology/money/files/fsieng-archive.xlsx", "https://fiscal.ge/downloads/methodology/money/files/fsieng.xlsx"]);
});

test("the hub has six cards with the first series of each page and their latest values, Loans by region only its years", async () => {
  const base = await presentation();
  const cards = buildMoneyBanksHubCards(facts, { ...base, messages: { ...await getMessages("en", ["moneyBanks"]), ...base.messages } });
  expect(cards.map(card => card.href)).toEqual(MONEY_BANKS_SECTIONS.map(section => section.href));
  // Each card follows its page's headline series, the latest year and its value, over the years the page covers: Loans and
  // deposits reaches back to 1996 through deposits, Interest rates through deposit rates, Bank health through its other ratios.
  const footer = (id: string, value: (year: number) => string, span: string) => {
    const latest = csv.yearsOf([id]).at(-1)!;
    return `${latest} · ${value(latest)} · ${span}`;
  };
  expect(cards.map(card => card.footer)).toEqual([
    footer("money.m3", year => `${csv.billions("money.m3", year)} bn GEL`, yearSpan(csv.yearsOf(["money.m3"]))),
    footer("loans.total", year => `${csv.billions("loans.total", year)} bn GEL`, "1996–2025"),
    footer("borrowers.total", year => `${csv.billions("borrowers.total", year)} bn GEL`, yearSpan(csv.yearsOf(["borrowers.total"]))),
    yearSpan(csv.yearsOf(["loans_region.georgia.total"])),
    footer("rates.policy", year => `${csv.percent("rates.policy", year)}%`, "1996–2025"),
    footer("banks.npl_ratio", year => `${csv.percent("banks.npl_ratio", year)}%`, "2001–2025"),
  ]);
  expect(cards.map(card => card.latest?.caption ?? null)).toEqual(["Broad money (M3)", "All loans", "All loans", null, "National Bank rate", "Bad loans, share of all loans"]);
  expect(cards[3].footer).toBe("2015–2025");
  expect([cards[3].series, cards[3].seriesColor]).toEqual([null, null]);
});

// U24-10: the page's own metadata and Dataset record, in both languages, with its years read from the data.
test.each(["ka", "en"] as const)("each %s page names itself in its metadata and Dataset record and covers the data's years", async locale => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
  try {
    const messages = await getMessages(locale, ["moneyBanks"]);
    // Loans by region is the index of the area pages, with its own page module (moneyBanksAreas.test.ts).
    for (const section of MONEY_BANKS_SECTIONS.filter((item): item is Exclude<typeof item, { id: "regions" }> => item.id !== "regions")) {
      const metadata = await moneyBanksPageMetadata(locale, section.id);
      expect(metadata.title).toContain(message(messages, `moneyBanks.page.${section.id}.metaTitle`));
      expect(metadata.description).toBe(message(messages, `moneyBanks.page.${section.id}.summary`));
      expect(metadata.alternates?.canonical).toBe(`https://fiscal.ge${locale === "en" ? "/en" : ""}${section.href}`);
      const html = renderPageMarkup(locale, await renderMoneyBanksPage(locale, section.id));
      const dataset = JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]);
      expect(dataset.name).toBe(message(messages, `moneyBanks.page.${section.id}.title`));
      const ids = [...new Set(moneyBanksViews(section.id).flatMap(view => seriesOf(section.id, view)))];
      expect(dataset.temporalCoverage).toBe(yearSpan(csv.yearsOf(ids)).replace("–", "/"));
      expect(dataset.url).toBe(`https://fiscal.ge${locale === "en" ? "/en" : ""}${section.href}`);
    }
  } finally {
    vi.unstubAllEnvs();
  }
});

// Who borrows: one list under three small headings, searchable, with the latest total in the line under the title.
test("who borrows renders headed rows, search and the 2025 line", async () => {
  const html = renderPageMarkup("en", await renderMoneyBanksPage("en", "borrowers"));
  const text = (fragment: string) => fragment.replace(/<[^>]*>/g, "").replace(/&nbsp;|\u00a0/g, " ");
  const year = csv.latestYear("borrowers.total");
  const line = html.match(/<p[^>]*data-testid="money-latest"[^>]*>([\s\S]*?)<\/p>/)![1];
  expect(text(line)).toBe(`${year}: all loans ${csv.billions("borrowers.total", year)} bn GEL`);
  expect([...html.matchAll(/<p[^>]*data-testid="series-heading"[^>]*>([\s\S]*?)<\/p>/g)].map(match => text(match[1]))).toEqual(["Who borrows", "Businesses by industry", "What households borrow for"]);
  expect(html).toMatch(/<input[^>]*type="search"/);
  // No collapsible parents in the series list: the only expandable control is the chart's share button.
  expect(html.match(/<[^>]*aria-expanded[^>]*>/g)?.filter(tag => !tag.includes('data-testid="chart-share"')) ?? []).toEqual([]);
  const ka = await getMessages("ka", ["moneyBanks"]);
  expect((await moneyBanksPageMetadata("ka", "borrowers")).title).toContain(message(ka, "moneyBanks.page.borrowers.metaTitle"));
});

// U24-09: the deposits row says "individuals" as its id and the Georgian do, and the line under the heading names the
// loans series as its series row does.
test.each(["ka", "en"] as const)("the %s loans and deposits labels match their rows", async (locale) => {
  const messages = await getMessages(locale, ["moneyBanks"]);
  expect(messages["moneyBanks.latest.loans-deposits"]).toBe(messages["moneyBanks.series.loans.total"]);
  if (locale === "en") expect(messages["moneyBanks.series.deposits.individuals"]).toBe("Deposits of individuals");
});
