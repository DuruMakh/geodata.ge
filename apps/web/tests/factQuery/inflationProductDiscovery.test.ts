import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage, type CoverageData } from "../../lib/factQuery/describeCoverage";
import { getSources, type GetSourcesData } from "../../lib/factQuery/getSources";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let real: FactQuerySnapshot;
beforeAll(async () => { real = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-10-01T00:00:00Z" }); });
const catalogue = (snapshot: FactQuerySnapshot, input: unknown): CoverageData => {
  const result = describeCoverage(snapshot, input);
  if (result.kind !== "catalogue") throw new Error(JSON.stringify(result));
  return result.data as CoverageData;
};

describe("product discovery", () => {
  it("finds the same reviewed product by Georgian, English and stable ID", () => {
    const product = real.inflationProducts.catalogue[0]!;
    for (const search of [product.labelKa, product.labelEn, product.productId]) {
      const row = catalogue(real, { datasetId: "inflation-products", search }).series?.find(row => row.seriesId === product.productId);
      expect(row).toMatchObject({ seriesId: product.productId, labelKa: product.labelKa, labelEn: product.labelEn, level: "product", parentSeriesId: null, coicopCode: product.coicopCode, firstPeriod: product.firstPeriod, measures: ["yoy_pct", "cumulative_pct"] });
    }
  });
  it("identifies the dataset in unscoped search and refuses to guess retired labels", () => {
    expect(catalogue(real, { search: "cpi.product.p0001" }).series).toContainEqual(expect.objectContaining({ seriesId: "cpi.product.p0001", datasetId: "inflation-products" }));
    expect(catalogue(real, { datasetId: "inflation-products", search: "unreviewed-retired-product" }).series).toEqual([]);
  });
  it("returns the entire compact catalogue with reviewed notes and conditional cumulative coverage", () => {
    const result = catalogue(real, { datasetId: "inflation-products" });
    expect(result.series).toHaveLength(real.inflationProducts.catalogue.length);
    expect(result.datasets[0]?.periods).toEqual(["2015-01", "2026-08"]);
    expect(result.datasets[0]?.measureNotesEn?.cumulative_pct).toMatch(/startYear.*complete|complete.*startYear/);
    const noted = result.series?.find(row => row.seriesId === "cpi.product.p0088") as { historyNotes?: { noteKa: string; noteEn: string }[] };
    expect(noted.historyNotes?.some(note => note.noteEn.includes("generic mineral water") && note.noteKa.length > 0)).toBe(true);
    expect(result.series?.every(row => !("facts" in row))).toBe(true);
  });
  it("derives measure spans and exact years from nonmissing facts", () => {
    const snapshot = { ...real, inflationProducts: { catalogue: [{ productId: "cpi.product.p0001", labelKa: "პური", labelEn: "Bread", coicopCode: "0111", firstPeriod: "2024-02" }], historyNotes: [], facts: [
      { productId: "cpi.product.p0001", period: "2024-02", measure: "mom_index_100" as const, index100: "100", availability: "published" as const, sourceId: "source.geostat_product_mom" },
      { productId: "cpi.product.p0001", period: "2025-01", measure: "yoy_index_100" as const, index100: null, availability: "not_published" as const, sourceId: "source.geostat_product_yoy" },
      { productId: "cpi.product.p0001", period: "2026-01", measure: "yoy_index_100" as const, index100: "105", availability: "published" as const, sourceId: "source.geostat_product_yoy" },
    ] } };
    expect(catalogue(snapshot, { datasetId: "inflation-products" }).series?.[0]).toMatchObject({ years: [2024, 2026], yearsByMeasure: { yoy_pct: [2026], cumulative_pct: [2024] }, periodsByMeasure: { yoy_pct: ["2026-01", "2026-01"], cumulative_pct: ["2024-02", "2024-02"] } });
  });
  it("filters only product originals while retaining their registered dataset and no-match fallback", () => {
    const originals = JSON.stringify(real.sources);
    const result = getSources(real, { datasetId: "inflation-products", sourceIds: ["source.geostat_product_yoy", "source.geostat_product_mom"] });
    expect(result.kind).toBe("sources");
    const sources = (result as { data: GetSourcesData }).data.sources;
    expect(sources).toHaveLength(2);
    for (const source of sources) {
      expect(source.narrowingOutcome).toBe("applied");
      expect(source.documents.length).toBeGreaterThan(0);
      expect(source.documents.every(document => document.datasetId === "inflation" && document.role === "primary" && /^[0-9a-f]{64}$/.test(document.sha256 ?? ""))).toBe(true);
    }
    const unrelated = real.sources.find(source => !source.sourceId.startsWith("source.geostat_product_") && source.derivation === null && source.documents.some(document => document.datasetId === "inflation"))!;
    const fallback = getSources(real, { datasetId: "inflation-products", sourceIds: [unrelated.sourceId] });
    expect((fallback as { data: GetSourcesData }).data.sources[0]).toMatchObject({ narrowingOutcome: "dropped_no_match", documents: unrelated.documents });
    expect(JSON.stringify(real.sources)).toBe(originals);
  });
});
