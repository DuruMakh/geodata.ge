import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { hashDataVersion } from "../../lib/factQuery/canonical";
import { loadServedProductData } from "../../lib/data/inflation/importProducts";
import { SCHEMA_VERSION, type FactQuerySnapshot } from "../../lib/factQuery/types";
import { inflationProductIndex } from "../../lib/factQuery/inflationProductData";
import { describeCoverage, type CoverageData } from "../../lib/factQuery/describeCoverage";
import { productAnnual, productCumulative } from "../../lib/explorer/inflationProducts";
import { periodFromKey } from "../../lib/data/inflation/periods";

const historyInput = vi.hoisted(() => ({ override: null as string | null }));
// Invalid public-note inputs must exercise the builder without rewriting the shared reviewed file.
vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, readFile: (...args: Parameters<typeof original.readFile>) => {
    if (String(args[0]).endsWith("inflation-product-history.json") && historyInput.override !== null) return Promise.resolve(historyInput.override);
    return original.readFile(...args);
  } };
});

const options = { releaseCommit: "test", generatedAt: "2026-10-01T00:00:00Z" };
let snapshot: FactQuerySnapshot;
beforeAll(async () => { snapshot = await buildFactQuerySnapshot(options); });

describe("reviewed product snapshot", () => {
  it("packages the exact reviewed roster and source-precision facts with schema 1.5.0", async () => {
    expect(SCHEMA_VERSION).toBe("1.5.0");
    const served = await loadServedProductData();
    expect(snapshot.inflationProducts.catalogue).toEqual(served.catalogue.map(({ productId, coicopCode, labelKa, labelEn, firstPeriod }) => ({ productId, coicopCode, labelKa, labelEn, firstPeriod })).sort((a, b) => a.productId.localeCompare(b.productId)));
    expect(snapshot.inflationProducts.facts).toEqual(served.facts.map(({ productId, measure, period, index100, availability, sourceId }) => ({ productId, measure, period, index100, availability, sourceId })).sort((a, b) => a.productId.localeCompare(b.productId) || a.measure.localeCompare(b.measure) || a.period.localeCompare(b.period)));
    expect(snapshot.inflationProducts.facts.find(row => row.productId === "cpi.product.p0001" && row.measure === "yoy_index_100" && row.period === "2026-08")?.index100).toBe("101.8973");
  });

  it("publishes bilingual reviewed history without internal locators or decision references", () => {
    const products = snapshot.inflationProducts;
    const ids = new Set(products.catalogue.map(row => row.productId));
    expect(products.historyNotes.length).toBeGreaterThan(0);
    for (const note of products.historyNotes) {
      expect(ids.has(note.productId)).toBe(true);
      expect(note.noteKa.trim()).not.toBe("");
      expect(note.noteEn.trim()).not.toBe("");
    }
    expect(products.historyNotes.find(note => note.productId === "cpi.product.p0179")?.boundaryYear).toBe(2019);
    expect(products.historyNotes.find(note => note.productId === "cpi.product.p0269")?.boundaryYear).toBe(2020);
    expect(products.historyNotes).toEqual([...products.historyNotes].sort((a, b) => a.productId.localeCompare(b.productId) || a.boundaryYear - b.boundaryYear));
    expect(JSON.stringify(products)).not.toMatch(/sourceLocator|decisionRef|identity\.p\d/);
    expect(JSON.parse(JSON.stringify(snapshot)).inflationProducts).toEqual(products);
  });

  it("pins catalogue and fact ordering so input permutation cannot change the release hash", async () => {
    const served = await loadServedProductData();
    const notes = JSON.parse(await readFile("../../data/localization/inflation-product-history.json", "utf8"));
    expect(snapshot.inflationProducts).toBeDefined();
    served.catalogue.reverse(); served.facts.reverse();
    historyInput.override = JSON.stringify(notes.reverse());
    try {
      const permuted = await buildFactQuerySnapshot(options);
      expect(permuted.inflationProducts).toEqual(snapshot.inflationProducts);
      expect(permuted.dataVersion).toBe(snapshot.dataVersion);
    } finally { served.catalogue.reverse(); served.facts.reverse(); historyInput.override = null; }
  });

  it("reuses the explorer arithmetic and memoizes indexes per snapshot", () => {
    const index = inflationProductIndex(snapshot);
    expect(inflationProductIndex(snapshot)).toBe(index);
    expect(productAnnual(index, "cpi.product.p0001", periodFromKey("2026-08"))).toBe(1.8973);
    expect(productCumulative(index, "cpi.product.p0001", 2025, periodFromKey("2025-12")).value).toBeCloseTo(-13.7927891681444, 10);
    const changed = { ...snapshot, inflationProducts: { ...snapshot.inflationProducts, facts: snapshot.inflationProducts.facts.map(row => row.productId === "cpi.product.p0001" && row.measure === "yoy_index_100" && row.period === "2026-08" ? { ...row, index100: "110" } : row) } };
    expect(inflationProductIndex(changed)).not.toBe(index);
    expect(productAnnual(inflationProductIndex(changed), "cpi.product.p0001", periodFromKey("2026-08"))).toBe(10);
  });

  it("reports the product dataset's basic legal measures, country and fact-derived years", () => {
    const response = describeCoverage(snapshot, { datasetId: "inflation-products" });
    if (response.kind !== "catalogue") throw new Error(JSON.stringify(response));
    const data = response.data as CoverageData;
    expect(data.datasets[0]).toMatchObject({ datasetId: "inflation-products", measures: ["yoy_pct", "cumulative_pct"], years: [2015, 2026], entityTypes: ["country"], budgetScope: "consumer_prices", labelEn: "Inflation by product" });
    expect(data.entities).toContainEqual({ entityId: "country.georgia", entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", entitySlug: null });
  });

  it.each(["unknownId", "emptyKa", "emptyEn", "duplicate", "internalField"])("rejects invalid public history %s", async invalid => {
    const note = snapshot.inflationProducts.historyNotes[0]!;
    const badNotes = invalid === "duplicate" ? [note, note] : [{ ...note,
      ...(invalid === "unknownId" ? { productId: "cpi.product.p9999" } : {}),
      ...(invalid === "emptyKa" ? { noteKa: " " } : {}),
      ...(invalid === "emptyEn" ? { noteEn: " " } : {}),
      ...(invalid === "internalField" ? { decisionRef: "internal" } : {}),
    }];
    historyInput.override = JSON.stringify(badNotes);
    try { await expect(buildFactQuerySnapshot(options)).rejects.toThrow(); }
    finally { historyInput.override = null; }
  });

  it.each(["index", "name", "firstPeriod", "noteKa", "noteEn"])("hashes every public product %s change", field => {
    const changed = structuredClone(snapshot);
    const products = changed.inflationProducts;
    if (field === "index") products.facts[0]!.index100 = "123.4567";
    else if (field === "name") products.catalogue[0]!.labelEn += " changed";
    else if (field === "firstPeriod") products.catalogue[0]!.firstPeriod = "2016-01";
    else products.historyNotes[0]![field === "noteKa" ? "noteKa" : "noteEn"] += " changed";
    expect(hashDataVersion(changed)).not.toBe(snapshot.dataVersion);
  });

  it("resolves both registered inputs to their original metadata and public URLs", () => {
    for (const measure of ["mom", "yoy"]) {
      const source = snapshot.sources.find(row => row.sourceId === `source.geostat_product_${measure}`)!;
      expect(source).toBeDefined();
      expect(source.documents.length).toBeGreaterThan(0);
      const document = source.documents.find(row => row.documentLanguage === "en")!;
      expect(document.officialUrl).toMatch(/^https:\/\/geostat.ge\/media\//);
      expect(document.archiveUrl).toBe(`https://fiscal.ge/downloads/methodology/inflation/files/en/products-${measure}.xlsx`);
      expect(document.datasetId).toBe("inflation");
      expect(document.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(document.byteSize).toBeGreaterThan(0);
      expect(document.role).toBe("primary");
    }
  });
});
