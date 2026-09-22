import { beforeEach, expect, test, vi } from "vitest";
vi.mock("../../../lib/data/economicSectors/prepareEconomicSectors", () => {
  throw new Error("Serving sectors must not load workbook preparation");
});
import {
  loadEconomicSectorFacts,
  loadServedEconomicSectorsData,
  resetEconomicSectorsCacheForTests,
} from "../../../lib/data/economicSectors/importEconomicSectors";

// The loader memoises its promise, a rejection included, so a case that stubs
// the data source has to start from an empty memo — and has to leave one.
beforeEach(resetEconomicSectorsCacheForTests);

test("serving sectors reads reviewed facts without workbook preparation", async () => {
  const facts = await loadEconomicSectorFacts();
  expect(facts).toHaveLength(987);
  expect(facts.filter(f => f.measure === "real_growth")).toHaveLength(315);
  expect(facts.some(f => f.measure === "real_growth" && f.year === 2010)).toBe(false);
});
test("no reviewed sector row is a year_over_year calculation", async () => {
  // economicSectorsWorkbook dropped its year_over_year branch — which cited the
  // previous year's source beside the current one — because no fact carries the
  // value. The client rows no longer carry the calculation column, so nothing
  // downstream can notice if one appears, and validation.ts still admits it for
  // real_growth. This is what fails first if an import ever produces one.
  const facts = await loadEconomicSectorFacts();
  expect(facts.filter((f) => f.calculation === "year_over_year")).toEqual([]);
  expect(
    facts.filter((f) => f.measure === "real_growth" && f.calculation !== "index_to_growth"),
  ).toEqual([]);
});

test("serving rejects an unknown data source before reading facts", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "unknown");
  try { await expect(loadServedEconomicSectorsData()).rejects.toThrow('GEODATA_DATA_SOURCE must be "db" or "csv", got "unknown"'); }
  finally { vi.unstubAllEnvs(); }
});
