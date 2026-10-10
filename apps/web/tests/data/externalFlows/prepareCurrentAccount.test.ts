import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { afterAll, expect, test } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { cleanupMoneyTransfersFixtures, createCurrentAccountPackageFixture, EXTERNAL_RESEARCH } from "./fixtures";

const modulePath = "../../../lib/data/externalFlows/prepareCurrentAccount";
const prepare = async () => (await import(modulePath)).prepareCurrentAccountData as (root: string, mode: "write" | "check") => Promise<void>;
afterAll(cleanupMoneyTransfersFixtures);

async function mutateBopCsv(directory: string, mutate: (rows: Record<string, string>[]) => void) {
  const file = path.join(directory, EXTERNAL_RESEARCH, "bop-annual.csv"), rows = parse(await readFile(file), { columns: true, bom: true }) as Record<string, string>[];
  const headers = Object.keys(rows[0]); mutate(rows);
  await writeFile(file, serializeBomCsvRows([headers, ...rows.map(row => headers.map(header => row[header]))]));
}

test("accepts the five current-account lines, credit, debit and net, 2000–2025, with exact decimals", async () => {
  const run = await prepare(), directory = await createCurrentAccountPackageFixture();
  await run(directory, "write");
  const content = await readFile(path.join(directory, "data/imports/current-account-annual.csv"));
  expect(content.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const facts = parse(content, { columns: true, bom: true }) as Record<string, string>[];
  expect(facts).toHaveLength(390);
  expect(new Set(facts.map(f => f.series_id))).toEqual(new Set(["ca.balance", "ca.goods", "ca.services", "ca.primary_income", "ca.secondary_income"]));
  const fact = (id: string, flow: string, year: string) => facts.find(f => f.series_id === id && f.flow === flow && f.year === year);
  expect(fact("ca.balance", "net", "2025")?.value_usd).toMatch(/^-1123241112\.31/);
  expect(fact("ca.goods", "net", "2025")?.value_usd).toMatch(/^-6814/);
  expect(fact("ca.goods", "credit", "2000")).toMatchObject({ value_usd: "478268156.80000004", source_unit: "million_usd", source_id: "source.nbg_balance_of_payments_bpm6", source_sheet: "BOP–BPM6(short)", source_cells: "F11", vintage: "2026-09-30" });
  const report = JSON.parse(await readFile(path.join(directory, "data/reports/current-account-validation.json"), "utf8"));
  expect(report).toMatchObject({ status: "passed", scope: "annual_current_account", observations: 390 });
  expect(report.years).toEqual(Array.from({ length: 26 }, (_, i) => 2000 + i));
  await run(directory, "check");
  await writeFile(path.join(directory, "data/imports/current-account-annual.csv"), content.toString("utf8").replace("478268156.80000004", "478268156.8"));
  await expect(run(directory, "check")).rejects.toThrow(/artifact|match|stale/i);
}, 60_000);

test.each([
  ["altered value", (r: Record<string, string>[]) => { r.find(x => x.item_id === "services")!.value_usd = "1"; }],
  ["missing year", (r: Record<string, string>[]) => { for (let i = r.length - 1; i >= 0; i--) if (r[i].year === "2003") r.splice(i, 1); }],
] as const)("rejects an %s in the research BoP rows", async (_name, mutate) => {
  const run = await prepare(), directory = await createCurrentAccountPackageFixture();
  await mutateBopCsv(directory, mutate);
  await expect(run(directory, "write")).rejects.toThrow(/hash|mismatch|artifact/i);
}, 30_000);

test("rejects failing independent evidence", async () => {
  const run = await prepare(), directory = await createCurrentAccountPackageFixture(), evidence = path.join(directory, EXTERNAL_RESEARCH, "independent-verification.json");
  await writeFile(evidence, JSON.stringify({ ...JSON.parse(await readFile(evidence, "utf8")), result: "fail" }));
  await expect(run(directory, "write")).rejects.toThrow(/independent/i);
}, 30_000);
