import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { MONEY_BANKS_CSV_HEADERS, prepareMoneyBanksData, REVIEWED_AT } from "../../../lib/data/moneyBanks/prepareMoneyBanks";
import { MONEY_BANKS_INDICATORS, MONEY_BANKS_SOURCES, type MoneyBanksFact } from "../../../lib/data/moneyBanks/types";
import { expectedMoneyBanksKeys, moneyBanksDisplayDecimals, validateMoneyBanksFacts } from "../../../lib/data/moneyBanks/validation";

const root = path.resolve(process.cwd(), "../..");
const loadFacts = async (): Promise<MoneyBanksFact[]> =>
  (parse(await fs.readFile(path.join(root, "data/imports/money-banks-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as MoneyBanksFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as MoneyBanksFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as MoneyBanksFact["valueStatus"],
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly MoneyBanksFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Sets an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const setValue = (f: MoneyBanksFact, value: string) => {
  const decimals = moneyBanksDisplayDecimals(f.indicatorId);
  return Object.assign(f, { value, publishedValue: new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals) });
};

test("the canonical file reproduces the research package", async () => {
  await expect(prepareMoneyBanksData(root, "check")).resolves.toBeUndefined();
});

test("serves all 730 reviewed values over the approved coverage", async () => {
  const facts = await loadFacts();
  expect(facts).toHaveLength(730);
  expect(expectedMoneyBanksKeys().size).toBe(730);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(MONEY_BANKS_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(MONEY_BANKS_SOURCES));
  expect(facts.filter(f => f.valueStatus === "calculated")).toHaveLength(119);
  expect(facts.every(f => f.basis === "actual" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(find(facts, "money.m3", 2025).publishedValue).toBe("57680.2");
  expect(find(facts, "rates.policy", 2025).publishedValue).toBe("8.00");
  expect(find(facts, "deposits.fx_share", 2025).publishedValue).toBe("48.6");
  expect(Math.min(...facts.filter(f => f.indicatorId === "rates.policy").map(f => f.year))).toBe(2008);
  expect(Math.max(...facts.map(f => f.year))).toBe(2025);
});

test("the canonical file is UTF-8 with a BOM and the agreed header", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/money-banks-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(MONEY_BANKS_CSV_HEADERS.join(","));
});

test("both bank-health series breaks are served with demography's columns", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/money-banks-series-breaks.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const rows = parse(bytes, { columns: true, bom: true }) as Record<string, string>[];
  expect(Object.keys(rows[0])).toEqual(["break_id", "applies_to", "reference_date", "reason", "source_note"]);
  expect(rows.map(r => [r.break_id, r.applies_to, r.reference_date])).toEqual([
    ["fsi_method_2022", "banks.npl_ratio;banks.roe", "2022-01-01"],
    ["fsi_ifrs_2023", "banks.npl_ratio;banks.roa;banks.roe;banks.capital_ratio;banks.tier1_ratio", "2023-01-01"],
  ]);
});

test.each([
  ["an altered published value", (facts: MoneyBanksFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a duplicate observation", (facts: MoneyBanksFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: MoneyBanksFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2007 National Bank rate", (facts: MoneyBanksFact[]) => { facts.push({ ...find(facts, "rates.policy", 2008), year: 2007 }); }, /outside the approved coverage/],
  ["a 2014 legal-entity deposit", (facts: MoneyBanksFact[]) => { facts.push({ ...find(facts, "deposits.legal_entities", 2015), year: 2014 }); }, /outside the approved coverage/],
  ["lari plus foreign currency differing from total loans", (facts: MoneyBanksFact[]) => { const f = find(facts, "loans.gel", 2020); setValue(f, new Decimal(f.value).plus(1).toFixed()); }, /loans/],
  ["lari plus foreign currency differing from total deposits", (facts: MoneyBanksFact[]) => { const f = find(facts, "deposits.total", 2020); setValue(f, new Decimal(f.value).plus(1).toFixed()); }, /deposits/],
  ["people plus companies differing from all deposits", (facts: MoneyBanksFact[]) => { const f = find(facts, "deposits.legal_entities", 2020); setValue(f, new Decimal(f.value).plus(1).toFixed()); }, /deposits/],
  ["M1 above M2", (facts: MoneyBanksFact[]) => { setValue(find(facts, "money.m1", 2010), new Decimal(find(facts, "money.m2", 2010).value).plus(1).toFixed()); }, /order/],
  ["a foreign-currency share of 101", (facts: MoneyBanksFact[]) => { setValue(find(facts, "deposits.fx_share", 2025), "101"); }, /range/],
  ["a negative amount", (facts: MoneyBanksFact[]) => { setValue(find(facts, "money.m0", 2010), "-1"); }, /range/],
  ["a calculated status on M3", (facts: MoneyBanksFact[]) => { find(facts, "money.m3", 2020).valueStatus = "calculated"; }, /source contract/],
  ["an official status on total deposits", (facts: MoneyBanksFact[]) => { find(facts, "deposits.total", 2020).valueStatus = "official"; }, /source contract/],
  ["a bank-health row from the wrong file", (facts: MoneyBanksFact[]) => { find(facts, "banks.roa", 2021).sourceId = "nbg_fsi"; }, /source contract/],
  ["a share that does not follow its amounts", (facts: MoneyBanksFact[]) => { setValue(find(facts, "loans.fx_share", 2020), "10"); }, /calculated/],
  ["a changed 2025 anchor", (facts: MoneyBanksFact[]) => { setValue(find(facts, "money.m3", 2025), "57680.3"); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateMoneyBanksFacts(facts)).toThrow(error);
});

test("negative return on assets and equity are allowed", async () => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  expect(Math.min(...facts.filter(f => f.indicatorId === "banks.roe").map(f => Number(f.value)))).toBeLessThan(0);
  expect(() => validateMoneyBanksFacts(facts)).not.toThrow();
});
