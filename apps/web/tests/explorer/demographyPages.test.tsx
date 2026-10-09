import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { SERIES } from "../../lib/data/demography/series";
import { populationHrefById } from "../../lib/explorer/demographyPlaceRoutes";
import { buildPopulationIndexModel } from "../../lib/explorer/demographyPopulationIndex";
import {
  demographyPageMetadata,
  renderDemographyPage,
} from "../../lib/pages/demography";
import { demographyMigrationPageMetadata, renderDemographyMigrationPage } from "../../lib/pages/demography-migration";
import {
  demographyPopulationPageMetadata,
  loadPopulationBasics,
  loadPopulationSources,
  renderDemographyPopulationPage,
} from "../../lib/pages/demography-population";

const GEORGIAN = /\p{Script=Georgian}/u;
// The methodology link closes the source sentence with a full stop, so the Boundaries credit the index appends starts a new one.
// Written without either language's words, so it holds for both.
const SENTENCE_CLOSED_BEFORE_BOUNDARIES = /\/methodology\/demography"[^>]*>[^<]+<\/a>\. [^<]+<a href="https:\/\/www\.openstreetmap\.org\/copyright"/;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

describe("demography hub page", () => {
  it("renders the four cards with a breadcrumb and no Georgian text in English", async () => {
    const html = renderToStaticMarkup(await renderDemographyPage("en"));
    expect(html).toContain('data-testid="demography-hub"');
    expect((html.match(/data-testid="hub-card"/g) ?? []).length).toBe(4);
    expect((html.match(/aria-disabled="true"/g) ?? []).length).toBe(2);
    expect(html).toContain('href="/en/explorer/demography/population"');
    expect(html).toContain('href="/en/explorer/demography/migration"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("has metadata that is canonical to its own language and reciprocal", async () => {
    const metadata = await demographyPageMetadata("en");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/demography");
    expect(metadata.alternates?.languages).toMatchObject({ ka: "https://fiscal.ge/explorer/demography", en: "https://fiscal.ge/en/explorer/demography" });
  });
});

const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;

describe("population index page", () => {
  it("hands the Population pages only population and density rows", async () => {
    const { facts, clientFacts } = await loadPopulationBasics("en");
    expect(facts).toHaveLength(1_068);
    expect(new Set(clientFacts.map((fact) => fact.seriesId))).toEqual(new Set([SERIES.populationTotal, SERIES.populationDensity]));
  });

  it("is the Budget index layout with population: map, four key figures, 64 and 12 rows, links to place pages, no button row", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    expect(html).toContain('data-testid="municipal-index-workspace"');
    expect(html).toContain('data-testid="municipality-map"');
    expect(count(html, /data-testid="index-kpi"/g)).toBe(4);
    expect(count(html, /data-testid="municipal-list-row"/g)).toBe(64);
    // The Regions list is in the markup too, hidden behind its tab: Georgia and the 11 regions.
    const regionList = html.slice(html.indexOf('data-testid="municipal-list-region"'), html.indexOf('data-testid="municipal-source-note"'));
    expect(count(regionList, /data-testid="municipal-row-name"/g)).toBe(12);
    expect(regionList).toContain('href="/en/explorer/demography/population/georgia"');
    expect(html).toContain("2004–2026 · as of 1 January");
    expect(html).toContain("persons, on 1 January");
    for (const text of ["3,941,103", "1,369,356", "2,715.7", "5,056", "Lentekhi", "Tbilisi · persons per km²"]) expect(html).toContain(text);
    expect(html).toContain("64 municipalities");
    expect(html).not.toMatch(/₾|GEL|per resident|Regional GDP/);
    expect(html).not.toContain("population-georgia-pill");
    expect(html).not.toContain("population-level-");
    expect(html).not.toContain("population-measure-");
  });

  it("links every row and the map to its own page, Tbilisi to the region page", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    for (const href of [
      "/en/explorer/demography/population/batumi",
      "/en/explorer/demography/population/khulo",
      "/en/explorer/demography/population/region/tbilisi",
      "/en/explorer/demography/population/region/adjara",
      "/en/explorer/demography/population/georgia",
    ]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("/explorer/municipalities/");
    expect(html).not.toContain('href="/en/explorer/demography/population/tbilisi"');
  });

  it("has an address for every map shape, map marker and row: a map click opens the page by code, so a missing key would open a Budget page", async () => {
    const { facts, municipal, places } = await loadPopulationBasics("en");
    const index = buildPopulationIndexModel({ facts, regions: municipal.regions, municipalities: municipal.municipalities });
    const addresses = populationHrefById(places);
    const codes = {
      "map shapes": index.map.shapes.map((shape) => shape.code),
      "map markers": index.map.markers.map((marker) => marker.code),
      rows: [index.country, ...index.regions, ...index.municipalities].map((row) => row.id),
    };
    for (const [name, ids] of Object.entries(codes)) {
      expect(ids.length, name).toBeGreaterThan(0);
      expect(ids.filter((id) => !Object.hasOwn(addresses, id)), name).toEqual([]);
    }
  });

  it("shows density under the region rows and the two notes under the map", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    expect(html).toContain("2,715.7/km²");
    expect(html).toContain("142.5/km²");
    expect(html).toContain("the map shows the latest year only");
    expect(html).toContain("504.24");
    expect(html).toContain("persons, 1 January 2026");
  });

  it("has a breadcrumb, the methodology link and no dataset markup, download or Georgian text in English", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).toContain('href="/en/methodology/demography"');
    expect(html).toMatch(SENTENCE_CLOSED_BEFORE_BOUNDARIES);
    expect(html).not.toMatch(GEORGIAN);
  });

  it("renders in Georgian with the same structure", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("ka"));
    expect(html).toContain('data-testid="municipal-index-workspace"');
    expect(html).toContain("2004–2026 · 1 იანვრის მდგომარეობით");
    expect(html).toContain("64 მუნიციპალიტეტი");
    expect(html).toContain('href="/explorer/demography/population/batumi"');
    expect(html).toContain('href="/methodology/demography"');
    expect(html).toMatch(SENTENCE_CLOSED_BEFORE_BOUNDARIES);
    expect(html).not.toMatch(/₾|მშპ|ერთ მოსახლეზე/);
  });

  it("has metadata with the page's own canonical address", async () => {
    const metadata = await demographyPopulationPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/population");
    expect(String(metadata.title)).toContain("მოსახლეობა");
  });
});

describe("migration page", () => {
  it("renders the heading, coverage, breadcrumb and the explorer, with no dataset markup", async () => {
    const html = renderToStaticMarkup(await renderDemographyMigrationPage("en"));
    expect(html).toContain(">Migration</h1>");
    expect(html).toContain("2012–2025 · annual");
    expect(html).toContain("persons per year");
    expect(html).toContain('data-testid="migration-explorer"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('"@type":"Dataset"');
    expect(html).toContain('href="/en/methodology/demography"');
  });

  it("has its own canonical address and title", async () => {
    const metadata = await demographyMigrationPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/migration");
    expect(String(metadata.title)).toBe("მიგრაცია — დემოგრაფია | Fiscal.ge");
  });
});

// The two Geostat originals listed in data/methodology/source-archives/demography.csv.
const REVIEWED_SOURCE_IDS = ["source.geostat_demography_density", "source.geostat_municipal_population"];

describe("population sources", () => {
  it("are the two reviewed demography sources in either language, each downloadable from the demography files", async () => {
    for (const locale of ["en", "ka"] as const) {
      const sources = await loadPopulationSources(locale);
      expect(sources, locale).toHaveLength(2);
      expect(sources.map((source) => source.sourceId).sort(), locale).toEqual(REVIEWED_SOURCE_IDS);
      for (const source of sources) expect(source.downloadHref, locale).toMatch(/^\/downloads\/methodology\/demography\/files\/[^/]+$/);
    }
  });

  it("carry no Georgian letters in English and Georgian titles in Georgian", async () => {
    for (const source of await loadPopulationSources("en")) {
      expect(source.title, source.sourceId).not.toMatch(GEORGIAN);
      expect(source.organization, source.sourceId).not.toMatch(GEORGIAN);
    }
    for (const source of await loadPopulationSources("ka")) expect(source.title, source.sourceId).toMatch(GEORGIAN);
  });
});
