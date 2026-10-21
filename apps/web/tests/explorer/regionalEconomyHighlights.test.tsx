import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import type { ServedRegionalEconomyObservation } from "../../lib/data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import { buildRegionalEconomyHighlights } from "../../lib/explorer/regionalEconomyHighlights";
import { RegionHighlights } from "../../components/regional-economies/region-highlights";
import { I18nProvider } from "../../lib/i18n/provider";

const fact = (seriesId: string, measure: ServedRegionalEconomyObservation["measure"], value: number, year = 2024): ServedRegionalEconomyObservation => ({
  regionId: "region.imereti", seriesId, year, measure, value,
  unit: measure === "nominal" ? "gel" : "percent",
  valuation: seriesId === REGIONAL_GDP_TOTAL ? "market_prices" : "basic_prices",
  priceBasis: "current_prices", calculation: measure === "nominal" ? "published" : "ratio_to_region_gdp",
  status: "published", sourceId: "test", sourceLocator: "A1", lastReviewedAt: "2026-09-13",
});
const facts = [
  fact(REGIONAL_GDP_TOTAL, "nominal", 1_000),
  fact(REGIONAL_GDP_TOTAL, "share_of_region_gdp", 100),
  ...["sector.a", "sector.b", "sector.c", "sector.d"].flatMap((id, index) => [
    fact(id, "nominal", [300, 300, 200, 0][index]),
    fact(id, "share_of_region_gdp", [30, 30, 20, 0][index]),
  ]),
];

test("highlights use all nominal sectors with stable ties and the full regional denominator", () => {
  const summary = buildRegionalEconomyHighlights(facts, registry, 2024);
  expect(summary.largest?.seriesId).toBe("sector.a");
  expect(summary.largestSharePct).toBe(30);
  expect(summary.total?.seriesId).toBe(REGIONAL_GDP_TOTAL);
  expect(summary.topThree.map((row) => row.seriesId)).toEqual(["sector.a", "sector.b", "sector.c"]);
  expect(summary.topThreeSharePct).toBeCloseTo(80, 12);
  expect(summary.publishedSectorCount).toBe(4);
});

test("zero is published and history follows the selected year's winners", () => {
  const historical = facts.map((row) => ({ ...row, year: 2023, value: row.seriesId === "sector.d" ? 99 : row.value / 2 }));
  const summary = buildRegionalEconomyHighlights([...historical, ...facts], registry, 2024);
  expect(summary.trends.largest).toEqual([150, 300]);
  expect(summary.trends.total).toEqual([500, 1_000]);
  expect(summary.trends.topThreeShare).toEqual([40, 80]);
  expect(summary.topThree.some((row) => row.value === 0)).toBe(false);
});

test("does not invent growth or a summary when the requested year is unavailable", () => {
  const summary = buildRegionalEconomyHighlights(facts, registry, 2022);
  expect(summary.largest).toBeNull();
  expect(summary.total).toBeNull();
  expect(summary.topThreeSharePct).toBeNull();
  expect(Object.keys(summary)).not.toContain("growth");
});

// Moved from regionalEconomyPage.test.tsx: the rendered highlight labels, and no growth claim.
test("approved highlights show largest activity, total GDP, top-three share and sector count", () => {
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
  expect(html).toContain("Largest activity");
  expect(html).toContain("Total regional GDP");
  expect(html).toContain("Top three share");
  expect(html).toContain("Published activities");
  expect(html).not.toMatch(/growth/i);
  // U12-06: the scope sentence is said once, as the source note, not again as the count card's detail.
  expect(html.split("All activities")).toHaveLength(2);
});
