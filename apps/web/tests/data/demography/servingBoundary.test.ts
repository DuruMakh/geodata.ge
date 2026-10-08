import { beforeEach, expect, test, vi } from "vitest";

vi.mock("../../../lib/data/demography/prepareDemography", () => {
  throw new Error("Serving demography must not load workbook preparation");
});

import {
  loadDemographyFacts,
  loadServedDemographyData,
  resetDemographyCacheForTests,
} from "../../../lib/data/demography/importDemography";

// The loader memoises its promise, so a case that stubs the data source has to start from an
// empty memo or it asserts against the mode the previous one resolved.
beforeEach(resetDemographyCacheForTests);

test("serving reads the reviewed CSVs without the Geostat workbook readers", async () => {
  expect(await loadDemographyFacts()).toHaveLength(1_068);
});

test("serving projects exact decimals to numbers only after validation", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  try {
    const served = await loadServedDemographyData();
    expect(served.facts).toHaveLength(1_068);
    expect(served.facts.every((row) => typeof row.value === "number")).toBe(true);
  } finally {
    vi.unstubAllEnvs();
  }
});

test("serving rejects an unknown data source before reading facts", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "unknown");
  try {
    await expect(loadServedDemographyData()).rejects.toThrow('GEODATA_DATA_SOURCE must be "db" or "csv", got "unknown"');
  } finally {
    vi.unstubAllEnvs();
  }
});
