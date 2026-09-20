import { beforeEach, expect, test, vi } from "vitest";

vi.mock("../../../lib/data/regionalEconomies/prepareRegionalEconomies", () => {
  throw new Error("Serving regional economies must not load workbook preparation");
});

import {
  loadRegionalEconomyFacts,
  loadServedRegionalEconomyData,
  resetRegionalEconomyCacheForTests,
} from "../../../lib/data/regionalEconomies/importRegionalEconomies";

// The loader memoises its promise, so a case that stubs the data source has to
// start from an empty memo or it asserts against the mode the previous one
// resolved.
beforeEach(resetRegionalEconomyCacheForTests);

test("serving reads reviewed Regional GDP facts without source workbooks", async () => {
  const facts = await loadRegionalEconomyFacts();
  expect(facts).toHaveLength(6_930);
  expect(facts.filter((row) => row.measure === "nominal")).toHaveLength(3_465);
  expect(facts.some((row) => row.year === 2025)).toBe(false);
});

test("serving projects exact decimals to numbers only after validation", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  try {
    const served = await loadServedRegionalEconomyData();
    expect(served.facts).toHaveLength(6_930);
    expect(served.facts.every((row) => typeof row.value === "number")).toBe(true);
  } finally {
    vi.unstubAllEnvs();
  }
});

test("serving rejects an unknown data source before reading facts", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "unknown");
  try {
    await expect(loadServedRegionalEconomyData()).rejects.toThrow('GEODATA_DATA_SOURCE must be "db" or "csv", got "unknown"');
  } finally {
    vi.unstubAllEnvs();
  }
});
