// apps/web/tests/factQuery/buildSnapshot.test.ts
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "../../lib/factQuery/types";
import { loadTaxonomyFiles } from "../../lib/data/taxonomy";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-08-28T00:00:00.000Z" };

describe("buildFactQuerySnapshot", () => {
  it("carries the national, ministries, municipal and gdp facts", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);

    expect(snapshot.national.facts.length).toBe(527);
    expect(snapshot.ministries.facts.length).toBe(852);
    expect(snapshot.municipal.functionFacts.length).toBe(7040);
    expect(snapshot.municipal.totalFacts.length).toBe(704);
    expect(snapshot.gdpFacts.length).toBe(30);
  });

  it("exposes a url slug for every municipality and none for excluded codes", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);

    expect(Object.keys(snapshot.municipal.slugByCode)).toHaveLength(64);
    expect(snapshot.municipal.slugByCode["11"]).toBe("khulo");
    for (const code of AGGREGATE_ONLY_MUNICIPAL_CODES) {
      expect(snapshot.municipal.slugByCode[code]).toBeUndefined();
    }
  });

  it("hashes identically when only the volatile fields differ", async () => {
    const first = await buildFactQuerySnapshot(OPTIONS);
    const second = await buildFactQuerySnapshot({ releaseCommit: "other", generatedAt: "2030-01-01T00:00:00.000Z" });

    expect(second.dataVersion).toBe(first.dataVersion);
    expect(first.dataVersion).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resolves historical join series to real served item ids", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const served = new Set(snapshot.ministries.facts.map((f) => f.itemId));

    expect(snapshot.ministries.historicalJoinSeriesIds.length).toBeGreaterThan(0);
    for (const id of snapshot.ministries.historicalJoinSeriesIds) expect(served.has(id)).toBe(true);
  });

  // sortOrder must come from the taxonomy files (data/taxonomy/*.json), not from
  // glossary Map iteration order: the CSV loader (lib/data/glossary.ts) and the db
  // loader (lib/db/mirrorRows.ts's loadGlossaryFromMirror, ORDER BY sortOrder, id)
  // insert into that Map in two different, independently-authored orders, so a
  // position-derived sortOrder would make dataVersion mode-dependent. Comparing
  // against a fresh, independent load of the taxonomy files (not the snapshot's own
  // computation) is mode-invariant by construction and needs no database.
  it("takes each item's sortOrder from the taxonomy files, not glossary order", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
    const taxonomySortOrderById = new Map(taxonomy.map((item) => [item.id, item.sortOrder]));

    expect(snapshot.national.items.length).toBe(taxonomySortOrderById.size);
    for (const item of snapshot.national.items) {
      expect(item.sortOrder).toBe(taxonomySortOrderById.get(item.id));
    }
  });
});

// Every array in the snapshot's hashed content is array-order-significant:
// canonicalize (lib/factQuery/canonical.ts) preserves array order on purpose.
// CSV mode and db mode can produce the same rows in a different order — CSV
// file row order vs. the mirror's `ORDER BY` (lib/db/mirrorRows.ts), with only
// year-ascending guaranteed in between (lib/data/servedData.ts's
// orderExplorerDataForServing / orderMunicipalDataForServing, which says
// outright: "exact cross-path row order is not claimed here"). So
// buildSnapshot.ts re-sorts every array by that dataset's canonical keys
// before hashing.
//
// These tests re-derive that order independently — not by importing
// buildSnapshot.ts's own sort helper — and assert each array already equals
// itself re-sorted. That way a future CSV regeneration or taxonomy reorder
// that silently drops the pin fails loudly here. No database required: this
// runs against csv-mode data, and each key list is exactly the mirror's
// `ORDER BY`, translated to the served row's own field names (see
// countryFunctionFacts / countryTotalFacts below for the one field that gets
// renamed in translation).
function compareSortKeys(a: readonly (string | number)[], b: readonly (string | number)[]): number {
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) continue;
    if (typeof left === "number" && typeof right === "number") return left - right;
    return String(left) < String(right) ? -1 : 1;
  }
  return 0;
}

function expectPinnedOrder<T>(rows: T[], keyOf: (row: T) => readonly (string | number)[]): void {
  const resorted = [...rows].sort((a, b) => compareSortKeys(keyOf(a), keyOf(b)));
  expect(rows).toEqual(resorted);
}

describe("hashed array order is pinned to each dataset's canonical sort keys", () => {
  it("national.facts: year, side, itemId, basis", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.national.facts, (f) => [f.year, f.side, f.itemId, f.basis]);
  });

  it("ministries.facts: year, itemId", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.ministries.facts, (f) => [f.year, f.itemId]);
  });

  it("ministries.categories: sortOrder, id", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.ministries.categories, (c) => [c.sortOrder, c.id]);
  });

  it("municipal.functions: sortOrder, id", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.functions, (f) => [f.sortOrder, f.id]);
  });

  it("municipal.regions: sortOrder, id", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.regions, (r) => [r.sortOrder, r.id]);
  });

  it("municipal.municipalities: sortId, code", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.municipalities, (m) => [m.sortId, m.code]);
  });

  it("municipal.functionFacts: year, municipalityCode, categoryId", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.functionFacts, (f) => [f.year, f.municipalityCode, f.categoryId]);
  });

  it("municipal.totalFacts: year, municipalityCode", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.totalFacts, (f) => [f.year, f.municipalityCode]);
  });

  // Served as MunicipalFunctionFact, whose only location field is
  // municipalityCode — but the row comes from MunicipalCountryFunctionFact,
  // whose mirror ORDER BY is scopeId. loadMunicipalCountryFunctionFactsFromMirror
  // (lib/db/mirrorRows.ts) copies row.scopeId into the served municipalityCode
  // field, so municipalityCode is where the mirror's scopeId ordering lands here.
  it("municipal.countryFunctionFacts: year, municipalityCode (mirror's scopeId), categoryId", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.countryFunctionFacts, (f) => [f.year, f.municipalityCode, f.categoryId]);
  });

  // Same scopeId -> municipalityCode translation as countryFunctionFacts above.
  it("municipal.countryTotalFacts: year, municipalityCode (mirror's scopeId)", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.countryTotalFacts, (f) => [f.year, f.municipalityCode]);
  });

  it("municipal.populationFacts: year, municipalityCode", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.populationFacts, (f) => [f.year, f.municipalityCode]);
  });

  it("municipal.adjaraBudgetAdjustments: year", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.municipal.adjaraBudgetAdjustments, (a) => [a.year]);
  });

  it("gdpFacts: year", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expectPinnedOrder(snapshot.gdpFacts, (f) => [f.year]);
  });
});
