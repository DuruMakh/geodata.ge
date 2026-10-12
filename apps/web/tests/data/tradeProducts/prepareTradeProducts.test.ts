import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { afterAll, expect, test } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { cleanupTradeProductsFixtures, createTradeProductsPackageFixture, readTradeProductsReport, TRADE_RESEARCH } from "./fixtures";

const modulePath = "../../../lib/data/tradeProducts/prepareTradeProducts";
const prepare = async () => (await import(modulePath)).prepareTradeProductsData as (root: string, mode: "write" | "check") => Promise<void>;
afterAll(cleanupTradeProductsFixtures);

test("accepts every separate HS4 source identity without rounding or accepting services", async () => {
  const run = await prepare(), directory = await createTradeProductsPackageFixture();
  const researchBefore = await readFile(path.join(directory, TRADE_RESEARCH, "prepared-validation.json"));
  await run(directory, "write");
  const bytes = await readFile(path.join(directory, "data/imports/trade-products-annual.csv"));
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const facts = parse(bytes, { columns: true, bom: true }) as Record<string, string>[];
  expect(facts).toHaveLength(69624);
  expect(await readTradeProductsReport(directory)).toMatchObject({ status: "passed", scope: "annual_goods_products", productEntities: 4768, primaryObservations: 69624, controlObservations: 62, primaryValueStatusCounts: { numeric: 66627, blank: 0, not_applicable: 2997 }, outsideScopeHoldCount: 2 });
  expect(new Set(facts.map(fact => fact.entity_id)).size).toBe(4768);
  expect(facts.filter(fact => fact.entity_id === "goods.total")).toEqual([]);
  expect(facts.find(fact => fact.entity_id === "goods.hs4.2000-2014.6703" && fact.year === "2010" && fact.indicator_id === "trade.exports")?.value_usd).toBe("0.0056028686687583999");
  expect(facts.find(fact => fact.value_status === "not_applicable")?.value_usd).toBe("");
  expect(await readFile(path.join(directory, TRADE_RESEARCH, "prepared-validation.json"))).toEqual(researchBefore);
  await run(directory, "check");
  await writeFile(path.join(directory, "data/imports/trade-products-annual.csv"), bytes.toString("utf8").replace("0.0056028686687583999", "0.0056028686687583998"));
  await expect(run(directory, "check")).rejects.toThrow(/artifact|stale|match/i);
}, 120_000);

test.each([
  ["rounded amount", (rows: Record<string, string>[]) => { rows[2].value_usd = "1"; }],
  ["missing historical identity", (rows: Record<string, string>[]) => { const id = rows[2].item_id; rows.splice(0, rows.length, ...rows.filter(row => row.item_id !== id)); }],
  ["duplicate observation", (rows: Record<string, string>[]) => { rows.push({ ...rows[2] }); }],
  ["wrong source cell", (rows: Record<string, string>[]) => { rows[2].source_cell = "C5"; }],
  ["wrong unit", (rows: Record<string, string>[]) => { rows[2].source_unit = "million_usd"; }],
  ["invented zero", (rows: Record<string, string>[]) => { const row = rows.find(row => row.value_status === "not_applicable")!; row.value_status = "numeric"; row.value_usd = "0"; row.source_value = "0"; }],
] as const)("rejects %s in the frozen historical input", async (_name, mutate) => {
  const run = await prepare(), directory = await createTradeProductsPackageFixture();
  const filename = path.join(directory, TRADE_RESEARCH, "goods-products-annual/hs4-1995-1999.csv");
  const rows = parse(await readFile(filename), { columns: true, bom: true }) as Record<string, string>[];
  const headers = Object.keys(rows[0]); mutate(rows);
  await writeFile(filename, serializeBomCsvRows([headers, ...rows.map(row => headers.map(header => row[header]))]));
  await expect(run(directory, "write")).rejects.toThrow(/source|coverage|identity|duplicate|unit|value|status/i);
}, 60_000);

test("rejects a changed original workbook and an unresolved HS4 source hold", async () => {
  const run = await prepare(), directory = await createTradeProductsPackageFixture();
  await writeFile(path.join(directory, TRADE_RESEARCH, "official/Export-Product-by-4-digit-2000-2014.xlsx"), "changed");
  await expect(run(directory, "write")).rejects.toThrow(/hash|source|capture/i);
  const held = await createTradeProductsPackageFixture(), file = path.join(held, TRADE_RESEARCH, "unresolved-source-issues.json");
  const report = JSON.parse(await readFile(file, "utf8")); report.issues.push({ family: "goods_products", classification: "hs4", year: "2025" });
  await writeFile(file, JSON.stringify(report));
  await expect(run(held, "write")).rejects.toThrow(/source acceptance hold/i);
}, 60_000);
