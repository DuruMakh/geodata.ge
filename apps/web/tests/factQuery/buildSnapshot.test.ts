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
