import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));

import { PopulationExplorer } from "../../components/demography/population-explorer";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces } from "../../lib/explorer/demographyAreas";
import { buildPopulationMapModels } from "../../lib/explorer/demographyPopulationMaps";
import { message } from "../../lib/i18n/messages";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale } from "../../lib/i18n/types";

let html: string;
let htmlKa: string;
const count = (token: RegExp) => (html.match(token) ?? []).length;

// The scopes the explorer's page loads: `municipal` is there because the municipality map always prints its legend text.
async function renderExplorer(locale: Locale): Promise<string> {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const presentation = await getPresentation(locale, ["demography", "common", "controls", "main", "format", "workbook", "municipal"], ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: message(presentation.messages, "demography.georgia"),
  });
  const maps = buildPopulationMapModels({
    facts,
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    densityUnit: message(presentation.messages, "demography.densityUnit"),
  });
  return renderToStaticMarkup(
    <I18nProvider {...presentation}>
      <PopulationExplorer facts={facts.map(projectDemographyObservation)} places={places} maps={maps} tbilisiArea="504.24" sources={[]} siteOrigin="https://fiscal.ge" />
    </I18nProvider>,
  );
}

beforeAll(async () => {
  [html, htmlKa] = await Promise.all([renderExplorer("en"), renderExplorer("ka")]);
});

describe("Population explorer, first render", () => {
  test("opens on the region map with the Georgia pill pressed and density available", () => {
    expect(count(/data-region-map-target=""/g)).toBe(11);
    expect(html).not.toContain("/explorer/economy/regions/");
    expect(html).toMatch(/data-testid="population-georgia-pill"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-testid="population-georgia-pill"/);
    expect(html).toContain('data-testid="population-level-municipalities"');
    expect(html).not.toMatch(/data-testid="population-measure-density"[^>]*disabled=""/);
    expect(html).not.toContain('data-testid="population-density-note"');
    expect(html).toContain("persons, 1 January 2026");
  });

  test("always gives the reused region map its own wording, never its regional-GDP default", () => {
    expect(html).not.toContain("Regional GDP");
    expect(htmlKa).not.toContain("მშპ");
  });

  test("lists Georgia and the 11 regions with full persons and Georgia selected", () => {
    expect(count(/data-testid="series-row"/g)).toBe(12);
    expect(html).toContain("3,941,103");
    expect(html).toMatch(/1\s*\/\s*12/);
    expect(html).toContain('data-testid="population-tab-municipalities"');
  });

  test("draws the chart with the labelled census gap and notes the re-base in words", () => {
    expect(html).toContain('role="img"');
    expect(count(/data-testid="chart-break"/g)).toBe(1);
    expect(html).toContain("Census re-base");
    expect(html).toContain("226,000");
    expect(html).toContain("Geostat re-based the population to the 2024 census");
  });

  test("highlights Georgia in 2026 without any change figure", () => {
    expect(html).toContain('data-testid="population-highlights"');
    expect(html).toContain("1 January 2026 · based on the 2024 census");
    expect(html).toContain("Largest region");
    expect(html).toContain("Densest region");
    expect(html).toContain("Smallest municipality");
    expect(html).toContain("1,369,356");
    expect(html).not.toMatch(/[+−]\d+(\.\d+)?%/);
  });

  test("offers the Excel download and states the source", () => {
    expect(html).toContain('data-testid="population-excel-download"');
    expect(html).not.toMatch(/data-testid="population-excel-download"[^>]*disabled=""/);
    expect(html).toContain("Source: Geostat");
  });
});
