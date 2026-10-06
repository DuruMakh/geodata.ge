import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test } from "vitest";
import { RegionalEconomyMap } from "../../components/regional-economies/regional-economy-map";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { formatAmount } from "../../lib/explorer/format";
import { buildRegionValueMapModel, type RegionalEconomyMapModel } from "../../lib/explorer/regionalEconomyMap";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Presentation } from "../../lib/i18n/types";

let regions: MunicipalRegion[];
let values: Map<string, number>;
let model: RegionalEconomyMapModel;
let presentation: Presentation;
const display = (_regionId: string, value: number) => `${value} persons`;

beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  regions = municipal.regions;
  values = new Map(
    facts
      .filter((fact) => fact.seriesId === SERIES.populationTotal && fact.year === 2026 && fact.geographyId.startsWith("region."))
      .map((fact) => [fact.geographyId, fact.value]),
  );
  model = buildRegionValueMapModel({ values, regions, year: 2026, display });
  presentation = await getPresentation("en", ["regionalEconomies"], regions.map((region) => region.id));
});

describe("buildRegionValueMapModel", () => {
  test("ranks the eleven regions by the plotted value and keeps the page's own text", () => {
    expect(model.year).toBe(2026);
    expect(model.regions).toHaveLength(11);
    expect(model.regions[0]).toMatchObject({ regionId: "region.tbilisi", totalGdpGel: 1_369_356, rank: 1, display: "1369356 persons" });
    expect(model.regions.every((region) => region.pathD.length > 0 && region.bucket >= 0 && region.bucket <= 5)).toBe(true);
    expect(model.occupiedAreas).toHaveLength(2);
    expect(model.legendMinGel).toBe(Math.min(...values.values()));
    expect(model.legendMaxGel).toBe(Math.max(...values.values()));
  });

  test("rejects a missing, unknown or non-positive value", () => {
    const without = new Map([...values].filter(([id]) => id !== "region.guria"));
    expect(() => buildRegionValueMapModel({ values: without, regions, year: 2026, display })).toThrow(/Missing map value for region\.guria/);
    expect(() => buildRegionValueMapModel({ values: new Map([...values, ["region.mars", 5]]), regions, year: 2026, display })).toThrow(/unknown region region\.mars/);
    expect(() => buildRegionValueMapModel({ values: new Map([...values, ["region.guria", 0]]), regions, year: 2026, display })).toThrow(/Invalid map value for region\.guria/);
  });
});

describe("RegionalEconomyMap choosing mode", () => {
  const render = (props: Partial<Parameters<typeof RegionalEconomyMap>[0]> = {}) =>
    renderToStaticMarkup(
      <I18nProvider {...presentation}>
        <RegionalEconomyMap model={model} activeRegionId={null} onActiveRegionChange={() => {}} {...props} />
      </I18nProvider>,
    );
  const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;

  test("makes every region a button, outlines the chosen ones and uses the page's wording", () => {
    const html = render({
      onSelect: () => {},
      selectedIds: ["region.imereti"],
      wording: { groupAria: "Population map", legendMin: "min text", legendMax: "max text", legendCaption: "persons, 1 January 2026" },
    });
    expect(count(html, /data-region-map-target=""/g)).toBe(11);
    expect(count(html, /role="button"/g)).toBe(11);
    expect(html).not.toContain("/explorer/economy/regions/");
    expect(count(html, /aria-pressed="true"/g)).toBe(1);
    expect(count(html, /data-testid="regional-map-chosen"/g)).toBe(1);
    expect(html).toContain('aria-label="Population map"');
    expect(html).toContain("min text");
    expect(html).toContain("max text");
    expect(html).toContain("persons, 1 January 2026");
    expect(html).toContain('aria-label="Imereti, ');
    expect(html).not.toContain("Regional GDP");
  });

  test("without the new props it is still eleven links to the region pages", () => {
    const html = render();
    expect(count(html, /href="\/en\/explorer\/economy\/regions\//g)).toBe(11);
    expect(html).toContain('href="/en/explorer/economy/regions/imereti"');
    expect(count(html, /role="button"/g)).toBe(0);
    expect(count(html, /aria-pressed/g)).toBe(0);
    expect(count(html, /data-testid="regional-map-chosen"/g)).toBe(0);
  });

  test("a region button in choosing mode shows the pointer cursor, as the municipality map's targets do", () => {
    // A link shows the pointer by itself; a button made from an SVG anchor with no href does not.
    const targets = render({ onSelect: () => {} }).match(/<a [^>]*data-region-map-target=""[^>]*>/g) ?? [];
    expect(targets).toHaveLength(11);
    expect(targets.every((tag) => tag.includes('class="cursor-pointer"'))).toBe(true);
  });

  test("the tooltip prints the region's own text, its value with its unit, and never a GEL amount or a year", () => {
    const imereti = model.regions.find((region) => region.regionId === "region.imereti")!;
    const html = render({ onSelect: () => {}, activeRegionId: "region.imereti" });
    const tooltip = html.match(/<div role="tooltip" data-testid="regional-map-tooltip"[^>]*>(.*?)<\/div>/)?.[1] ?? "";
    expect([...tooltip.matchAll(/<span[^>]*>(.*?)<\/span>/g)].map((match) => match[1])).toEqual(["Imereti", imereti.display]);
    expect(tooltip).not.toContain(formatAmount(imereti.totalGdpGel, "en"));
    expect(tooltip).not.toMatch(new RegExp(`\\b${model.year}\\b`));
  });
});
