import { describe, expect, test } from "vitest";
import regions from "../../../../../data/taxonomy/municipal-regions.json";
import sectorRegistry from "../../../../../data/taxonomy/economic-sectors.json";
import { shareOfRegionGdpPercent } from "../../../lib/data/regionalEconomies/calculations";
import {
  REGIONAL_GDP_TOTAL,
  type RegionalEconomyObservation,
} from "../../../lib/data/regionalEconomies/types";
import { validateRegionalEconomyObservations } from "../../../lib/data/regionalEconomies/validation";

const sectors = sectorRegistry.filter((sector) => sector.classificationCode !== null);
const years = Array.from({ length: 15 }, (_, index) => 2010 + index);

function completeFixture(
  regionEntries = regions.slice(0, 1),
  sectorEntries = sectors.slice(0, 1),
): RegionalEconomyObservation[] {
  const rows: RegionalEconomyObservation[] = [];
  for (const region of regionEntries) {
    for (const year of years) {
      const total = String(120 + year - 2010);
      const totalLocator = `regional GDP!${year}`;
      rows.push({
        regionId: region.id,
        seriesId: REGIONAL_GDP_TOTAL,
        year,
        measure: "nominal",
        value: total,
        unit: "gel",
        valuation: "market_prices",
        priceBasis: "current_prices",
        calculation: "published",
        status: "published",
        sourceId: "source.geostat_regional_gdp",
        sourceLocator: totalLocator,
        lastReviewedAt: "2026-09-13",
      });
      rows.push({
        regionId: region.id,
        seriesId: REGIONAL_GDP_TOTAL,
        year,
        measure: "share_of_region_gdp",
        value: "100",
        unit: "percent",
        valuation: "market_prices",
        priceBasis: "current_prices",
        calculation: "ratio_to_region_gdp",
        status: "published",
        sourceId: "source.fiscal_regional_economy_share",
        sourceLocator: `${totalLocator}; ${totalLocator}`,
        lastReviewedAt: "2026-09-13",
      });
      for (const [index, sector] of sectorEntries.entries()) {
        const value = String(15 + index);
        const locator = `${region.id}!${sector.classificationCode}${year}`;
        rows.push({
          regionId: region.id,
          seriesId: sector.id,
          year,
          measure: "nominal",
          value,
          unit: "gel",
          valuation: "basic_prices",
          priceBasis: "current_prices",
          calculation: "published",
          status: "published",
          sourceId: "source.geostat_regional_gdp_by_activity",
          sourceLocator: locator,
          lastReviewedAt: "2026-09-13",
        });
        rows.push({
          regionId: region.id,
          seriesId: sector.id,
          year,
          measure: "share_of_region_gdp",
          value: shareOfRegionGdpPercent(value, total),
          unit: "percent",
          valuation: "basic_prices",
          priceBasis: "current_prices",
          calculation: "ratio_to_region_gdp",
          status: "published",
          sourceId: "source.fiscal_regional_economy_share",
          sourceLocator: `${locator}; ${totalLocator}`,
          lastReviewedAt: "2026-09-13",
        });
      }
    }
  }
  return rows;
}

describe("regional economy canonical validation", () => {
  test("accepts a complete region, year, total and sector grid", () => {
    const rows = completeFixture();
    expect(validateRegionalEconomyObservations(rows, regions.slice(0, 1), sectors.slice(0, 1)).counts).toEqual({
      regions: 1,
      years: 15,
      selectableSeries: 2,
      nominal: 30,
      shareOfRegionGdp: 30,
      total: 60,
    });
  });

  test("reports the exact complete production shape", () => {
    const report = validateRegionalEconomyObservations(completeFixture(regions, sectors), regions, sectors);
    expect(report.counts).toEqual({
      regions: 11,
      years: 15,
      selectableSeries: 21,
      nominal: 3465,
      shareOfRegionGdp: 3465,
      total: 6930,
    });
    expect(report.uniqueKeys).toBe(6930);
  });

  test.each([
    ["region", { regionId: "region.unknown" }],
    ["series", { seriesId: "sector.z" }],
    ["year", { year: 2009 }],
    ["measure", { measure: "share_of_georgia" }],
    ["unit", { unit: "percent" }],
    ["valuation", { valuation: "basic_prices" }],
    ["price basis", { priceBasis: "volume_change" }],
    ["calculation", { calculation: "year_over_year" }],
    ["status", { status: "preliminary" }],
    ["source", { sourceId: "source.unknown" }],
    ["locator", { sourceLocator: "" }],
    ["review date", { lastReviewedAt: "2026-02-30" }],
    ["decimal", { value: "1e3" }],
  ])("rejects an invalid %s field", (_name, patch) => {
    const rows = completeFixture();
    rows[0] = { ...rows[0], ...patch } as RegionalEconomyObservation;
    expect(() => validateRegionalEconomyObservations(rows, regions.slice(0, 1), sectors.slice(0, 1))).toThrow();
  });

  test("rejects duplicate and missing observation keys", () => {
    const rows = completeFixture();
    expect(() => validateRegionalEconomyObservations([...rows, rows[0]], regions.slice(0, 1), sectors.slice(0, 1))).toThrow(/Duplicate.*region\.tbilisi.*2010/i);
    expect(() => validateRegionalEconomyObservations(rows.slice(1), regions.slice(0, 1), sectors.slice(0, 1))).toThrow(/Missing.*region\.tbilisi.*2010/i);
  });

  test("rejects a non-positive GDP denominator and inconsistent share", () => {
    const nonPositive = completeFixture();
    nonPositive[0].value = "0";
    expect(() => validateRegionalEconomyObservations(nonPositive, regions.slice(0, 1), sectors.slice(0, 1))).toThrow(/positive regional GDP/i);

    const inconsistent = completeFixture();
    inconsistent.find((row) => row.seriesId === "sector.a" && row.measure === "share_of_region_gdp")!.value = "99";
    expect(() => validateRegionalEconomyObservations(inconsistent, regions.slice(0, 1), sectors.slice(0, 1))).toThrow(/share/i);
  });

  test("accepts a true zero sector amount and share", () => {
    const rows = completeFixture();
    rows.find((row) => row.seriesId === "sector.a" && row.measure === "nominal")!.value = "0";
    rows.find((row) => row.seriesId === "sector.a" && row.measure === "share_of_region_gdp")!.value = "0";
    expect(() => validateRegionalEconomyObservations(rows, regions.slice(0, 1), sectors.slice(0, 1))).not.toThrow();
  });
});
