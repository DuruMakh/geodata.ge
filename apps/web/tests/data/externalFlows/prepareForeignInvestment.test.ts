import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { afterAll, expect, test } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { cleanupMoneyTransfersFixtures, createForeignInvestmentPackageFixture, EXTERNAL_RESEARCH, readForeignInvestmentReport } from "./fixtures";

const modulePath = "../../../lib/data/externalFlows/prepareForeignInvestment";
const prepare = async () => (await import(modulePath)).prepareForeignInvestmentData as (root: string, mode: "write" | "check") => Promise<void>;
afterAll(cleanupMoneyTransfersFixtures);
const years = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, i) => first + i);

async function mutateFdiCsv(directory: string, mutate: (rows: Record<string, string>[]) => void) {
  const file = path.join(directory, EXTERNAL_RESEARCH, "fdi-flows-annual.csv"), rows = parse(await readFile(file), { columns: true, bom: true }) as Record<string, string>[];
  const headers = Object.keys(rows[0]); mutate(rows);
  await writeFile(file, serializeBomCsvRows([headers, ...rows.map(row => headers.map(header => row[header]))]));
}

test("accepts Geostat's annual total, country, sector and region inflows with exact decimals and statuses", async () => {
  const run = await prepare(), directory = await createForeignInvestmentPackageFixture();
  await run(directory, "write");
  const content = await readFile(path.join(directory, "data/imports/foreign-investment-annual.csv"));
  expect(content.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const facts = parse(content, { columns: true, bom: true }) as Record<string, string>[];
  const report = await readForeignInvestmentReport(directory);
  expect(report).toMatchObject({
    status: "passed", scope: "annual_foreign_direct_investment",
    years: { total: years(1996, 2025), country: years(1996, 2025), sector: years(2016, 2025), region: years(2009, 2025) },
    entities: { country: 77, sector: 18, region: 11 },
  });
  expect(facts).toHaveLength(30 + 77 * 30 + 18 * 10 + 11 * 17);
  expect(report.valueStatusCounts.not_applicable).toBe(facts.filter(f => f.value_status === "not_applicable").length);
  const fact = (id: string, year: string) => facts.find(f => f.entity_id === id && f.year === year);
  expect(fact("fdi.total", "2025")).toMatchObject({ source_unit: "million_usd", source_id: "source.geostat_fdi_by_quarters" });
  expect(fact("fdi.total", "2025")?.value_usd).toMatch(/^1900386201\.0000003/);
  expect(fact("fdi.country.m49_826", "2025")?.value_usd).toMatch(/^426631499\.7999/);
  expect(fact("fdi.region.imereti", "2025")?.value_usd).toMatch(/^-642/);
  expect(fact("fdi.region.guria", "2015")).toMatchObject({ value_status: "not_applicable", value_usd: "" });
  expect(fact("fdi.region.guria", "2016")?.value_status).toBe("numeric");
  expect(fact("fdi.sector.k", "2015")).toBeUndefined();
  expect(facts.some(f => f.entity_id.startsWith("fdi.country.group"))).toBe(false);
  expect(facts.filter(f => f.value_status === "not_applicable").every(f => f.value_usd === "")).toBe(true);
  await run(directory, "check");
  await writeFile(path.join(directory, "data/imports/foreign-investment-annual.csv"), content.toString("utf8").replace(",numeric,", ",not_applicable,"));
  await expect(run(directory, "check")).rejects.toThrow(/artifact|match|stale/i);
}, 90_000);

test.each([
  ["altered value", (r: Record<string, string>[]) => { r.find(x => x.dimension === "country")!.value_usd = "1"; }],
  ["missing year", (r: Record<string, string>[]) => { for (let i = r.length - 1; i >= 0; i--) if (r[i].year === "2003") r.splice(i, 1); }],
  ["duplicate", (r: Record<string, string>[]) => { r.push({ ...r.find(x => x.dimension === "region")! }); }],
  ["invented zero", (r: Record<string, string>[]) => { const x = r.find(x => x.value_status === "not_applicable")!; x.value_status = "numeric"; x.value_usd = "0"; }],
] as const)("rejects an %s in the research FDI rows", async (_name, mutate) => {
  const run = await prepare(), directory = await createForeignInvestmentPackageFixture();
  await mutateFdiCsv(directory, mutate);
  await expect(run(directory, "write")).rejects.toThrow(/hash|mismatch|artifact/i);
}, 30_000);

test("rejects failing independent evidence, an unreviewed identity and a missing English label", async () => {
  const run = await prepare();
  const a = await createForeignInvestmentPackageFixture(), evidence = path.join(a, EXTERNAL_RESEARCH, "independent-verification.json");
  await writeFile(evidence, JSON.stringify({ ...JSON.parse(await readFile(evidence, "utf8")), result: "fail" }));
  await expect(run(a, "write")).rejects.toThrow(/independent/i);
  const b = await createForeignInvestmentPackageFixture(), catalogue = path.join(b, "data/taxonomy/foreign-investment.json");
  await writeFile(catalogue, JSON.stringify(JSON.parse(await readFile(catalogue, "utf8")).filter((e: { id: string }) => e.id !== "fdi.country.m49_380")));
  await expect(run(b, "write")).rejects.toThrow(/catalogue|identity/i);
  const c = await createForeignInvestmentPackageFixture(), labels = path.join(c, "data/localization/en/labels.json"), parsed = JSON.parse(await readFile(labels, "utf8"));
  delete parsed["fdi.country.m49_380"]; await writeFile(labels, JSON.stringify(parsed));
  await expect(run(c, "write")).rejects.toThrow(/English/i);
}, 60_000);
