import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { afterAll, expect, test } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { cleanupMoneyTransfersFixtures, createMoneyTransfersPackageFixture, EXTERNAL_RESEARCH, readMoneyTransfersReport } from "./fixtures";

const modulePath = "../../../lib/data/externalFlows/prepareMoneyTransfers";
const prepare = async () => (await import(modulePath)).prepareMoneyTransfersData as (root: string, mode: "write" | "check") => Promise<void>;
afterAll(cleanupMoneyTransfersFixtures);

async function mutateResearchCsv(directory: string, name: string, mutate: (rows: Record<string, string>[]) => void) {
  const file = path.join(directory, EXTERNAL_RESEARCH, name), rows = parse(await readFile(file), { columns: true, bom: true }) as Record<string, string>[];
  const headers = Object.keys(rows[0]); mutate(rows);
  await writeFile(file, serializeBomCsvRows([headers, ...rows.map(row => headers.map(header => row[header]))]));
}

test("accepts every annual transfer and personal-transfer observation with exact decimals and statuses", async () => {
  const run = await prepare(), directory = await createMoneyTransfersPackageFixture();
  await run(directory, "write");
  const content = await readFile(path.join(directory, "data/imports/money-transfers-annual.csv"));
  expect(content.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const facts = parse(content, { columns: true, bom: true }) as Record<string, string>[];
  expect(facts).toHaveLength(9312 + 52);
  expect(await readMoneyTransfersReport(directory)).toMatchObject({
    status: "passed", scope: "annual_money_transfers", years: Array.from({ length: 26 }, (_, i) => 2000 + i),
    countryEntities: 249, remainderEntities: 3, transferObservations: 9312, estimateObservations: 52,
    valueStatusCounts: { numeric: 9158 + 52, blank: 14, partial_months: 140 },
  });
  const fact = (id: string, year: string, measure: string) => facts.find(f => f.entity_id === id && f.year === year && f.measure === measure);
  expect(fact("transfer.total", "2024", "received")?.value_usd).toMatch(/^33615\d\d\d\d\d/);
  expect(fact("bop.personal_transfers", "2025", "received")).toMatchObject({ source_unit: "million_usd", months_reported: "" });
  expect(fact("transfer.sudan", "2019", "received")).toMatchObject({ value_status: "partial_months", months_reported: "11" });
  expect(fact("transfer.afghanistan", "2007", "received")).toBeUndefined();
  expect(fact("transfer.other_countries", "2008", "received")).toBeUndefined();
  expect(facts.filter(f => f.value_status === "blank").every(f => f.value_usd === "")).toBe(true);
  await run(directory, "check");
  await writeFile(path.join(directory, "data/imports/money-transfers-annual.csv"), content.toString("utf8").replace(/,received,(\d)/, ",received,9$1"));
  await expect(run(directory, "check")).rejects.toThrow(/artifact|match|stale/i);
}, 90_000);

test.each([
  ["altered value", (r: Record<string, string>[]) => { r[0].value_usd = "1"; }],
  ["missing year", (r: Record<string, string>[]) => { for (let i = r.length - 1; i >= 0; i--) if (r[i].year === "2003") r.splice(i, 1); }],
  ["duplicate", (r: Record<string, string>[]) => { r.push({ ...r[0] }); }],
  ["invented zero", (r: Record<string, string>[]) => { const x = r.find(x => x.value_status === "blank")!; x.value_status = "numeric"; x.value_usd = "0"; }],
  ["partial month without its count", (r: Record<string, string>[]) => { r.find(x => x.value_status === "partial_months")!.months_reported = "12"; }],
] as const)("rejects an %s in the research transfers", async (_name, mutate) => {
  const run = await prepare(), directory = await createMoneyTransfersPackageFixture();
  await mutateResearchCsv(directory, "money-transfers-annual.csv", mutate);
  await expect(run(directory, "write")).rejects.toThrow(/hash|mismatch|artifact/i);
}, 30_000);

test("rejects failing independent evidence, an unreviewed identity and a missing English label", async () => {
  const run = await prepare();
  const a = await createMoneyTransfersPackageFixture(), evidence = path.join(a, EXTERNAL_RESEARCH, "independent-verification.json");
  await writeFile(evidence, JSON.stringify({ ...JSON.parse(await readFile(evidence, "utf8")), result: "fail" }));
  await expect(run(a, "write")).rejects.toThrow(/independent/i);
  const b = await createMoneyTransfersPackageFixture(), catalogue = path.join(b, "data/taxonomy/money-transfer-countries.json");
  await writeFile(catalogue, JSON.stringify(JSON.parse(await readFile(catalogue, "utf8")).filter((e: { id: string }) => e.id !== "transfer.italy")));
  await expect(run(b, "write")).rejects.toThrow(/catalogue|identity/i);
  const c = await createMoneyTransfersPackageFixture(), labels = path.join(c, "data/localization/en/labels.json"), parsed = JSON.parse(await readFile(labels, "utf8"));
  delete parsed["transfer.italy"]; await writeFile(labels, JSON.stringify(parsed));
  await expect(run(c, "write")).rejects.toThrow(/English/i);
}, 60_000);
