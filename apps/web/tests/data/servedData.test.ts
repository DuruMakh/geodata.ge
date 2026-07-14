import { afterEach, describe, expect, it } from "vitest";
import {
  loadServedExplorerData,
  loadServedLandingData,
  resolveServedDataSource,
} from "../../lib/data/servedData";

const originalDataSource = process.env.GEODATA_DATA_SOURCE;

afterEach(() => {
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
});
