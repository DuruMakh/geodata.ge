import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { afterAll, expect, test } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { cleanupTradePartnersFixtures, createTradePartnersPackageFixture, readTradePartnersReport, TRADE_RESEARCH } from "./fixtures";

const modulePath = "../../../lib/data/tradePartners/prepareTradePartners";
const prepare = async () => (await import(modulePath)).prepareTradePartnersData as (root: string, mode: "write" | "check") => Promise<void>;
afterAll(cleanupTradePartnersFixtures);

async function mutateCsv(directory: string, name: string, mutate: (rows: Record<string, string>[]) => void) {
  const file = path.join(directory, TRADE_RESEARCH, name), rows = parse(await readFile(file), { columns: true, bom: true }) as Record<string, string>[];
  const headers = Object.keys(rows[0]); mutate(rows);
  await writeFile(file, serializeBomCsvRows([headers, ...rows.map(row => headers.map(header => row[header]))]));
}

test("accepts every captured partner observation, exact decimals and missing status without accepting services", async () => {
  const run = await prepare(), directory = await createTradePartnersPackageFixture();
  const oldResearch = await readFile(path.join(directory, TRADE_RESEARCH, "prepared-validation.json"));
  await run(directory, "write");
  const content = await readFile(path.join(directory, "data/imports/trade-partners-annual.csv"));
  expect(content.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const facts = parse(content, { columns: true, bom: true }) as Record<string, string>[];
  expect(facts).toHaveLength(22992);
  expect(await readTradePartnersReport(directory)).toMatchObject({ status: "passed", scope: "annual_goods_partners", countryEntities: 212, groupEntities: 5, primaryObservations: 12462, derivedObservations: 10530, primaryValueStatusCounts: { numeric: 11782, blank: 25, not_applicable: 655 }, researchPackageStatus: "requires_source_resolution", outsideScopeHoldCount: 2 });
  const value = (id: string, measure: string) => facts.find(f => f.entity_id === id && f.year === "2025" && f.indicator_id === measure)?.value_usd;
  expect(value("partner.1995-2025.643", "trade.exports")).toBe("749443386.58028818");
  expect(value("partner.1995-2025.643", "trade.turnover")).toBe("2690188844.24309948");
  expect(value("partner.1995-2025.643", "trade.balance")).toBe("-1191302071.08252312");
  expect(value("partner.1995-2025.891", "trade.exports")).toBe("0");
  expect(value("partner.1995-2025.530", "trade.imports")).toBe("0");
  expect(value("partner.1995-2025.530", "trade.turnover")).toBeUndefined();
  expect(await readFile(path.join(directory, TRADE_RESEARCH, "prepared-validation.json"))).toEqual(oldResearch);
  await run(directory, "check");
  await writeFile(path.join(directory, "data/imports/trade-partners-annual.csv"), content.toString("utf8").replace("749443386.58028818", "749443386.58028819"));
  await expect(run(directory, "check")).rejects.toThrow(/artifact|match|stale/i);
}, 90_000);

test.each([
  ["stored value", (r: Record<string, string>[]) => { r[4].source_value = "1"; r[4].value_usd = "1000"; }],
  ["source cell", (r: Record<string, string>[]) => { r[4].source_cell = "C5"; }],
  ["source unit", (r: Record<string, string>[]) => { r[4].source_unit = "million_usd"; }],
  ["source format", (r: Record<string, string>[]) => { r[4].source_number_format = "0"; }],
  ["source role", (r: Record<string, string>[]) => { const x = r.find(x => x.role === "detail")!; x.role = "subtotal"; }],
  ["missing identity", (r: Record<string, string>[]) => { const id = r.find(x => x.role === "detail")!.item_id; for (let i = r.length - 1; i >= 0; i--) if (r[i].item_id === id) r.splice(i, 1); }],
  ["missing year", (r: Record<string, string>[]) => { for (let i = r.length - 1; i >= 0; i--) if (r[i].year === "2000") r.splice(i, 1); }],
  ["duplicate", (r: Record<string, string>[]) => { r.push({ ...r.find(x => x.role === "detail")! }); }],
  ["invented zero", (r: Record<string, string>[]) => { const x = r.find(x => x.value_status === "not_applicable")!; x.value_status = "numeric"; x.value_usd = "0"; x.source_value = "0"; }],
] as const)("rejects an altered %s instead of publishing a coherent but false CSV", async (_name, mutate) => {
  const run = await prepare(), directory = await createTradePartnersPackageFixture();
  await mutateCsv(directory, "goods-countries-annual.csv", mutate);
  await expect(run(directory, "write")).rejects.toThrow(/source|coverage|identity|duplicate|role|unit|format|status/i);
}, 30_000);

test("rejects source corruption and catalogue code reassignment", async () => {
  const run = await prepare(), directory = await createTradePartnersPackageFixture();
  await writeFile(path.join(directory, TRADE_RESEARCH, "official/Export-Country_1995-2026.xlsx"), "altered workbook");
  await expect(run(directory, "write")).rejects.toThrow(/source|capture|hash|mismatch/i);
  const other = await createTradePartnersPackageFixture(), catalogueFile = path.join(other, "data/taxonomy/trade-partners.json");
  const catalogue = JSON.parse(await readFile(catalogueFile, "utf8"));
  catalogue.find((e: { sourceCode: string }) => e.sourceCode === "031").sourceCode = "31";
  await writeFile(catalogueFile, JSON.stringify(catalogue));
  await expect(run(other, "write")).rejects.toThrow(/identity|catalogue|code/i);
}, 30_000);
