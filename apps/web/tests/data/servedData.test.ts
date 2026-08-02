import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadServedExplorerData,
  loadServedLandingData,
  resetServedDataCacheForTests,
  resolveServedDataSource,
} from "../../lib/data/servedData";

const originalDataSource = process.env.GEODATA_DATA_SOURCE;

// The loaders memoize for the life of the process, which is right for a build
// and wrong here: without this the first load would freeze the data source and
// every later case would assert against cached data while appearing to set its
// own GEODATA_DATA_SOURCE.
beforeEach(() => {
  resetServedDataCacheForTests();
});

afterEach(() => {
  resetServedDataCacheForTests();
  if (originalDataSource === undefined) {
    delete process.env.GEODATA_DATA_SOURCE;
  } else {
    process.env.GEODATA_DATA_SOURCE = originalDataSource;
  }
});

describe("served data source resolution", () => {
  it("defaults to csv when GEODATA_DATA_SOURCE is unset", () => {
    delete process.env.GEODATA_DATA_SOURCE;
    expect(resolveServedDataSource()).toBe("csv");
  });

  it("accepts db and csv, case-insensitively", () => {
    process.env.GEODATA_DATA_SOURCE = "DB";
    expect(resolveServedDataSource()).toBe("db");
    process.env.GEODATA_DATA_SOURCE = "csv";
    expect(resolveServedDataSource()).toBe("csv");
  });

  it("rejects unknown values with a clear error", () => {
    process.env.GEODATA_DATA_SOURCE = "supabase";
    expect(() => resolveServedDataSource()).toThrow(/must be "db" or "csv"/);
  });
});

describe("csv served data", () => {
  it("loads the full landing dataset from the reviewed CSVs", async () => {
    delete process.env.GEODATA_DATA_SOURCE;
    const landing = await loadServedLandingData();

    expect(landing.facts.length).toBeGreaterThan(0);
    expect(landing.glossary.size).toBeGreaterThan(0);
    expect(landing.sourceDocuments.length).toBeGreaterThan(0);
  });

  it("loads the full explorer dataset including validated admin categories", async () => {
    delete process.env.GEODATA_DATA_SOURCE;
    const explorer = await loadServedExplorerData();

    expect(explorer.adminFacts.length).toBeGreaterThan(0);
    expect(explorer.adminCategories.length).toBeGreaterThan(0);
    for (const category of explorer.adminCategories) {
      expect(category.id).toMatch(/^admin_spending\./);
    }
  });

  it("serves the narrow row shape, never the ingestion-only columns", async () => {
    delete process.env.GEODATA_DATA_SOURCE;
    const explorer = await loadServedExplorerData();

    // This is the whole point of lib/servedRows.ts: these columns exist for
    // validation, mapping review and the parity check, and no component reads
    // them. Without this assertion, widening a served type or spreading the
    // source row would silently re-inline ~300K chars into every explorer
    // route's payload with every check, build and browser test still green.
    expect(Object.keys(explorer.facts[0]).sort()).toEqual([
      "amountGel",
      "basis",
      "itemId",
      "side",
      "sourceId",
      "year",
    ]);
    expect(Object.keys(explorer.adminFacts[0]).sort()).toEqual([
      "amountGel",
      "basis",
      "itemId",
      "level",
      "officialInstitutionLabelKa",
      "officialLabelKa",
      "parentItemId",
      "sourceId",
      "year",
    ]);
  });

  it("re-resolves the data source instead of freezing it on first load", async () => {
    delete process.env.GEODATA_DATA_SOURCE;
    await loadServedLandingData();

    resetServedDataCacheForTests();
    process.env.GEODATA_DATA_SOURCE = "supabase";

    // A memo that outlived the reset would answer from cache and resolve here.
    await expect(loadServedLandingData()).rejects.toThrow(/must be "db" or "csv"/);
  });

  it("reuses the explorer load for later landing callers", async () => {
    delete process.env.GEODATA_DATA_SOURCE;
    const explorer = await loadServedExplorerData();
    const landing = await loadServedLandingData();

    // Same arrays, not an equal copy: the second call must not re-parse the
    // CSVs or, in db mode, re-run a full parity pass over the same rows.
    expect(landing.facts).toBe(explorer.facts);
    expect(landing.sourceDocuments).toBe(explorer.sourceDocuments);
  });
});
