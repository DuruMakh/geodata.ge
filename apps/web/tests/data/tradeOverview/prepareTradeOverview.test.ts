import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { afterAll, expect, test } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { prepareTradeOverviewData } from "../../../lib/data/tradeOverview/prepareTradeOverview";

const root = path.resolve(process.cwd(), "../..");
const research = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
const scratch = path.join(root, ".superpowers/sdd/2026-10-08-trade-overview");
const fixtures: string[] = [];
const sourceFiles = ["full-source-manifest.json", "coverage.csv", "source-layouts.json", "goods-national-annual.csv", "derived-annual.csv", "prepared-validation.json", "unresolved-source-issues.json", "official/FTrade_1995-2026.xlsx"];
afterAll(async () => {
  for (const directory of fixtures) {
    if (!path.resolve(directory).startsWith(`${scratch}${path.sep}`)) throw new Error("Fixture cleanup outside its workspace");
    await rm(directory, { recursive: true, force: true });
  }
});
async function fixture() {
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, "fixture-"));
  fixtures.push(directory);
  for (const name of sourceFiles) {
    const target = path.join(directory, research, name);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, research, name), target);
  }
  return directory;
}
async function mutateCsv(directory: string, filename: string, mutate: (rows: Record<string, string>[]) => void) {
  const file = path.join(directory, research, filename);
  const rows = parse(await readFile(file), { columns: true, bom: true }) as Record<string, string>[];
  const headers = Object.keys(rows[0]);
  mutate(rows);
  await writeFile(file, serializeBomCsvRows([headers, ...rows.map(row => headers.map(header => row[header]))]));
}
test("prepares all 124 source-matched observations without changing the wider research acceptance", async () => {
  const directory = await fixture();
  const before = await readFile(path.join(directory, research, "prepared-validation.json"));
  await expect(prepareTradeOverviewData(directory, "write")).resolves.toBeUndefined();
  const content = await readFile(path.join(directory, "data/imports/trade-overview-annual.csv"));
  expect(content.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const rows = parse(content, { columns: true, bom: true }) as Record<string, string>[];
  expect(rows).toHaveLength(124);
  expect([...new Set(rows.map(row => Number(row.year)))].sort((a, b) => a - b)).toEqual(Array.from({ length: 31 }, (_, i) => 1995 + i));
  const value = (id: string) => new Decimal(rows.find(row => row.year === "2025" && row.indicator_id === id)!.value_usd).toFixed();
  expect(value("trade.exports")).toBe("7287805027.5742908");
  expect(value("trade.imports")).toBe("18648513307.186789");
  expect(value("trade.turnover")).toBe("25936318334.7610798");
  expect(value("trade.balance")).toBe("-11360708279.6124982");
  expect(new Set(rows.map(row => row.publication_status))).toEqual(new Set(["unspecified"]));
  const report = JSON.parse(await readFile(path.join(directory, "data/reports/trade-overview-validation.json"), "utf8"));
  expect(report).toMatchObject({ status: "passed", scope: "national_goods_overview", primaryObservations: 62, derivedObservations: 62, researchPackageStatus: "requires_source_resolution", outsideScopeHoldCount: 2 });
  expect(await readFile(path.join(directory, research, "prepared-validation.json"))).toEqual(before);
  await expect(prepareTradeOverviewData(directory, "check")).resolves.toBeUndefined();
  await prepareTradeOverviewData(directory, "write");
  expect(await readFile(path.join(directory, "data/imports/trade-overview-annual.csv"))).toEqual(content);
  await writeFile(path.join(directory, "data/imports/trade-overview-annual.csv"), content.toString("utf8").replace("7287805027.5742908", "7287805028.5742908"));
  await expect(prepareTradeOverviewData(directory, "check")).rejects.toThrow(/artifact|match|stale/i);
});
test("refuses an altered stored amount even if a matching USD conversion is supplied", async () => {
  const directory = await fixture();
  await mutateCsv(directory, "goods-national-annual.csv", rows => { rows[0].source_value = "1"; rows[0].value_usd = "1000000"; });
  await expect(prepareTradeOverviewData(directory, "write")).rejects.toThrow(/source cell/i);
});
test("refuses a missing whole year from the captured primary file", async () => {
  const directory = await fixture();
  await mutateCsv(directory, "goods-national-annual.csv", rows => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].year === "2000") rows.splice(i, 1); });
  await expect(prepareTradeOverviewData(directory, "write")).rejects.toThrow(/coverage/i);
});
test("refuses a correct native value attached to a different flow or year cell", async () => {
  const directory = await fixture();
  await mutateCsv(directory, "goods-national-annual.csv", rows => { rows[0].source_cell = "B20"; });
  await expect(prepareTradeOverviewData(directory, "write")).rejects.toThrow(/source/i);
});
test("refuses reversed derived-input references or a duplicate scoped derivation", async () => {
  const directory = await fixture();
  await mutateCsv(directory, "derived-annual.csv", rows => {
    const row = rows.find(row => row.dimension === "national" && row.indicator_id === "trade_balance")!;
    row.input_source_refs = JSON.stringify(JSON.parse(row.input_source_refs).reverse());
  });
  await expect(prepareTradeOverviewData(directory, "write")).rejects.toThrow(/source/i);
  const duplicateDirectory = await fixture();
  await mutateCsv(duplicateDirectory, "derived-annual.csv", rows => { rows.push({ ...rows.find(row => row.dimension === "national" && row.indicator_id === "trade_balance")! }); });
  await expect(prepareTradeOverviewData(duplicateDirectory, "write")).rejects.toThrow(/duplicate|coverage/i);
});
test("refuses corrupt source bytes and an added unsupported annual observation", async () => {
  const directory = await fixture();
  await writeFile(path.join(directory, research, "official/FTrade_1995-2026.xlsx"), "altered workbook");
  await expect(prepareTradeOverviewData(directory, "write")).rejects.toThrow(/source.*mismatch/i);
  const extraDirectory = await fixture();
  await mutateCsv(extraDirectory, "goods-national-annual.csv", rows => { rows.push({ ...rows[0], year: "2026", source_cell: "AG5" }); });
  await expect(prepareTradeOverviewData(extraDirectory, "write")).rejects.toThrow(/coverage/i);
});
test("refuses a source acceptance hold that affects the national goods subset", async () => {
  const directory = await fixture();
  const file = path.join(directory, research, "prepared-validation.json");
  const report = JSON.parse(await readFile(file, "utf8"));
  report.unresolved_source_issues.push({ family: "goods_national", flow: "export", year: "2025", status: "fail" });
  await writeFile(file, JSON.stringify(report));
  await expect(prepareTradeOverviewData(directory, "write")).rejects.toThrow(/hold|resolution/i);
});
