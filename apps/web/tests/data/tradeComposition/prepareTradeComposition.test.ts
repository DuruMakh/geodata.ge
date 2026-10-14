import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { buildTradeCompositionData, prepareTradeCompositionData, tradeCompositionCsv } from "../../../lib/data/tradeComposition/prepareTradeComposition";

const root = path.resolve(process.cwd(), "../.."), research = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
type Row = Record<string, string>;
describe("accepted annual goods composition", () => {
  let result: Awaited<ReturnType<typeof buildTradeCompositionData>>;
  const fixtures: string[] = [];
  beforeAll(async () => { result = await buildTradeCompositionData(root); }, 60_000);
  afterAll(async () => { for (const fixture of fixtures) if (fixture.startsWith(path.join(root, ".tmp") + path.sep)) await fs.rm(fixture, { recursive: true, force: true }); });
  async function fixture() {
    await fs.mkdir(path.join(root, ".tmp"), { recursive: true });
    const directory = await fs.mkdtemp(path.join(root, ".tmp/composition-fixture-")); fixtures.push(directory);
    const sources = JSON.parse(await fs.readFile(path.join(root, research, "full-source-manifest.json"), "utf8")) as { source_id: string; local_file: string }[];
    const names = [...Object.keys(result.report.inputSha256), "data/taxonomy/trade-composition.json", "data/localization/en/labels.json", ...sources.filter(source => source.source_id in result.report.sourceSha256).map(source => `${research}/${source.local_file}`)];
    for (const name of names) { await fs.mkdir(path.dirname(path.join(directory, name)), { recursive: true }); await fs.copyFile(path.join(root, name), path.join(directory, name)); }
    return directory;
  }
  async function refresh(directory: string, name: string, frozen = false) {
    if (frozen) {
      const filename = path.join(directory, research, "prepared-validation.json"), report = JSON.parse(await fs.readFile(filename, "utf8"));
      report.input_sha256[name] = hash(await fs.readFile(path.join(directory, research, name)));
      await fs.writeFile(filename, JSON.stringify(report)); await refresh(directory, "prepared-validation.json");
    }
    const filename = path.join(directory, research, "independent-verification.json"), independent = JSON.parse(await fs.readFile(filename, "utf8"));
    independent.input_artifact_sha256[name] = hash(await fs.readFile(path.join(directory, research, name)));
    await fs.writeFile(filename, JSON.stringify(independent));
  }
  async function mutateRows(directory: string, name: string, change: (rows: Row[]) => void) {
    const filename = path.join(directory, research, name), rows = parse(await fs.readFile(filename), { columns: true, bom: true }) as Row[];
    change(rows); const fields = Object.keys(rows[0]);
    await fs.writeFile(filename, serializeBomCsvRows([fields, ...rows.map(row => fields.map(field => row[field]))])); await refresh(directory, name);
  }
  it("accepts only the 17 categories and 884 details while preserving code zero", () => {
    expect(result.data.entities).toHaveLength(17); expect(result.data.facts).toHaveLength(884);
    expect(result.data.facts.filter(f => f.entityId.startsWith("trade.sitc1."))).toHaveLength(520);
    expect(result.data.facts.filter(f => f.entityId.startsWith("trade.bec1."))).toHaveLength(364);
    expect(result.data.entities.find(e => e.id === "trade.sitc1.0")?.sourceCode).toBe("0");
    expect(result.report.controlObservations).toBe(104); expect(result.report.outsideScopeHoldCount).toBe(2);
    expect(result.report.researchPackageStatus).toBe("requires_source_resolution");
    expect(result.data.facts.find(f => f.entityId === "trade.sitc1.0" && f.year === 2000 && f.indicatorId === "trade.exports")?.valueUsd).toBe("38221445.540000132");
    expect(result.data.facts.every(f => f.role === "detail" && f.valueStatus === "numeric")).toBe(true);
    expect(result.report.reconciliation).toHaveLength(104);
  });
  it.each(["omitted", "duplicate", "source", "code", "label", "year", "unit", "format", "worksheet", "stored token", "classification", "control"]) ("rejects %s after refreshing the input fingerprint", async mutation => {
    const directory = await fixture();
    await mutateRows(directory, "goods-products-annual/sitc1-2000-2025.csv", rows => {
      const index = rows.findIndex(row => row.role === "detail"), row = rows[index];
      if (mutation === "omitted") rows.splice(index, 1);
      else if (mutation === "duplicate") rows.push({ ...row });
      else if (mutation === "source") row.source_id = "geostat_trade_import-sitc-2000-2026";
      else if (mutation === "code") row.product_code = "9";
      else if (mutation === "label") row.source_label = "Wrong category";
      else if (mutation === "year") row.year = "1999";
      else if (mutation === "unit") row.source_unit = "usd";
      else if (mutation === "format") row.source_number_format = "General";
      else if (mutation === "worksheet") row.source_sheet = "SITC-2026-months";
      else if (mutation === "stored token") row.source_value = "38221.44554";
      else if (mutation === "classification") row.classification = "bec1";
      else rows.find(r => r.role === "total")!.value_usd = "323938268";
    });
    await expect(buildTradeCompositionData(directory)).rejects.toThrow(/inventory|source|cell|metadata|conversion|reconciliation/i);
  }, 60_000);
  it.each(["source hash", "source size", "category inventory", "worksheet binding", "sum evidence", "national evidence", "national discrepancy"]) ("rejects changed %s with refreshed evidence", async mutation => {
    const directory = await fixture();
    if (mutation === "source hash" || mutation === "source size") {
      const name = "full-source-manifest.json", filename = path.join(directory, research, name), sources = JSON.parse(await fs.readFile(filename, "utf8"));
      const source = sources.find((s: Row) => s.source_id === "geostat_trade_export-sitc-2000-2026");
      if (mutation === "source hash") source.sha256 = "0".repeat(64); else source.bytes++;
      await fs.writeFile(filename, JSON.stringify(sources)); await refresh(directory, name, true);
      const invFile = path.join(directory, research, "expected-observation-inventory.json"), inv = JSON.parse(await fs.readFile(invFile, "utf8")); inv.full_manifest_sha256 = hash(await fs.readFile(filename));
      await fs.writeFile(invFile, JSON.stringify(inv)); await refresh(directory, "expected-observation-inventory.json", true);
    } else if (mutation === "category inventory" || mutation === "worksheet binding") {
      const name = "source-layouts.json", filename = path.join(directory, research, name), layouts = JSON.parse(await fs.readFile(filename, "utf8"));
      const layout = layouts.find((l: Row) => l.source_id === "geostat_trade_export-sitc-2000-2026");
      if (mutation === "category inventory") layout.rows[1].item_id = "goods.sitc1.2000-2025.9"; else layout.source_sheet = "SITC-2026-months";
      await fs.writeFile(filename, JSON.stringify(layouts)); await refresh(directory, name, true);
      const invFile = path.join(directory, research, "expected-observation-inventory.json"), inv = JSON.parse(await fs.readFile(invFile, "utf8")); inv.layout_sha256 = hash(await fs.readFile(filename));
      await fs.writeFile(invFile, JSON.stringify(inv)); await refresh(directory, "expected-observation-inventory.json", true);
    } else if (mutation === "national discrepancy") {
      const filename = path.join(directory, "data/imports/trade-overview-annual.csv"), rows = parse(await fs.readFile(filename), { columns: true, bom: true }) as Row[]; rows.find(r => r.year === "2000" && r.indicator_id === "trade.exports")!.value_usd = "323938270";
      const fields = Object.keys(rows[0]); await fs.writeFile(filename, serializeBomCsvRows([fields, ...rows.map(r => fields.map(f => r[f]))]));
    } else await mutateRows(directory, "prepared-reconciliation.csv", rows => { rows.find(r => r.source_refs.includes("geostat_trade_export-sitc") && r.check === (mutation === "sum evidence" ? "published_detail_sum" : "published_total_matches_anchor"))!.actual_usd = "323938270"; });
    await expect(buildTradeCompositionData(directory)).rejects.toThrow(/hash|inventory|source|reconciliation/i);
  }, 60_000);
  it.each(["unresolved-source-issues.json", "prepared-validation.json"]) ("rejects a goods hold in %s while the original UK holds pass", async name => {
    const directory = await fixture(), filename = path.join(directory, research, name), document = JSON.parse(await fs.readFile(filename, "utf8"));
    (name === "prepared-validation.json" ? document.unresolved_source_issues : document.issues).push({ family: "goods_products", source_id: "geostat_trade_export-sitc-2000-2026", status: "fail" });
    await fs.writeFile(filename, JSON.stringify(document)); await refresh(directory, name, name !== "prepared-validation.json");
    await expect(buildTradeCompositionData(directory)).rejects.toThrow(/hold/i);
  }, 60_000);
  it.each(["CSV", "catalogue", "English label", "report"]) ("writes BOM and rejects changed %s in read-only check mode", async mutation => {
    const directory = await fixture(); await prepareTradeCompositionData(directory, "write");
    const filename = path.join(directory, "data/imports/trade-composition-annual.csv"), bytes = await fs.readFile(filename), before = (await fs.stat(filename)).mtimeMs;
    expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]); expect(bytes.toString()).toBe(tradeCompositionCsv(result.data));
    await prepareTradeCompositionData(directory, "check"); expect((await fs.stat(filename)).mtimeMs).toBe(before);
    if (mutation === "CSV") await fs.appendFile(filename, "\n");
    else if (mutation === "report") await fs.appendFile(path.join(directory, "data/reports/trade-composition-validation.json"), " ");
    else if (mutation === "catalogue") { const target = path.join(directory, "data/taxonomy/trade-composition.json"), catalogue = JSON.parse(await fs.readFile(target, "utf8")); catalogue[0].labelKa = "შეცვლილი"; await fs.writeFile(target, JSON.stringify(catalogue)); }
    else { const target = path.join(directory, "data/localization/en/labels.json"), labels = JSON.parse(await fs.readFile(target, "utf8")); labels["trade.sitc1.0"].text = "Wrong category"; await fs.writeFile(target, JSON.stringify(labels)); }
    await expect(prepareTradeCompositionData(directory, "check")).rejects.toThrow(/stale|label|catalogue|fingerprint/i);
  }, 60_000);
});
