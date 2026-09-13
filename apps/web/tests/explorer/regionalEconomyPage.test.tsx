import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import type { ServedRegionalEconomyObservation } from "../../lib/data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import { buildRegionalEconomyHighlights } from "../../lib/explorer/regionalEconomyHighlights";
import { RegionHighlights } from "../../components/regional-economies/region-highlights";
import { I18nProvider } from "../../lib/i18n/provider";

const fact = (seriesId: string, measure: ServedRegionalEconomyObservation["measure"], value: number): ServedRegionalEconomyObservation => ({
  regionId: "region.imereti", seriesId, year: 2024, measure, value,
  unit: measure === "nominal" ? "gel" : "percent",
  valuation: seriesId === REGIONAL_GDP_TOTAL ? "market_prices" : "basic_prices",
  priceBasis: "current_prices", calculation: measure === "nominal" ? "published" : "ratio_to_region_gdp",
  status: "published", sourceId: "test", sourceLocator: "A1", lastReviewedAt: "2026-09-13",
});
const facts = [
  fact(REGIONAL_GDP_TOTAL, "nominal", 1_000), fact(REGIONAL_GDP_TOTAL, "share_of_region_gdp", 100),
  ...["sector.a", "sector.b", "sector.c"].flatMap((id, index) => [
    fact(id, "nominal", [300, 200, 100][index]), fact(id, "share_of_region_gdp", [30, 20, 10][index]),
  ]),
];

test("approved highlights show largest activity, total GDP, top-three share and sector count", () => {
  const model = buildRegionalEconomyHighlights(facts, registry, 2024);
  const html = renderToStaticMarkup(
    <I18nProvider locale="en" messages={{
      "regionalEconomies.highlights": "Regional structure",
      "regionalEconomies.largest": "Largest activity",
      "regionalEconomies.totalKpi": "Total regional GDP",
      "regionalEconomies.topThree": "Top three share",
      "regionalEconomies.sectorCount": "Published activities",
      "regionalEconomies.ofRegionalGdp": "of regional GDP",
      "regionalEconomies.highlightsScope": "All activities",
      "regionalEconomies.unavailable": "Unavailable",
      "regionalEconomies.rowYear": "Values for {year}",
    }}>
      <RegionHighlights facts={facts} registry={registry} year={2024} />
    </I18nProvider>,
  );
  expect(model.topThreeSharePct).toBe(60);
  expect(html).toContain("Largest activity");
  expect(html).toContain("Total regional GDP");
  expect(html).toContain("Top three share");
  expect(html).toContain("Published activities");
  expect(html).not.toMatch(/growth/i);
});
