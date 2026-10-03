import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import * as publications from "../../lib/factQuery/publications";
import { queryInflationProducts } from "../../lib/factQuery/queryInflationProducts";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import type { Observation } from "../../lib/factQuery/observations";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-10-01T00:00:00Z" });
});

const csv = () => publications.buildInflationProductsCsv(snapshot);
const metadata = () => JSON.parse(publications.buildInflationProductsJson(snapshot, csv()).bytes.toString("utf8"));
const rows = () => parse(csv().bytes, { bom: true, columns: true }) as Record<string, string>[];
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

describe("reviewed product publications", () => {
  it("provides the two compact publication builders", () => {
    expect(publications.buildInflationProductsCsv).toBeTypeOf("function");
    expect(publications.buildInflationProductsJson).toBeTypeOf("function");
  });

  it("preserves every exact input value, missing cell and source in stable order", () => {
    const artifact = csv();
    expect(artifact.bytes.subarray(0, 3)).toEqual(Buffer.from([239, 187, 191]));
    const actual = rows();
    expect(Object.keys(actual[0]!)).toEqual(["series_id", "measure", "period", "index_100", "availability", "source_ids"]);
    expect(actual).toHaveLength(snapshot.inflationProducts.facts.length);
    expect(artifact.rowCount).toBe(actual.length);
    const expected = new Map(snapshot.inflationProducts.facts.map(fact => [`${fact.productId}:${fact.measure}:${fact.period}`, fact]));
    const keys = actual.map(row => `${row.series_id}:${row.measure}:${row.period}`);
    expect(new Set(keys).size).toBe(expected.size);
    expect(keys).toEqual([...keys].sort());
    let missing = 0;
    for (const row of actual) {
      const fact = expected.get(`${row.series_id}:${row.measure}:${row.period}`)!;
      expect(fact).toBeDefined();
      expect(row.index_100).toBe(fact.index100 ?? "");
      if (fact.index100 !== null) expect(new Decimal(row.index_100!).equals(fact.index100)).toBe(true);
      else { missing++; expect(row.index_100).toBe(""); }
      expect(row.availability).toBe(fact.availability);
      expect(row.source_ids).toBe(fact.sourceId);
    }
    expect(missing).toBeGreaterThan(0);
  });

  it("keeps CSV ordering deterministic even when snapshot inputs arrive reversed", () => {
    const reversed = { ...snapshot, inflationProducts: { ...snapshot.inflationProducts, facts: [...snapshot.inflationProducts.facts].reverse() } };
    expect(publications.buildInflationProductsCsv(reversed).bytes.equals(csv().bytes)).toBe(true);
  });

  it("publishes bilingual current catalogue, factual input coverage and CSV integrity", () => {
    const published = metadata();
    expect(published).toMatchObject(publications.publicationHeader(snapshot));
    expect(published.datasetId).toBe("inflation-products");
    expect(published.licence).toBe("CC BY 4.0");
    expect(published.notice).toMatch(/\p{Script=Georgian}/u);
    expect(published.noticeEn).toContain("100");
    expect(published.queryMeasures).toEqual(["yoy_pct", "cumulative_pct"]);
    const series = published.catalogue.series;
    expect(series).toHaveLength(snapshot.inflationProducts.catalogue.length);
    for (const product of snapshot.inflationProducts.catalogue) {
      expect(series.find((entry: { seriesId: string }) => entry.seriesId === product.productId)).toMatchObject({
        seriesId: product.productId, labelKa: product.labelKa, labelEn: product.labelEn,
        coicopCode: product.coicopCode, firstPeriod: product.firstPeriod, level: "product", parentSeriesId: null,
      });
    }
    expect(series.flatMap((entry: { historyNotes?: unknown[] }) => entry.historyNotes ?? [])).toHaveLength(snapshot.inflationProducts.historyNotes.length);
    for (const measure of ["mom_index_100", "yoy_index_100"]) {
      const facts = snapshot.inflationProducts.facts.filter(fact => fact.measure === measure);
      const periods = facts.map(fact => fact.period).sort();
      expect(published.coverage[measure]).toEqual({
        periods: [periods[0], periods.at(-1)], rowCount: facts.length,
        availableCount: facts.filter(fact => fact.index100 !== null).length,
        missingCount: facts.filter(fact => fact.index100 === null).length,
      });
    }
    expect(published.data).toMatchObject({ url: "/downloads/data/inflation-products.csv", mediaType: "text/csv", rowCount: csv().rowCount, byteSize: csv().bytes.byteLength, sha256: hash(csv().bytes) });
  });

  it("defines published indices separately from the complete-input cumulative derivation", () => {
    const published = metadata();
    expect(published.definitions.mom_index_100).toMatchObject({ reference: "previous_month", unit: "index_previous_month_100", calculation: "published" });
    expect(published.definitions.yoy_index_100).toMatchObject({ reference: "same_month_previous_year", unit: "index_previous_year_100", calculation: "published" });
    expect(published.definitions.yoy_pct.formula).toBe("yoy_index_100 - 100");
    expect(published.definitions.cumulative_pct).toMatchObject({
      formula: "(product(mom_index_100 / 100, January(startYear)..endpoint) - 1) * 100",
      calculation: "fiscal_ge_derived", calculationBasePeriod: "(startYear - 1)-12", requiresCompleteInputs: true,
    });
    for (const definition of Object.values(published.definitions) as { ka: string; en: string }[]) {
      expect(definition.ka).toMatch(/\p{Script=Georgian}/u);
      expect(definition.en.length).toBeGreaterThan(0);
    }
    expect(published.definitions.cumulative_pct.baseDefinitionEn).toContain("December");
  });

  it("retains immutable primary originals and a separate derivation source view", () => {
    const published = metadata();
    const originals = snapshot.sources.filter(source => ["source.geostat_product_mom", "source.geostat_product_yoy"].includes(source.sourceId));
    expect(published.sources).toEqual(originals);
    for (const source of published.sources) {
      expect(source.nameKa).toMatch(/\p{Script=Georgian}/u);
      expect(source.nameEn.length).toBeGreaterThan(0);
      expect(source.documents.length).toBeGreaterThan(0);
      for (const document of source.documents) {
        expect(document.role).toBe("primary");
        expect(document.archiveUrl).toMatch(/^https:\/\/fiscal\.ge\/downloads\/methodology\/inflation\//);
        expect(document.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(document.licenceId).toBe("official-public-document-no-explicit-license");
        expect(document.attributionEn).toBe("Geostat");
      }
    }
    expect(published.derivationSources).toHaveLength(1);
    expect(published.derivationSources[0].sourceId).toBe("source.geostat_product_mom");
    expect(published.derivationSources[0].documents.every((document: { role: string }) => document.role === "derivation_upstream")).toBe(true);
    expect(published.derivationSources[0].derivationEn).toContain("Fiscal.ge");
    const sourceIds = new Set(published.sources.map((source: { sourceId: string }) => source.sourceId));
    expect(rows().every(row => row.source_ids!.split(";").every(id => sourceIds.has(id)))).toBe(true);
    expect(snapshot.sources.filter(source => sourceIds.has(source.sourceId))).toEqual(originals);
    expect(published.observations).toBeUndefined();
    expect(published.facts).toBeUndefined();
    expect(JSON.stringify(published)).not.toMatch(/sourceLocator|decisionId|"index100"|"observationId"/);
    expect(publications.buildInflationProductsJson(snapshot, csv()).bytes.byteLength).toBeLessThan(1024 * 1024);
  });

  it("reproduces a bounded annual and cumulative query from the published exact inputs", () => {
    const actual = rows();
    const id = "cpi.product.p0001";
    for (const measure of ["yoy_pct", "cumulative_pct"] as const) {
      const response = queryInflationProducts(snapshot, { seriesIds: [id], measure, fromPeriod: "2026-08", toPeriod: "2026-08", ...(measure === "cumulative_pct" ? { startYear: 2026 } : {}) });
      if (response.kind !== "observations") throw new Error(`Expected observations, received ${response.kind}`);
      const observation = (response.data as { observations: Observation[] }).observations[0]!;
      const inputs = actual.filter(row => row.series_id === id && row.measure === (measure === "yoy_pct" ? "yoy_index_100" : "mom_index_100") && row.period! >= "2026-01" && row.period! <= "2026-08");
      const value = measure === "yoy_pct"
        ? new Decimal(inputs.find(row => row.period === "2026-08")!.index_100!).minus(100)
        : inputs.reduce((product, row) => product.times(new Decimal(row.index_100!).div(100)), new Decimal(1)).minus(1).times(100);
      expect(observation.value).toBeCloseTo(value.toNumber(), 10);
    }
  });

  it("adds both files and the product dataset to derived publication inventories", () => {
    const artifacts = publications.buildAllPublications(snapshot);
    const manifest = JSON.parse(artifacts.at(-1)!.bytes.toString("utf8"));
    expect(manifest.files.map((entry: { fileName: string }) => entry.fileName)).toEqual(artifacts.slice(0, -1).map(file => file.fileName));
    for (const name of ["inflation-products.csv", "inflation-products.json"]) {
      const artifact = artifacts.find(file => file.fileName === name)!;
      expect(artifact).toBeDefined();
      expect(manifest.files.find((entry: { fileName: string }) => entry.fileName === name)).toMatchObject({ rowCount: artifact.rowCount, sha256: hash(artifact.bytes), byteSize: artifact.bytes.byteLength });
    }
    expect(manifest.coverage.map((entry: { datasetId: string }) => entry.datasetId)).toContain("inflation-products");
    const catalogue = JSON.parse(artifacts.find(file => file.fileName === "catalogue.json")!.bytes.toString("utf8"));
    expect(catalogue.datasets.find((dataset: { datasetId: string }) => dataset.datasetId === "inflation-products").series).toHaveLength(snapshot.inflationProducts.catalogue.length);
  });
});
