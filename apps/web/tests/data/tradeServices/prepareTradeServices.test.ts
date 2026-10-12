import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { buildTradeServicesData, prepareTradeServicesData, tradeServicesCsv } from "../../../lib/data/tradeServices/prepareTradeServices";

const root = path.resolve(process.cwd(), "../.."), research = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
type Row = Record<string, string>;
describe("accepted annual services types", () => {
  let result: Awaited<ReturnType<typeof buildTradeServicesData>>;
  const fixtures: string[] = [];
  beforeAll(async () => { result = await buildTradeServicesData(root); }, 60_000);
  afterAll(async () => { for (const fixture of fixtures) if (fixture.startsWith(path.join(root, ".tmp") + path.sep)) await fs.rm(fixture, { recursive: true, force: true }); });
  async function fixture() {
    await fs.mkdir(path.join(root, ".tmp"), { recursive: true });
    const directory = await fs.mkdtemp(path.join(root, ".tmp/services-fixture-")); fixtures.push(directory);
    const sources = JSON.parse(await fs.readFile(path.join(root, research, "full-source-manifest.json"), "utf8")) as { source_id: string; local_file: string }[];
    const names = [...Object.keys(result.report.inputSha256), "data/taxonomy/trade-services.json", "data/localization/en/labels.json", ...sources.filter(source => source.source_id in result.report.sourceSha256).map(source => `${research}/${source.local_file}`)];
    for (const name of names) { await fs.mkdir(path.dirname(path.join(directory, name)), { recursive: true }); await fs.copyFile(path.join(root, name), path.join(directory, name)); }
    return directory;
  }
  async function refresh(directory: string, name: string) {
    const filename = path.join(directory, research, "independent-verification.json"), independent = JSON.parse(await fs.readFile(filename, "utf8"));
    independent.input_artifact_sha256[name] = hash(await fs.readFile(path.join(directory, research, name)));
    await fs.writeFile(filename, JSON.stringify(independent));
  }
  async function mutateRows(directory: string, change: (rows: Row[]) => void) {
    const filename = path.join(directory, research, "services-annual.csv");
    const rows = parse(await fs.readFile(filename), { columns: true, bom: true }) as Row[];
    change(rows); const fields = Object.keys(rows[0]);
    await fs.writeFile(filename, serializeBomCsvRows([fields, ...rows.map(row => fields.map(field => row[field]))]));
    await refresh(directory, "services-annual.csv");
  }
  it("preserves the independently reviewed counts, precise national amount and published dash", () => {
    expect(result.data.entities).toHaveLength(13);
    expect(result.data.facts).toHaveLength(258);
    expect(result.report.primaryObservations).toBe(130);
    expect(result.report.derivedObservations).toBe(128);
    expect(result.report.outsideScopeHoldCount).toBe(2);
    const totalExports2024 = result.data.facts.find(f => f.entityId === "services.total" && f.year === 2024 && f.indicatorId === "trade.exports")!;
    expect(totalExports2024.valueUsd).toBe("7706284984.7599976");
    const repair = result.data.facts.filter(f => f.entityId === "services.maintenance_repair" && f.year === 2020);
    expect(repair.find(f => f.indicatorId === "trade.exports")).toMatchObject({ valueUsd: null, sourceValue: "-", valueStatus: "not_applicable" });
    expect(repair.filter(f => f.role === "derived")).toHaveLength(0);
    expect(result.data.facts.filter(f => f.entityId === "services.total")).toHaveLength(20);
    expect(result.data.facts.filter(f => f.entityId !== "services.total")).toHaveLength(238);
    expect(result.report.years).toEqual([2020, 2021, 2022, 2023, 2024]);
    expect(Object.keys(result.report.sourceSha256).sort()).toEqual(["geostat_services_georgian-exports-of-services-by-types", "geostat_services_georgian-imports-of-services-by-types"]);
    expect(result.data.entities.every(e => ["national", "service_type"].includes(e.kind) && e.id.startsWith("services."))).toBe(true);
    expect(result.report.researchPackageStatus).toBe("requires_source_resolution");
    expect(result.report.outsideScopeHolds.map(h => [h.year, h.status, h.item_id])).toEqual([["2022", "fail", "partner.2020-2024.826"], ["2024", "fail", "partner.2020-2024.826"]]);
  });
  it("reproduces the ten independently calculated numeric type sums", () => {
    const sums = ["1581909003.41000031132", "2550384057.07000188342", "5705111931.7386012421", "7061808375.2399975591", "7706284984.7600001411", "1455905286.6499996264", "1822270146.0600014751", "3028876282.600000906", "3618913901.1500015797", "3814814493.90999816404"];
    const D = Decimal.clone({ precision: 50 });
    for (const [flowIndex, indicatorId] of ["trade.exports", "trade.imports"].entries()) for (const [yearIndex, year] of result.report.years.entries()) {
      const sum = result.data.facts.filter(f => f.entityId !== "services.total" && f.year === year && f.indicatorId === indicatorId && f.valueUsd !== null).reduce((sum, f) => sum.plus(f.valueUsd!), new D(0));
      expect(sum.toFixed()).toBe(sums[flowIndex * 5 + yearIndex]);
    }
  });
  it("uses the same identity/year with ordered exact export/import references for all derivations", () => {
    const D = Decimal.clone({ precision: 50 });
    for (const f of result.data.facts.filter(f => f.role === "derived")) {
      const inputs = ["trade.exports", "trade.imports"].map(id => result.data.facts.find(input => input.entityId === f.entityId && input.year === f.year && input.indicatorId === id)!);
      expect(f.sourceRefs).toBe(JSON.stringify(inputs.flatMap(input => JSON.parse(input.sourceRefs))));
      expect(f.valueUsd).toBe((f.indicatorId === "trade.balance" ? new D(inputs[0].valueUsd!).minus(inputs[1].valueUsd!) : new D(inputs[0].valueUsd!).plus(inputs[1].valueUsd!)).toFixed());
    }
  });
  it.each(["omitted", "duplicate", "extra", "identity", "year", "source", "cell", "role", "unit", "label", "format", "rounded", "dash as zero"])("rejects %s native observations after refreshing the input fingerprint", async mutation => {
    const directory = await fixture();
    await mutateRows(directory, rows => {
      const index = rows.findIndex(row => row.dimension === "type" && row.item_id === "services.total" && row.year === "2024" && row.flow === "export"), row = rows[index];
      if (mutation === "omitted") rows.splice(index, 1);
      else if (mutation === "duplicate") rows.push({ ...row });
      else if (mutation === "extra") rows.push({ ...row, item_id: "services.invented" });
      else if (mutation === "identity") row.item_id = "services.travel";
      else if (mutation === "year") row.year = "2019";
      else if (mutation === "source") row.source_id = "geostat_services_georgian-imports-of-services-by-types";
      else if (mutation === "cell") row.source_cell = "F10";
      else if (mutation === "role") row.role = "detail";
      else if (mutation === "unit") row.source_unit = "usd";
      else if (mutation === "label") row.source_label = "Wrong total";
      else if (mutation === "format") row.source_number_format = "General";
      else if (mutation === "rounded") { row.value_usd = "7706284984.76"; row.source_value = "7706284.98476"; }
      else { const dash = rows.find(r => r.dimension === "type" && r.value_status === "not_applicable")!; dash.source_value = "0"; dash.value_usd = "0"; dash.value_status = "numeric"; }
    });
    await expect(buildTradeServicesData(directory)).rejects.toThrow(/coverage|inventory|source|cell|metadata|conversion/i);
  }, 60_000);
  it.each(["original", "inventory", "stale input", "affected hold"])("rejects changed %s", async mutation => {
    const directory = await fixture();
    if (mutation === "original") await fs.appendFile(path.join(directory, research, "official/Georgian-Exports-of-services-by-types.xlsx"), "changed");
    else if (mutation === "inventory") await fs.appendFile(path.join(directory, research, "expected-observation-inventory.json"), " ");
    else if (mutation === "stale input") await fs.appendFile(path.join(directory, research, "services-annual.csv"), "\n");
    else {
      const filename = path.join(directory, research, "unresolved-source-issues.json"), issues = JSON.parse(await fs.readFile(filename, "utf8"));
      issues.issues.push({ family: "services", year: "2024", status: "fail", source_refs: '[["geostat_services_georgian-exports-of-services-by-types","Sheet1","F5"]]' });
      await fs.writeFile(filename, JSON.stringify(issues));
      const reportFile = path.join(directory, research, "prepared-validation.json"), report = JSON.parse(await fs.readFile(reportFile, "utf8"));
      report.input_sha256["unresolved-source-issues.json"] = hash(await fs.readFile(filename)); report.unresolved_source_issues = issues.issues;
      await fs.writeFile(reportFile, JSON.stringify(report)); await refresh(directory, "prepared-validation.json");
    }
    await expect(buildTradeServicesData(directory)).rejects.toThrow(/hash|fingerprint|hold|source|inventory/i);
  }, 60_000);
  it("writes BOM bytes and checks deterministic artifacts without accepting the wider package", async () => {
    const directory = await fixture();
    await prepareTradeServicesData(directory, "write");
    const filename = path.join(directory, "data/imports/trade-services-annual.csv"), bytes = await fs.readFile(filename);
    expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
    expect(bytes.toString()).toBe(tradeServicesCsv(result.data));
    await prepareTradeServicesData(directory, "check");
    await fs.appendFile(filename, "\n");
    await expect(prepareTradeServicesData(directory, "check")).rejects.toThrow(/stale/i);
  }, 60_000);
});
