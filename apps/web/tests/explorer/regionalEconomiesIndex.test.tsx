import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { loadRegionalEconomyFacts } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { buildRegionalEconomyMapModel } from "../../lib/explorer/regionalEconomyMap";
import { I18nProvider } from "../../lib/i18n/provider";
import { RegionalEconomiesIndex } from "../../components/regional-economies/regional-economies-index";

const regionNames: Record<string, string> = {
  "region.tbilisi": "Tbilisi", "region.adjara": "Adjara", "region.guria": "Guria",
  "region.imereti": "Imereti", "region.kakheti": "Kakheti",
  "region.mtskheta_mtianeti": "Mtskheta-Mtianeti",
  "region.racha_lechkhumi_kvemo_svaneti": "Racha-Lechkhumi and Kvemo Svaneti",
  "region.samegrelo_zemo_svaneti": "Samegrelo-Zemo Svaneti",
  "region.samtskhe_javakheti": "Samtskhe-Javakheti", "region.kvemo_kartli": "Kvemo Kartli",
  "region.shida_kartli": "Shida Kartli",
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
      messages={{
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
      }}
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
