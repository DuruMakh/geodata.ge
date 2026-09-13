import { expect, test, vi } from "vitest";
import { loadRegionalEconomyFactsFromMirror } from "../../../lib/db/mirrorRows";

test("regional mirror rows use canonical ordering and preserve every field", async () => {
  const findMany = vi.fn().mockResolvedValue([{ 
    regionId: "region.imereti",
    seriesId: "sector.a",
    measure: "nominal",
    year: 2024,
    value: { toFixed: () => "715676721.66770501000000000000" },
    unit: "gel",
    valuation: "basic_prices",
    priceBasis: "current_prices",
    calculation: "published",
    status: "published",
    sourceLocator: "Imereti!Q3 [2024]",
    sourceDocumentId: "source.geostat_regional_gdp_by_activity",
    lastReviewedAt: new Date("2026-09-13T00:00:00.000Z"),
  }]);
  const db = { regionalEconomyFact: { findMany } };

  const rows = await loadRegionalEconomyFactsFromMirror(db as never);

  expect(findMany).toHaveBeenCalledWith({
    orderBy: [{ regionId: "asc" }, { seriesId: "asc" }, { measure: "asc" }, { year: "asc" }],
  });
  expect(rows).toEqual([{
    regionId: "region.imereti",
    seriesId: "sector.a",
    measure: "nominal",
    year: 2024,
    value: "715676721.66770501000000000000",
    unit: "gel",
    valuation: "basic_prices",
    priceBasis: "current_prices",
    calculation: "published",
    status: "published",
    sourceId: "source.geostat_regional_gdp_by_activity",
    sourceLocator: "Imereti!Q3 [2024]",
    lastReviewedAt: "2026-09-13",
  }]);
});
