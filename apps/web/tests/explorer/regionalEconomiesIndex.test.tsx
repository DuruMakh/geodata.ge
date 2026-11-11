import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { loadRegionalEconomyFacts, REGIONAL_ECONOMY_REGIONS } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { buildLatestValueRegionMapModel, buildRegionalEconomyMapModel } from "../../lib/explorer/regionalEconomyMap";
import { I18nProvider } from "../../lib/i18n/provider";
import { RegionalEconomiesIndex, RegionIndex } from "../../components/regional-economies/regional-economies-index";

const regionNames: Record<string, string> = {
  "region.tbilisi": "Tbilisi", "region.adjara": "Adjara", "region.guria": "Guria",
  "region.imereti": "Imereti", "region.kakheti": "Kakheti",
  "region.mtskheta_mtianeti": "Mtskheta-Mtianeti",
  "region.racha_lechkhumi_kvemo_svaneti": "Racha-Lechkhumi and Kvemo Svaneti",
  "region.samegrelo_zemo_svaneti": "Samegrelo-Zemo Svaneti",
  "region.samtskhe_javakheti": "Samtskhe-Javakheti", "region.kvemo_kartli": "Kvemo Kartli",
  "region.shida_kartli": "Shida Kartli",
};

const messages: Record<string, string> = {
  "regionalEconomies.mapAria": "Regional GDP map for {year}",
  "regionalEconomies.mapEntityAria": "{name}: {amount}, {year}",
  "regionalEconomies.legend": "Regional GDP",
  "regionalEconomies.regions": "Regions",
  "regionalEconomies.search": "Search regions",
  "regionalEconomies.searchPlaceholder": "Search",
  "regionalEconomies.empty": "No regions found",
  "regionalEconomies.clearSearch": "Clear search",
  "regionalEconomies.summaryTitle": "Overview",
  "regionalEconomies.regionCount": "Regions",
  "regionalEconomies.largestRegion": "Largest regional economy",
  "regionalEconomies.period": "Period",
  "regionalEconomies.currentPrices": "Current prices",
  "regionalEconomies.sourceNote": "Source note",
  "regionalEconomies.boundaries": "Boundaries",
  "regionalEconomies.heading": "Regional economies",
  "controls.share.button": "Share",
};

test("credits geoBoundaries, overlays the two occupied areas and claims no share of Georgia", async () => {
  const [regional, municipal] = await Promise.all([loadRegionalEconomyFacts(), loadServedMunicipalData()]);
  const model = buildRegionalEconomyMapModel({
    facts: regional.map((fact) => ({ ...fact, value: Number(fact.value) })),
    regions: municipal.regions,
  });
  const html = renderToStaticMarkup(
    <I18nProvider
      locale="en"
      englishLabels={regionNames}
      messages={messages}
    >
      <RegionalEconomiesIndex model={model} sourceNote="Source note" />
    </I18nProvider>,
  );

  // The 11 targets, rows and paths and the Imereti link are checked in regional-economies.spec.ts.
  expect(html).toContain("2024");
  expect(html).toContain("geoBoundaries");
  expect((html.match(/data-occupied-overlay=""/g) ?? [])).toHaveLength(2);
  expect(html).not.toContain("share of Georgia");
});

describe("RegionIndex crawl tables", () => {
  const latest = new Map(REGIONAL_ECONOMY_REGIONS.map((region, index) => [region.id, (index + 1) * 100]));
  const history = { years: [2023, 2024], byRegion: Object.fromEntries(REGIONAL_ECONOMY_REGIONS.map((region, index): [string, Record<number, number>] => [region.id, region.id === "region.guria" ? { 2024: (index + 1) * 100 } : { 2023: index + 1, 2024: (index + 1) * 100 }])) };
  const model = buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year: 2024, firstYear: 2023, measure: "test", history });
  const metric = { formatValue: (value: number) => value.toLocaleString("en-US"), mapAria: "Map", entityAria: () => "", legend: "Persons", testId: "test-map" };
  const render = (crawl?: Parameters<typeof RegionIndex>[0]["crawl"]) => renderToStaticMarkup(
    <I18nProvider locale="en" englishLabels={regionNames} messages={messages}>
      <RegionIndex title="Test index" model={model} sourceNote="Source" metric={metric} crawl={crawl} />
    </I18nProvider>,
  );

  test("RegionIndex with crawl writes one table per view on the server", () => {
    const html = render([
      { model, metric, lead: { label: "Georgia", valuesByYear: { 2023: 66, 2024: 1000 } } },
      { model, metric: { ...metric, legend: "Per person" } },
    ]);
    const wrapper = html.match(/<div hidden="" data-testid="crawl-tables">(.*?)<\/div>/)![1]!;
    expect(wrapper.match(/<table>/g)).toHaveLength(2);
    expect(wrapper).toContain("<caption>Test index · Persons · 2023–2024</caption>");
    expect(wrapper).toContain("<caption>Test index · Per person · 2023–2024</caption>");
    expect(wrapper).toMatch(/<tbody><tr><th>Georgia<\/th><td>66<\/td><td>1,000<\/td><\/tr>/);
    expect(wrapper).toMatch(/<tr><th>Guria<\/th><td>—<\/td>/);
  });

  test("RegionIndex without crawl writes no wrapper", () => {
    expect(render()).not.toContain("crawl-tables");
  });
});
