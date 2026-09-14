// apps/web/tests/factQuery/buildSnapshot.test.ts
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "../../lib/factQuery/types";
import { loadTaxonomyFiles } from "../../lib/data/taxonomy";
import { loadSourceDocuments } from "../../lib/data/sources";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-08-28T00:00:00.000Z" };

describe("buildFactQuerySnapshot", () => {
  it("preserves every registered source, including the sector growth and volume originals", async () => {
    const [snapshot, sources] = await Promise.all([
      buildFactQuerySnapshot(OPTIONS),
      loadSourceDocuments("../../data/sources/source-documents.csv"),
    ]);
    // 127 with the Geostat basket-weights workbook the categories page cites.
    expect(sources).toHaveLength(127);
    expect(snapshot.sources.map(source => source.sourceId).sort()).toEqual(sources.map(source => source.sourceId).sort());
    expect(snapshot.sources.map(source => source.sourceId)).toEqual(expect.arrayContaining([
      "source.geostat_sector_growth", "source.geostat_sector_volume",
    ]));
  });

  it("carries the national, ministries, municipal and gdp facts", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);

    expect(snapshot.national.facts.length).toBe(527);
    expect(snapshot.ministries.facts.length).toBe(852);
    expect(snapshot.municipal.functionFacts.length).toBe(7040);
    expect(snapshot.municipal.totalFacts.length).toBe(704);
    expect(snapshot.gdpFacts.length).toBe(30);
  });

  it("carries the debt and balance facts", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);

    expect(new Set(snapshot.debt.facts.map((f) => f.seriesId))).toEqual(
      new Set([
        "debt.stock.total",
        "debt.stock.domestic",
        "debt.stock.external",
        "debt.service.total",
        "debt.service.principal",
        "debt.service.interest",
        "debt.rate.total",
        "debt.rate.domestic",
        "debt.rate.external",
      ]),
    );

    // Projections begin the year after the last recorded one. If that ever
    // stops holding, a projection overlaps an actual and "which is this?"
    // stops being answerable from the year alone.
    const service = snapshot.debt.facts.filter((f) => f.family === "service");
    const lastActual = Math.max(...service.filter((f) => f.status === "actual").map((f) => f.year));
    const firstProjection = Math.min(
      ...service.filter((f) => f.status === "projection_existing_portfolio").map((f) => f.year),
    );
    expect(firstProjection).toBe(lastActual + 1);

    expect(snapshot.deficit.facts).toHaveLength(37);
    expect(snapshot.deficit.facts.filter((f) => f.status === "projection")).toHaveLength(6);
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

  // Per CELL, not per series. PROGRAM_SUCCESSIONS carries startYear/endYear and
  // LEGACY_PROGRAM_JOINS carries year, so the joined years are in the tables already —
  // 50 legacy-join cells across 9 series, 140 further succession cells across 20
  // series (four of the 20 are also reached by a legacy join), 190 cells and 25
  // distinct series once deduplicated. Cross-checked against the reviewed CSV's own
  // mapping_notes and ministries-drilldown-programs-methodology.md §6. Asserting the
  // exact totals here is what keeps program_historical_join honest: a derivation that
  // silently widened to whole series would blow past 190.
  it("resolves historical joins to the exact served cells that came in through a join", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const servedProgramCells = new Set(
      snapshot.ministries.facts.filter((f) => f.level === "major_program").map((f) => `${f.itemId}:${f.year}`),
    );
    const cells = snapshot.ministries.historicalJoinSeriesYears;
    const seriesIds = new Set(cells.map((cell) => cell.slice(0, cell.lastIndexOf(":"))));

    expect(cells.length).toBe(190);
    expect(seriesIds.size).toBe(25);

    // Every joined cell is a real served major_program row: the caveat can never pin
    // to a cell the query would return as missing.
    for (const cell of cells) expect(servedProgramCells.has(cell)).toBe(true);

    // And every series in the list is joined for at least one of its own years, so no
    // id in it is a resolution artefact of a table entry with no served row behind it.
    for (const seriesId of seriesIds) {
      expect(cells.some((cell) => cell.startsWith(`${seriesId}:`))).toBe(true);
    }
  });

  it("leaves a joined series' native years out of the join list", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    // Common courts: 2006-2011 arrive through the legacy "09 02" lines, 2012-2025 are
    // served natively under the series' own code 09 01.
    const seriesId = "admin_program.09_01.f5bec61a";
    const joinedYears = snapshot.ministries.historicalJoinSeriesYears
      .filter((cell) => cell.startsWith(`${seriesId}:`))
      .map((cell) => Number(cell.slice(cell.lastIndexOf(":") + 1)))
      .sort((a, b) => a - b);
    const servedYears = snapshot.ministries.facts.filter((f) => f.itemId === seriesId).map((f) => f.year);

    expect(joinedYears).toEqual([2006, 2007, 2008, 2009, 2010, 2011]);
    expect(servedYears).toContain(2020);
    expect(joinedYears).not.toContain(2020);
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
