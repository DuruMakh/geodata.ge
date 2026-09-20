import { expect, test, vi } from "vitest";
vi.mock("../../../lib/data/economicSectors/prepareEconomicSectors", () => {
  throw new Error("Serving sectors must not load workbook preparation");
});
import { loadEconomicSectorFacts, loadServedEconomicSectorsData } from "../../../lib/data/economicSectors/importEconomicSectors";

test("serving sectors reads reviewed facts without workbook preparation", async () => {
  const facts = await loadEconomicSectorFacts();
  expect(facts).toHaveLength(987);
  expect(facts.filter(f => f.measure === "real_growth")).toHaveLength(315);
  expect(facts.some(f => f.measure === "real_growth" && f.year === 2010)).toBe(false);
});
test("serving rejects an unknown data source before reading facts", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "unknown");
  try { await expect(loadServedEconomicSectorsData()).rejects.toThrow('GEODATA_DATA_SOURCE must be "db" or "csv", got "unknown"'); }
  finally { vi.unstubAllEnvs(); }
});
