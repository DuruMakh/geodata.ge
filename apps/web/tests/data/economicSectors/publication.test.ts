import { expect, test } from "vitest";
import { createHash } from "node:crypto";
import { loadEconomicSectorFacts } from "../../../lib/data/economicSectors/importEconomicSectors";
import { queryEconomicSectors } from "../../../lib/factQuery/queryEconomicSectors";
import { catalogueData } from "../../../lib/factQuery/publications";
import { TOOLS } from "../../../lib/mcp/tools";
import { parse } from "csv-parse/sync";
import type { Observation } from "../../../lib/factQuery/observations";
import { loadPackagedSnapshot } from "../../../lib/mcp/snapshot";
import { buildAllPublications, buildEconomicSectorsCsv } from "../../../lib/factQuery/publications";
test("sector publications retain exact decimals and explicit missing growth cells",()=>{
  const snapshot=loadPackagedSnapshot();
  const csv=buildEconomicSectorsCsv(snapshot);
  expect(csv.rowCount).toBe(987);
  expect(csv.bytes.subarray(0,3)).toEqual(Buffer.from([239,187,191]));
  const rows = parse(csv.bytes, { columns: true, bom: true }) as Record<string, string>[];
  expect(rows.find(row => row.series_id === "sector.a" && row.year === "2025" && row.measure === "nominal")?.value).toBe("5419971597.4820028");
  const files=buildAllPublications(snapshot);
  const json=JSON.parse(files.find(f=>f.fileName==="economic-sectors.json")!.bytes.toString());
  expect(json.observations).toHaveLength(1008);
  expect(json.observations.filter((o:{availability:string})=>o.availability==="missing")).toHaveLength(21);
  expect(files.some(f=>f.fileName==="economic-sectors.csv")).toBe(true);
});

test("canonical imports and snapshot publish identical CSV bytes regardless of input order", async () => {
  const snapshot = loadPackagedSnapshot();
  const facts = await loadEconomicSectorFacts();
  const canonical = buildEconomicSectorsCsv({ economicSectors: { ...snapshot.economicSectors, facts } });
  expect(canonical.bytes.equals(buildEconomicSectorsCsv(snapshot).bytes)).toBe(true);
  expect(buildEconomicSectorsCsv({ economicSectors: { ...snapshot.economicSectors, facts: [...facts].reverse() } }).bytes.equals(canonical.bytes)).toBe(true);
});

test("bulk values, units and missing cells agree with every advertised national query", () => {
  const snapshot = loadPackagedSnapshot();
  const files = buildAllPublications(snapshot);
  const json = JSON.parse(files.find(f => f.fileName === "economic-sectors.json")!.bytes.toString());
  const rows = parse(files.find(f => f.fileName === "economic-sectors.csv")!.bytes, { bom: true, columns: true }) as Record<string, string>[];
  const measures = { amount_gel: "nominal", share_of_gdp_pct: "share_of_gdp", real_growth_pct: "real_growth" };
  const catalogue = catalogueData(snapshot, "economic-sectors");
  expect(catalogue.series).toHaveLength(21);
  expect(catalogue.datasets[0].years).toEqual([2010, 2025]);
  for (const [measure, csvMeasure] of Object.entries(measures)) {
    const result = queryEconomicSectors(snapshot, { seriesIds: catalogue.series!.map(s => s.seriesId), years: Array.from({ length: 16 }, (_, i) => 2010 + i), measure });
    expect(result.kind).toBe("observations");
    if (result.kind !== "observations") throw new Error("query failed");
    const observations = (result.data as { observations: Observation[] }).observations;
    expect(json.observations.filter((o: Observation) => o.measure === measure)).toEqual(observations);
    for (const observation of observations) {
      expect(observation.entityId).toBe("country.georgia");
      expect(observation.unit).toBe(measure === "amount_gel" ? "GEL" : "percent");
      expect(observation.valueDefinition).toBeTruthy();
      expect(observation.valueDefinitionEn).toBeTruthy();
      const row = rows.find(r => r.series_id === observation.seriesId && Number(r.year) === observation.year && r.measure === csvMeasure);
      if (observation.availability === "missing") {
        expect(row).toBeUndefined();
        expect([measure, observation.year, observation.value]).toEqual(["real_growth_pct", 2010, null]);
      } else {
        expect(Number(row!.value)).toBe(observation.value);
        expect(row!.unit).toBe(measure === "amount_gel" ? "gel" : "percent");
      }
    }
  }
  expect(json.coverage).toMatchObject({ expectedCount: 1008, returnedCount: 987 });
  expect(json.dataVersion).toBe(snapshot.dataVersion);
  expect(json.schemaVersion).toBe(snapshot.schemaVersion);
  expect(json.sources.length).toBeGreaterThan(0);
  for (const observation of json.observations as Observation[]) {
    for (const sourceId of observation.sourceIds) expect(json.sources.some((s: { sourceId: string }) => s.sourceId === sourceId)).toBe(true);
    for (const caveatId of observation.caveatIds) expect(json.caveats.some((c: { code: string }) => c.code === caveatId)).toBe(true);
  }
  const manifest = JSON.parse(files.find(f => f.fileName === "manifest.json")!.bytes.toString());
  expect(manifest.dataVersion).toBe(json.dataVersion);
  expect(manifest.schemaVersion).toBe(json.schemaVersion);
  expect(manifest.coverage).toContainEqual({ datasetId: "economic-sectors", firstYear: 2010, lastYear: 2025 });
  for (const fileName of ["economic-sectors.csv", "economic-sectors.json"]) {
    const artifact = files.find(f => f.fileName === fileName)!;
    expect(manifest.files.find((f: { fileName: string }) => f.fileName === fileName)).toMatchObject({
      rowCount: artifact.rowCount, byteSize: artifact.bytes.length,
      sha256: createHash("sha256").update(artifact.bytes).digest("hex"),
    });
  }
});

test("fully available sector publication has no missing coverage", () => {
  const snapshot = structuredClone(loadPackagedSnapshot());
  snapshot.economicSectors.facts = snapshot.economicSectors.facts.filter(f => f.year >= 2011);
  const json = JSON.parse(buildAllPublications(snapshot).find(f => f.fileName === "economic-sectors.json")!.bytes.toString());
  expect(json.coverage).toMatchObject({ missingCells: [], expectedCount: 945, returnedCount: 945 });
});

test("advertised sector tool accepts coverage bounds and rejects regional or out-of-range requests", () => {
  const snapshot = loadPackagedSnapshot();
  const tool = TOOLS.find(t => t.name === "query_economic_sectors")!;
  const catalogue = catalogueData(snapshot, "economic-sectors");
  expect(catalogue.datasets[0].entityTypes).toEqual(["country"]);
  for (const measure of catalogue.datasets[0].measures) {
    const input = { seriesIds: ["sector.a", "economy.gdp_total"], years: [measure === "real_growth_pct" ? 2011 : 2010, 2025], measure };
    expect(tool.schema.safeParse(input).success).toBe(true);
    expect(tool.run(snapshot, input).status).toBe("ok");
  }
  for (const extra of [{ years: [2009] }, { years: [2026] }, { entityIds: ["region.tbilisi"] }]) {
    expect(tool.run(snapshot, { seriesIds: ["sector.a"], years: [2025], measure: "amount_gel", ...extra }).status).toBe("error");
  }
});

test("publication merges preliminary caveat scope across measures", () => {
  const snapshot = structuredClone(loadPackagedSnapshot());
  snapshot.economicSectors.facts = snapshot.economicSectors.facts.map(f => ({ ...f, status: f.year === 2024 && f.measure === "nominal" || f.year === 2025 && f.measure === "real_growth" ? "preliminary" : "published" }));
  const json = JSON.parse(buildAllPublications(snapshot).find(f => f.fileName === "economic-sectors.json")!.bytes.toString());
  expect(json.caveats.find((c: { code: string }) => c.code === "sectors_preliminary").affects).toHaveLength(42);
});
