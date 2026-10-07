import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { PopulationPlaceExplorer } from "../../components/demography/population-place-explorer";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { MUNICIPAL_COUNTRY_ID } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { populationHrefById } from "../../lib/explorer/demographyPlaceRoutes";
import { buildPopulationIndexModel } from "../../lib/explorer/demographyPopulationIndex";
import { pickerGroupsFromRows } from "../../lib/explorer/municipalData";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";

const GEORGIAN = /\p{Script=Georgian}/u;
let facts: ClientDemographyObservation[];
const presentations = {} as Record<Locale, Presentation>;
const placesBy = {} as Record<Locale, DemographyPlace[]>;
let index: ReturnType<typeof buildPopulationIndexModel>;

beforeAll(async () => {
  const [{ facts: served }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.map(projectDemographyObservation);
  index = buildPopulationIndexModel({ facts: served, regions: municipal.regions, municipalities: municipal.municipalities });
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((r) => r.id), ...municipal.municipalities.map((m) => m.code)];
  for (const locale of ["en", "ka"] as const) {
    presentations[locale] = await getPresentation(locale, ["demography", "common", "controls", "main", "format", "workbook", "municipal"], ids);
    placesBy[locale] = buildDemographyPlaces({
      regions: municipal.regions,
      municipalities: municipal.municipalities,
      englishLabels: presentations[locale].englishLabels,
      georgiaNameKa: "საქართველო",
    });
  }
});

function render(placeId: string, locale: Locale = "en", withNavigation = false, densityNote?: string, pageFacts: ClientDemographyObservation[] = facts): string {
  const places = placesBy[locale];
  const place = places.find((candidate) => candidate.id === placeId)!;
  return renderToStaticMarkup(
    <I18nProvider {...presentations[locale]}>
      <PopulationPlaceExplorer
        place={place}
        places={places}
        facts={pageFacts}
        title="Population —"
        metaLine="the meta line"
        navigation={withNavigation ? { prev: { label: "Before", href: "/a" }, next: { label: "After", href: "/b" } } : undefined}
        pickerCountry={{ id: MUNICIPAL_COUNTRY_ID, nameKa: "საქართველო", valueGel: index.country.valueGel, budgetCount: 64 }}
        pickerGroups={pickerGroupsFromRows(index)}
        pickerOverrides={{ hrefById: populationHrefById(places), valueFormat: "persons", countryDetail: "64 municipalities" }}
        sourceNote="Source: Geostat"
        densityNote={densityNote}
        sources={[]}
        siteOrigin="https://fiscal.ge"
        workbookScope="test"
        backHref="/explorer/demography/population"
      />
    </I18nProvider>,
  );
}
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;
const tagOf = (html: string, testId: string) => html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? "";
/** The tick-list rows in page order: the place id each row stands for and whether its toggle is pressed (ticked). */
const tickList = (html: string) =>
  [...html.matchAll(/data-testid="series-row"[^>]*data-series-id="([^"]+)"[\s\S]*?data-testid="series-row-toggle"[^>]*aria-pressed="(true|false)"/g)].map(
    (match) => ({ id: match[1]!, pressed: match[2] === "true" }),
  );

describe("place page body: Georgia", () => {
  const html = () => render(GEORGIA_PLACE_ID);

  test("the heading, the shell and the tick-list of Georgia and its 11 regions with Georgia ticked", () => {
    expect(html()).toContain('data-testid="entity-picker-trigger"');
    expect(html()).toContain("Population —");
    expect(html()).toContain('data-testid="population-place-workspace"');
    expect(count(html(), /data-testid="series-row"/g)).toBe(12);
    expect(html()).toMatch(/>1\s*\/\s*12</);
    expect(html()).toContain("3,941,103");
    expect(html()).toContain("1,369,356");
  });

  test("the chart draws the labelled census gap, the range strip marks it and the note says why", () => {
    expect(html()).toContain('role="img"');
    expect(tagOf(html(), "population-mode-line")).toContain('aria-pressed="true"');
    expect(count(html(), /data-testid="chart-break"/g)).toBe(1);
    expect(count(html(), /Census re-base/g)).toBeGreaterThanOrEqual(2);
    expect(html()).toContain("226,000");
    expect(html()).toContain("Geostat re-based the population to the 2024 census");
  });

  test("key indicators for Georgia, no change figure, an enabled download, the source and the way back", () => {
    expect(html()).toContain('data-testid="population-highlights"');
    expect(html()).toContain("Largest region");
    expect(html()).toContain("Densest region");
    expect(html()).toContain("Smallest municipality");
    expect(html()).not.toMatch(/[+−]\d+(\.\d+)?%/);
    expect(html()).toContain('data-testid="population-excel-download"');
    expect(html()).not.toMatch(/data-testid="population-excel-download"[^>]*disabled=""/);
    expect(html()).toContain("Source: Geostat");
    expect(html()).toContain('href="/en/explorer/demography/population"');
    expect(html()).toContain("← Population");
  });

  test("previous/next only when given", () => {
    expect(html()).not.toContain('data-testid="municipal-entity-navigation"');
    expect(render(GEORGIA_PLACE_ID, "en", true)).toContain('data-testid="municipal-entity-navigation"');
  });

  test("English carries no Georgian text", () => {
    expect(html()).not.toMatch(GEORGIAN);
  });
});

describe("place page body: a region, a municipality and Tbilisi", () => {
  test("Adjara: the tick-list is Adjara and its six municipalities, Adjara ticked", () => {
    const html = render("region.adjara");
    expect(count(html, /data-testid="series-row"/g)).toBe(7);
    expect(html).toMatch(/>1\s*\/\s*7</);
    for (const text of ["413,214", "246,267", "73,897", "16,098", "Batumi", "Khulo"]) expect(html).toContain(text);
    expect(html).toContain("Rank among regions");
    expect(html).toContain("Density");
  });

  test("Batumi: only itself in the tick-list, with its rank among 64 and its share of Adjara", () => {
    const html = render("06");
    expect(count(html, /data-testid="series-row"/g)).toBe(1);
    expect(html).toMatch(/>1\s*\/\s*1</);
    expect(html).toContain("Rank among municipalities");
    expect(html).toContain("/ 64");
    expect(html).toContain("246,267");
  });

  test("Tbilisi is a region with no parts", () => {
    const html = render("region.tbilisi");
    expect(count(html, /data-testid="series-row"/g)).toBe(1);
    expect(html).toContain("1,369,356");
    expect(html).toContain("Rank among regions");
  });

  test("the Georgian page uses the Georgian wording", () => {
    const html = render("06", "ka");
    expect(html).toContain("აღწერით გადათვლა");
    expect(html).toContain("ბათუმი");
  });

  test("English carries no Georgian text on a region or a municipality either", () => {
    for (const placeId of ["region.adjara", "06"]) expect(render(placeId), placeId).not.toMatch(GEORGIAN);
  });
});

// The page decides whether it shows a density and hands the note on; the section only places it.
describe("place page body: the density note", () => {
  const NOTE = "Stand-in density note: Tbilisi is 504.24 km².";

  test("sits directly under the highlights note, inside the highlights section, when the page hands it on", () => {
    const html = render("region.adjara", "en", false, NOTE);
    const section = html.slice(html.indexOf('data-testid="population-highlights"'));
    expect(tagOf(section, "population-density-note")).not.toBe("");
    expect(section).toContain(`>${NOTE}</p>`);
    const between = section.slice(section.indexOf("The indicators describe this place"), section.indexOf('data-testid="population-density-note"'));
    expect(between).not.toBe("");
    expect(between).not.toMatch(/<\/?(section|h2|ul|table)\b|data-testid=/);
    expect(count(html, /data-testid="population-density-note"/g)).toBe(1);
  });

  test("is not rendered when the page hands none on, for any level", () => {
    for (const placeId of [GEORGIA_PLACE_ID, "region.adjara", "06"]) expect(render(placeId), placeId).not.toContain("population-density-note");
  });
});

describe("place page body: the default selection", () => {
  // Only the place itself is drawn on arrival; its parts are listed below it, unticked.
  test.each([
    ["Georgia", GEORGIA_PLACE_ID],
    ["a region (Adjara)", "region.adjara"],
    ["a municipality (Batumi)", "06"],
  ])("%s: its own row comes first and is the only one ticked", (_label, placeId) => {
    const rows = tickList(render(placeId));
    expect(rows[0]).toEqual({ id: placeId, pressed: true });
    expect(rows.filter((row) => row.pressed).map((row) => row.id)).toEqual([placeId]);
  });
});

describe("place page body: the tick-list order", () => {
  // The page's own place is first by construction: the model ranks by value and forces only Georgia first, so a region
  // that has no value at the end of the range would otherwise sink below its parts. The real data cannot produce that
  // (a place's range is its own years), so the region's population facts are removed here and its parts keep theirs.
  test("a region with no value in the range still lists first, above parts that have one", () => {
    const withoutAdjara = facts.filter((fact) => !(fact.seriesId === SERIES.populationTotal && fact.geographyId === "region.adjara"));
    const html = render("region.adjara", "en", false, undefined, withoutAdjara);
    expect(html).toContain("246,267");
    const rows = tickList(html);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ id: "region.adjara", pressed: true });
    expect(rows.slice(1).every((row) => !row.pressed)).toBe(true);
  });
});

// The key indicators render for the first time through this component: the hero, its basis line and the side
// figures must describe the place the page is about, for the end of the range.
describe("place page body: the page describes its own place", () => {
  test("the period is the place's own: Georgia from 2004, a region and a municipality from 2015", () => {
    expect(render(GEORGIA_PLACE_ID)).toContain("Period 2004–2026");
    expect(render("region.adjara")).toContain("Period 2015–2026");
    expect(render("06")).toContain("Period 2015–2026");
  });

  test("Georgia: the hero with its basis, and the three side figures each naming its place", () => {
    const html = render(GEORGIA_PLACE_ID);
    for (const text of [
      "Population · Georgia",
      "1 January 2026 · based on the 2024 census",
      "Tbilisi · 34.7%",
      "2,715.7",
      "5,056",
      "Lentekhi",
    ]) expect(html).toContain(text);
  });

  test("a region and a municipality: the hero for that place, its share line and its rank", () => {
    const adjara = render("region.adjara");
    for (const text of ["Population · Adjara", "10.5% of Georgia", "rank 2 of 11"]) expect(adjara).toContain(text);
    expect(adjara).not.toContain("Population · Georgia");
    const batumi = render("06");
    for (const text of ["Population · Batumi", "59.6% of the region", "(Adjara)", "6.2%"]) expect(batumi).toContain(text);
    expect(batumi).not.toContain("Population · Georgia");
  });
});
