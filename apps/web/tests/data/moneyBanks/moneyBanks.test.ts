import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test, vi } from "vitest";
import { loadMoneyBanksFactsFromMirror, moneyBanksMirrorCreateRows } from "../../../lib/db/mirrorRows";
import { assertMoneyBanksParity, loadMoneyBanksFacts, toClientMoneyBanksFact } from "../../../lib/data/moneyBanks/importMoneyBanks";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { MONEY_BANKS_CSV_HEADERS, prepareMoneyBanksData, REVIEWED_AT } from "../../../lib/data/moneyBanks/prepareMoneyBanks";
import { MONEY_BANKS_INDICATORS, MONEY_BANKS_PUBLIC_SOURCES, MONEY_BANKS_SOURCES, moneyBanksSourceDocumentId, type MoneyBanksFact } from "../../../lib/data/moneyBanks/types";
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

test("published values round from the value as Excel displays it, as NBG prints them", async () => {
  const facts = await loadFacts();
  expect(find(facts, "rates.deposits_gel", 2013)).toMatchObject({ value: "8.4499999999999993", publishedValue: "8.5" });
  expect(find(facts, "rates.deposits_fx", 2003)).toMatchObject({ value: "8.9499999999999993", publishedValue: "9.0" });
  validateMoneyBanksFacts(facts);
  // 8.4499999999999993 is shown as 8.45 to 15 significant digits, so 8.4 (rounding the full double) is rejected.
  find(facts, "rates.deposits_gel", 2013).publishedValue = "8.4";
  expect(() => validateMoneyBanksFacts(facts)).toThrow(/published value/);
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

test("loading serves the same 730 values as the canonical file", async () => {
  const facts = await loadMoneyBanksFacts();
  expect(facts).toEqual(await loadFacts());
});

test("loading refuses a canonical file whose fingerprint differs from the report", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "money-banks-"));
  try {
    await fs.mkdir(path.join(dir, "apps/web"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/imports"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/reports"), { recursive: true });
    const csv = await fs.readFile(path.join(root, "data/imports/money-banks-annual.csv"), "utf8");
    await fs.writeFile(path.join(dir, "data/imports/money-banks-annual.csv"), csv.replace("57680.2", "57680.3"));
    await fs.copyFile(path.join(root, "data/reports/money-banks-validation.json"), path.join(dir, "data/reports/money-banks-validation.json"));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(path.join(dir, "apps/web"));
    try {
      await expect(loadMoneyBanksFacts()).rejects.toThrow(/fingerprint/);
    } finally {
      cwd.mockRestore();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
  const facts = await loadFacts();
  const m3 = facts.findIndex(f => f.indicatorId === "money.m3" && f.year === 2025);
  const policy = facts.findIndex(f => f.indicatorId === "rates.policy" && f.year === 2025);
  expect(facts[policy].value).toMatch(/^8(\.0+)?$/);
  expect(() => assertMoneyBanksParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
  const rewritten = facts.map(f => ({ ...f }));
  rewritten[policy].value = "8";
  rewritten[policy].publishedValue = "8.00";
  const padded = rewritten.map(f => ({ ...f }));
  padded[policy].value = "8.00";
  expect(() => assertMoneyBanksParity(rewritten, padded)).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  changed[m3].value = new Decimal(changed[m3].value).plus("0.000001").toFixed();
  expect(() => assertMoneyBanksParity(facts, changed)).toThrow();
  expect(() => assertMoneyBanksParity(facts, facts.slice(1))).toThrow();
});

test("client facts carry numeric values in lari or percent with their display precision", async () => {
  const facts = await loadFacts();
  expect(toClientMoneyBanksFact(find(facts, "money.m3", 2025))).toMatchObject({ value: 57680200000, unit: "gel", decimals: 1, indicatorId: "money.m3", year: 2025, valueStatus: "official" });
  expect(toClientMoneyBanksFact(find(facts, "rates.policy", 2025))).toMatchObject({ value: 8, unit: "percent", decimals: 2 });
  expect(toClientMoneyBanksFact(find(facts, "banks.roe", 2025))).toMatchObject({ unit: "percent", decimals: 1 });
  expect(toClientMoneyBanksFact(find(facts, "deposits.fx_share", 2025))).toMatchObject({ value: 48.6, valueStatus: "calculated" });
});

test("the database mirror round-trips exact decimals and source relations", async () => {
  const facts = await loadFacts();
  const rows = moneyBanksMirrorCreateRows(facts, "money-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ moneyBanksFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "moneyBanksFact">;
  const mirror = await loadMoneyBanksFactsFromMirror(db(rows));
  expect(() => assertMoneyBanksParity(facts, mirror)).not.toThrow();
  expect(rows[0].importRunId).toBe("money-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadMoneyBanksFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

test("every archived source has a source-document row", async () => {
  const csv = await fs.readFile(path.join(root, "data/sources/source-documents.csv"));
  const ids = new Set((parse(csv, { columns: true, bom: true }) as Record<string, string>[]).map(r => r.source_id));
  expect(MONEY_BANKS_PUBLIC_SOURCES.filter(id => !ids.has(moneyBanksSourceDocumentId(id)))).toEqual([]);
});
