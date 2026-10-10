import path from "node:path";
import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { buildTradeDomesticData } from "../../../lib/data/tradeDomestic/prepareTradeDomestic";

describe("reviewed domestic exports", () => {
  let result: Awaited<ReturnType<typeof buildTradeDomesticData>>;
  const root = path.resolve(process.cwd(), "../.."), fixtures: string[] = [];
  const research = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
  beforeAll(async () => { result = await buildTradeDomesticData(path.resolve(process.cwd(), "../..")); }, 60_000);
  afterAll(async () => { for (const fixture of fixtures) if (fixture.startsWith(path.join(root, ".tmp") + path.sep)) await fs.rm(fixture, { recursive: true, force: true }); });
  async function fixture() {
    await fs.mkdir(path.join(root, ".tmp"), { recursive: true });
    const directory = await fs.mkdtemp(path.join(root, ".tmp/domestic-fixture-")); fixtures.push(directory);
    const sources = JSON.parse(await fs.readFile(path.join(root, research, "full-source-manifest.json"), "utf8")) as { source_id: string; local_file: string }[];
    const names = [...Object.keys(result.report.inputSha256), ...sources.filter(source => source.source_id in result.report.sourceSha256).map(source => `${research}/${source.local_file}`)];
    for (const name of names) { await fs.mkdir(path.dirname(path.join(directory, name)), { recursive: true }); await fs.copyFile(path.join(root, name), path.join(directory, name)); }
    return directory;
  }

  it("keeps the published national amount and derives re-exports from the matching total", () => {
    const cells = result.data.facts.filter(fact => fact.entityId === "goods.total" && fact.year === 2025);
    expect(cells.find(fact => fact.indicatorId === "trade.domestic_exports")?.valueUsd).toBe("3360329267.0083367");
    expect(cells.find(fact => fact.indicatorId === "trade.reexports")?.valueUsd).toBe("3927475760.5659541");
    expect(cells.find(fact => fact.indicatorId === "trade.reexports")?.role).toBe("derived");
  });

  it("retains all domestic countries without inventing a match for a historical name", () => {
    expect(result.data.entities.filter(entity => entity.kind === "country")).toHaveLength(186);
    expect(result.data.facts.filter(fact => fact.indicatorId === "trade.reexports" && fact.entityId === "partner.2014-2025.807")).toHaveLength(0);
    expect(result.data.facts.filter(fact => fact.indicatorId === "trade.domestic_exports" && fact.entityId === "partner.2014-2025.807")).toHaveLength(12);
  });

  it("preserves the published product remainder and limits product comparisons to the approved years", () => {
    const products = result.data.entities.filter(entity => entity.kind === "product");
    expect(products).toHaveLength(100);
    expect(result.data.facts.find(fact => fact.entityId === "goods.other.2020-2025" && fact.year === 2025)?.valueUsd).toBe("429174637.23423891");
    const ids = new Set(products.map(entity => entity.id));
    expect(result.data.facts.filter(fact => ids.has(fact.entityId)).every(fact => fact.year >= 2020 && fact.year <= 2025 && fact.indicatorId === "trade.domestic_exports")).toBe(true);
  });

  it("accepts only this goods subset while preserving the unrelated services holds", () => {
    expect(result.report.status).toBe("passed");
    expect(result.report.scope).toBe("annual_domestic_exports");
    expect(result.report.outsideScopeHoldCount).toBe(2);
    expect(result.report.researchPackageStatus).toBe("requires_source_resolution");
  });

  it("rejects a coherent replacement amount that differs from the original source cell", async () => {
    const directory = await fixture(), filename = path.join(directory, research, "goods-domestic-annual.csv");
    const rows = parse(await fs.readFile(filename), { columns: true, bom: true }) as Record<string, string>[];
    const changed = rows.find(row => row.role === "detail" && row.year === "2025")!;
    changed.source_value = "1"; changed.value_usd = "1000";
    const fields = Object.keys(rows[0]);
    await fs.writeFile(filename, serializeBomCsvRows([fields, ...rows.map(row => fields.map(field => row[field]))]));
    await expect(buildTradeDomesticData(directory)).rejects.toThrow(/source cell/i);
  }, 60_000);

  it("blocks a domestic acceptance hold recorded outside the saved validation report", async () => {
    const directory = await fixture(), filename = path.join(directory, research, "unresolved-source-issues.json");
    const issues = JSON.parse(await fs.readFile(filename, "utf8"));
    issues.issues.push({ family: "goods_domestic", year: "2025" });
    await fs.writeFile(filename, JSON.stringify(issues));
    await expect(buildTradeDomesticData(directory)).rejects.toThrow(/acceptance hold/i);
  }, 60_000);

  it("rejects a reviewed identity whose declared total-export source does not match the input", async () => {
    const directory = await fixture(), filename = path.join(directory, research, "identity-review.csv");
    const rows = parse(await fs.readFile(filename), { columns: true, bom: true }) as Record<string, string>[];
    for (const row of rows) if (["reexports_national", "reexports_country"].includes(row.family)) row.left_source_id = "unreviewed-wrong-source";
    const fields = Object.keys(rows[0]);
    await fs.writeFile(filename, serializeBomCsvRows([fields, ...rows.map(row => fields.map(field => row[field]))]));
    await expect(buildTradeDomesticData(directory).then(() => undefined)).rejects.toThrow(/source binding/i);
  }, 60_000);
});
