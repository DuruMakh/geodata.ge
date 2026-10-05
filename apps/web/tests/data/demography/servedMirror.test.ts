import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { loadDemographyFacts, loadServedDemographyRows, resetDemographyCacheForTests } from "../../../lib/data/demography/importDemography";
import { SERIES } from "../../../lib/data/demography/series";

// The db branch of the serving loader. Production builds run it (GEODATA_DATA_SOURCE=db) and
// pull-request CI builds in CSV mode, so without this a regression there surfaces only at deploy.
const mirror = vi.hoisted(() => ({ loadDemographyFactsFromDb: vi.fn() }));
vi.mock("../../../lib/db/servedDataDb", () => mirror);

beforeEach(() => { vi.stubEnv("GEODATA_DATA_SOURCE", "db"); resetDemographyCacheForTests(); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

test("serves the mirror's rows when they match the CSVs, in any order", async () => {
  const reversed = [...(await loadDemographyFacts())].reverse();
  mirror.loadDemographyFactsFromDb.mockResolvedValue(reversed);
  expect((await loadServedDemographyRows()).facts).toBe(reversed);
});

test("rejects a mirror value that differs only in its decimal text", async () => {
  const drifted = (await loadDemographyFacts()).map((row) =>
    row.seriesId === SERIES.populationDensity && row.geographyId === "country.georgia" && row.year === 2014
      ? { ...row, value: "65.0" } // the CSV text normalises to "65"
      : row,
  );
  mirror.loadDemographyFactsFromDb.mockResolvedValue(drifted);
  await expect(loadServedDemographyRows()).rejects.toThrow(/Demography parity failed/);
});

test("rejects a mirror that is missing a row", async () => {
  mirror.loadDemographyFactsFromDb.mockResolvedValue((await loadDemographyFacts()).slice(1));
  await expect(loadServedDemographyRows()).rejects.toThrow(/Demography parity failed/);
});

test("keeps a rejection as the answer until the cache is reset", async () => {
  const csv = await loadDemographyFacts();
  mirror.loadDemographyFactsFromDb.mockResolvedValue(csv.slice(1));
  const first = loadServedDemographyRows();
  await expect(first).rejects.toThrow(/Demography parity failed/);
  expect(loadServedDemographyRows()).toBe(first);
  expect(mirror.loadDemographyFactsFromDb).toHaveBeenCalledTimes(1);

  resetDemographyCacheForTests();
  mirror.loadDemographyFactsFromDb.mockResolvedValue(csv);
  await expect(loadServedDemographyRows()).resolves.toEqual({ facts: csv });
});
