import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import regions from "../../../../data/taxonomy/municipal-regions.json";
import type { ServedRegionalEconomyObservation } from "../../lib/data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { RegionalEconomyExplorer } from "../../components/regional-economies/regional-economy-explorer";

const facts: ServedRegionalEconomyObservation[] = [2023, 2024].flatMap((year) => [
  { id: REGIONAL_GDP_TOTAL, amount: year === 2024 ? 7_203_151_022 : 6_347_078_758, share: 100 },
  { id: "sector.a", amount: 715_676_722, share: 9.94 },
  { id: "sector.b", amount: 0, share: 0 },
].flatMap((entry): ServedRegionalEconomyObservation[] => [
  {
    regionId: "region.imereti", seriesId: entry.id, year, measure: "nominal", value: entry.amount,
    unit: "gel", valuation: entry.id === REGIONAL_GDP_TOTAL ? "market_prices" : "basic_prices",
    priceBasis: "current_prices", calculation: "published", status: "published",
    sourceId: entry.id === REGIONAL_GDP_TOTAL ? "source.geostat_regional_gdp" : "source.geostat_regional_gdp_by_activity",
    sourceLocator: "Sheet!A1", lastReviewedAt: "2026-09-13",
  },
  {
    regionId: "region.imereti", seriesId: entry.id, year, measure: "share_of_region_gdp", value: entry.share,
    unit: "percent", valuation: entry.id === REGIONAL_GDP_TOTAL ? "market_prices" : "basic_prices",
    priceBasis: "current_prices", calculation: "ratio_to_region_gdp", status: "published",
    sourceId: "source.fiscal_regional_economy_share", sourceLocator: "Sheet!A1; Total!A1", lastReviewedAt: "2026-09-13",
  },
]));

const regionalMessages = {
  "regionalEconomies.heading": "Imereti regional economy",
  "regionalEconomies.detailHeadingLead": "Regional economy —",
  "regionalEconomies.total": "Total regional GDP",
  "regionalEconomies.contextNominal": "GDP and sector GVA at current prices.",
  "regionalEconomies.contextShare": "Sector GVA divided by regional GDP.",
  "regionalEconomies.rangeChanged": "Range {start} to {end}",
  "regionalEconomies.measure": "Measure",
  "regionalEconomies.nominal": "Nominal value in GEL",
  "regionalEconomies.shareOfRegionGdp": "Share of regional GDP",
  "regionalEconomies.sector": "Economic activity",
  "regionalEconomies.rowYear": "Values for {year}",
  "regionalEconomies.source": "Source: Geostat",
  "regionalEconomies.accountingNote": "Sector shares may total less than 100% because regional GDP includes net product taxes.",
  "regionalEconomies.pickerTitle": "Choose a region",
  "regionalEconomies.pickerPlaceholder": "Search regions",
  "regionalEconomies.pickerSearch": "Search regions",
  "regionalEconomies.pickerResults": "Region results",
  "regionalEconomies.pickerHint": "Use arrow keys and Enter",
  "regionalEconomies.allRegions": "All regions",
  "regionalEconomies.empty": "No regions found",
  "regionalEconomies.clearSearch": "Clear search",
  "regionalEconomies.highlights": "Regional structure",
  "regionalEconomies.largest": "Largest activity",
  "regionalEconomies.totalKpi": "Total regional GDP",
  "regionalEconomies.topThree": "Top three share",
  "regionalEconomies.sectorCount": "Published activities",
  "regionalEconomies.ofRegionalGdp": "of regional GDP",
  "regionalEconomies.highlightsScope": "All published activities; current prices.",
  "regionalEconomies.unavailable": "Unavailable",
  "regionalEconomies.workbookTitle": "{region} regional economy — {measure}",
};

test("selected-region workspace renders only the approved GEL and regional-share switch", async () => {
  const base = await getMessages("en", ["controls", "main", "format"]);
  const html = renderToStaticMarkup(
    <I18nProvider locale="en" messages={{ ...base, ...regionalMessages }} englishLabels={{
      "region.guria": "Guria",
      "region.imereti": "Imereti",
      "region.kakheti": "Kakheti",
    }}>
      <RegionalEconomyExplorer
        facts={facts}
        registry={registry}
        region={{ id: "region.imereti", slug: "imereti", labelKa: "იმერეთი", labelEn: "Imereti" }}
        regions={regions}
        sources={[]}
        siteOrigin="https://fiscal.ge"
      />
    </I18nProvider>,
  );
  expect((html.match(/data-testid="regional-measure-/g) ?? [])).toHaveLength(2);
  expect(html).toContain('aria-label="Nominal value in GEL"');
  expect(html).toContain('aria-label="Share of regional GDP"');
  expect(html).toContain("₾");
  expect(html).toContain("lucide-chart-pie");
  expect(html).toContain("1 / 21");
  expect(html).toContain("Total regional GDP");
  expect(html).toContain("Regional economy —");
  expect(html).toContain('data-testid="regional-entity-navigation"');
  expect(html).toContain('href="/en/explorer/economy/regions/guria"');
  expect(html).toContain('href="/en/explorer/economy/regions/kakheti"');
  expect(html).not.toMatch(/real growth|share of Georgia|USD|population|2025/i);
});
