import { describe, expect, it } from "vitest";
import { REGIONAL_ECONOMY_REGIONS } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { buildLatestValueRegionMapModel, latestCompleteRegionYear } from "../../lib/explorer/regionalEconomyMap";

describe("region map history", () => {
  const regionOf = new Map([["a", "region.guria"], ["b", "region.adjara"]]);
  const facts = [
    { indicatorId: "a", year: 2023, value: 10 },
    { indicatorId: "a", year: 2024, value: 12 },
    { indicatorId: "b", year: 2024, value: 30 },
    { indicatorId: "other", year: 2022, value: 99 },
  ];

  it("latestCompleteRegionYear returns every year per region", () => {
    const { history, year } = latestCompleteRegionYear(facts, regionOf, "none");
    expect(year).toBe(2024);
    expect(history.years).toEqual([2023, 2024]);
    expect(history.byRegion["region.guria"]).toEqual({ 2023: 10, 2024: 12 });
    expect(history.byRegion["region.adjara"]).toEqual({ 2024: 30 });
  });

  it("buildLatestValueRegionMapModel keeps history", () => {
    const latest = new Map(REGIONAL_ECONOMY_REGIONS.map((region, index) => [region.id, index + 1]));
    const history = { years: [2024], byRegion: { "region.guria": { 2024: 5 } } };
    const model = buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year: 2024, firstYear: 2024, measure: "test", history });
    expect(model.history).toEqual(history);
    expect(buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year: 2024, firstYear: 2024, measure: "test" })).not.toHaveProperty("history");
  });
});
