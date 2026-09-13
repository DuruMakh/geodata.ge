import { expect, test } from "vitest";
import { assertEconomicSectorParity } from "../../../lib/data/economicSectors/importEconomicSectors";
import type { SectorObservation } from "../../../lib/data/economicSectors/types";

const reference: SectorObservation = {
  seriesId: "economy.gdp_total", year: 2025, measure: "real_growth", value: "7.46161492416432",
  unit: "percent", valuation: "market_prices", priceBasis: "volume_change",
  calculation: "index_to_growth", status: "preliminary", sourceId: "source.geostat_sector_growth",
  sourceLocator: "Real GDP Growth!BY26", lastReviewedAt: "2026-09-11",
};
const facts: SectorObservation[] = [reference, { ...reference, seriesId: "sector.a", valuation: "basic_prices", value: "-5.67461791842112", sourceLocator: "Real GDP Growth!BY3" }];

test("sector mirror parity ignores order and preserves exact decimals", () => {
  expect(() => assertEconomicSectorParity(facts, [...facts].reverse())).not.toThrow();
});
test.each([
  { value: "7.46161492416433" }, { status: "published" }, { unit: "gel" },
  { sourceLocator: "wrong" }, { sourceId: "another-source" }, { lastReviewedAt: "2026-09-12" },
  { calculation: "published" }, { valuation: "basic_prices" }, { priceBasis: "current_prices" },
])("rejects a changed mirror field: %j", (change) => {
  expect(() => assertEconomicSectorParity(facts, [{ ...reference, ...change } as SectorObservation, facts[1]])).toThrow();
});
test("rejects missing and duplicate mirror keys", () => {
  expect(() => assertEconomicSectorParity(facts, [reference])).toThrow();
  expect(() => assertEconomicSectorParity(facts, [...facts, reference])).toThrow();
});
