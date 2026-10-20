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
import { demographyBirthsDeathsPageMetadata, renderDemographyBirthsDeathsPage } from "../../lib/pages/demography-births-deaths";
import { demographyAgeSexPageMetadata, renderDemographyAgeSexPage } from "../../lib/pages/demography-age-sex";
import { demographyMarriagesDivorcesPageMetadata, renderDemographyMarriagesDivorcesPage } from "../../lib/pages/demography-marriages-divorces";
import {
  demographyPopulationPageMetadata,
  loadPopulationBasics,
  loadPopulationSources,
  renderDemographyPopulationPage,
} from "../../lib/pages/demography-population";
import { renderPageMarkup } from "../helpers/render-localized";

const GEORGIAN = /\p{Script=Georgian}/u;
// The methodology link closes the source sentence with a full stop, so the Boundaries credit the index appends starts a new one.
// Written without either language's words, so it holds for both.
const SENTENCE_CLOSED_BEFORE_BOUNDARIES = /\/methodology\/demography"[^>]*>[^<]+<\/a>\. [^<]+<a href="https:\/\/www\.openstreetmap\.org\/copyright"/;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

describe("demography hub page", () => {
  it("renders the five cards with a breadcrumb and no Georgian text in English", async () => {
    const html = renderPageMarkup("en", await renderDemographyPage("en"));
    expect(html).toContain('data-testid="demography-hub"');
    expect((html.match(/data-testid="hub-card"/g) ?? []).length).toBe(5);
    expect((html.match(/aria-disabled="true"/g) ?? []).length).toBe(0);
    expect(html).toContain('href="/en/explorer/demography/population"');
    expect(html).toContain('href="/en/explorer/demography/age-sex"');
    expect(html).toContain('href="/en/explorer/demography/migration"');
    expect(html).toContain('href="/en/explorer/demography/births-deaths"');
    expect(html).toContain('href="/en/explorer/demography/marriages-divorces"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("links the five pages in order in Georgian, without the /en prefix", async () => {
    const html = renderPageMarkup("ka", await renderDemographyPage("ka"));
    const hub = html.slice(html.indexOf('data-testid="demography-hub"'));
    expect((hub.match(/data-testid="hub-card"/g) ?? []).length).toBe(5);
    expect([...hub.matchAll(/href="([^"]+)"/g)].map((match) => match[1]).slice(0, 5)).toEqual(
      ["population", "age-sex", "migration", "births-deaths", "marriages-divorces"].map((page) => `/explorer/demography/${page}`),
    );
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
    const html = renderPageMarkup("en", await renderDemographyPopulationPage("en"));
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
    const html = renderPageMarkup("en", await renderDemographyPopulationPage("en"));
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
    const html = renderPageMarkup("en", await renderDemographyPopulationPage("en"));
    expect(html).toContain("2,715.7/km²");
    expect(html).toContain("142.5/km²");
    expect(html).toContain("the map shows the latest year only");
    expect(html).toContain("504.24");
    expect(html).toContain("persons, 1 January 2026");
  });

  it("has a breadcrumb, the methodology link and no dataset markup, download or Georgian text in English", async () => {
    const html = renderPageMarkup("en", await renderDemographyPopulationPage("en"));
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).toContain('href="/en/methodology/demography"');
    expect(html).toMatch(SENTENCE_CLOSED_BEFORE_BOUNDARIES);
    expect(html).not.toMatch(GEORGIAN);
  });

  it("renders in Georgian with the same structure", async () => {
    const html = renderPageMarkup("ka", await renderDemographyPopulationPage("ka"));
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
    const html = renderPageMarkup("en", await renderDemographyMigrationPage("en"));
    expect(html).toContain(">Migration</h1>");
    expect(html).toContain("2012–2025 · annual");
    expect(html).toContain("Annual migration by citizenship");
    expect(html).not.toContain("persons per year");
    expect(html).toContain('data-testid="migration-explorer"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('"@type":"Dataset"');
    expect(html).toContain('href="/en/methodology/demography"');
  });

  it("renders in Georgian with its heading, coverage and net line", async () => {
    const html = renderPageMarkup("ka", await renderDemographyMigrationPage("ka"));
    expect(html).toContain(">მიგრაცია</h1>");
    expect(html).toContain("2012–2025 · წლიური");
    expect(html).toContain("წმინდა მიგრაცია");
  });

  it("has no Georgian in the English page or its metadata", async () => {
    const html = renderPageMarkup("en", await renderDemographyMigrationPage("en"));
    expect(html).not.toMatch(GEORGIAN);
    const metadata = await demographyMigrationPageMetadata("en");
    expect(String(metadata.title)).not.toMatch(GEORGIAN);
    expect(String(metadata.description)).not.toMatch(GEORGIAN);
  });

  it("has its own canonical address and title", async () => {
    const metadata = await demographyMigrationPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/migration");
    expect(String(metadata.title)).toBe("მიგრაცია — დემოგრაფია | Fiscal.ge");
  });
});

describe("births and deaths page", () => {
  it("renders the places block, fertility and life expectancy, with no dataset markup", async () => {
    const html = renderPageMarkup("en", await renderDemographyBirthsDeathsPage("en"));
    expect(html).toContain(">Births, deaths and fertility</h1>");
    expect(html).toContain("2014–2025 · annual");
    expect(html).toContain("Births per 100 deaths, 2025");
    expect(html).toContain("53 of 64");
    expect(html).toContain('href="/en/explorer/demography/population/batumi#births-deaths"');
    expect(html).toContain('href="/en/explorer/demography/population/region/tbilisi#births-deaths"');
    expect(html).toContain('data-testid="fertility-section"');
    expect(html).toContain('data-testid="life-section"');
    expect(html).toContain('aria-label="Total fertility rate, Georgia, 2014–2025"');
    expect(html).toContain('aria-label="Births per 1,000 women by mother&#x27;s age, one line per year, 2014–2025"');
    expect(html).toContain('aria-label="Life expectancy at birth, total, men and women, Georgia, 2014–2025"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('"@type":"Dataset"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("has its own canonical address and title", async () => {
    const metadata = await demographyBirthsDeathsPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/births-deaths");
    expect(String(metadata.title)).toBe("შობადობა, სიკვდილიანობა და ნაყოფიერება — დემოგრაფია | Fiscal.ge");
  });
});

describe("marriages and divorces page", () => {
  it("renders one latest line and no paragraph under the heading, the explorer, then the places block, with no dataset markup or Georgian in English", async () => {
    const html = renderPageMarkup("en", await renderDemographyMarriagesDivorcesPage("en"));
    expect(html).toContain(">Marriages and divorces</h1>");
    const heading = html.slice(html.indexOf(">Marriages and divorces</h1>"), html.indexOf('data-testid="chart-panel"'));
    expect((heading.match(/data-testid="marriage-latest"/g) ?? []).length).toBe(1);
    // The latest line is itself the one paragraph there.
    expect((heading.match(/<p[ >]/g) ?? []).length).toBe(1);
    expect(html).toContain("22,285");
    expect(html.indexOf('data-testid="marriage-explorer"')).toBeLessThan(html.indexOf('href="/en/explorer/demography/population/georgia#marriages-divorces"'));
    expect(html).toContain('href="/en/explorer/demography/population/region/tbilisi#marriages-divorces"');
    expect(html).toContain('href="/en/explorer/demography/population/kazbegi#marriages-divorces"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('"@type":"Dataset"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("links the Georgian map rows without the /en prefix", async () => {
    const html = renderPageMarkup("ka", await renderDemographyMarriagesDivorcesPage("ka"));
    expect(html).toContain('href="/explorer/demography/population/georgia#marriages-divorces"');
  });

  it("has its own canonical address and title", async () => {
    const metadata = await demographyMarriagesDivorcesPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/marriages-divorces");
    expect(String(metadata.title)).toBe("ქორწინება და განქორწინება — დემოგრაფია | Fiscal.ge");
    expect(String((await demographyMarriagesDivorcesPageMetadata("en")).description)).not.toMatch(GEORGIAN);
  });
});

describe("age and sex page", () => {
  it("renders the pyramid, the heat map and a regional glance, in that order, with no dataset markup or Georgian in English", async () => {
    const html = renderPageMarkup("en", await renderDemographyAgeSexPage("en"));
    expect(html).toContain(">Age and sex</h1>");
    expect(html).toContain("2004–2026 · annual, and the 2024 census");
    expect(html).toContain("31.2%");
    expect(html).toContain("13.1%");
    const at = (testId: string) => html.indexOf(`data-testid="${testId}"`);
    expect(at("age-sex-pyramid")).toBeGreaterThan(-1);
    expect(at("age-sex-pyramid")).toBeLessThan(at("age-sex-heatmap"));
    expect(at("age-sex-heatmap")).toBeLessThan(at("age-sex-region-map"));
    expect(html).not.toContain('data-testid="age-sex-bands"');
    expect(html).toContain('href="/en/methodology/demography"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('"@type":"Dataset"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("opens on two year pickers, the latest year and no comparison, with no year rows and no pyramid table switch", async () => {
    const html = renderPageMarkup("en", await renderDemographyAgeSexPage("en"));
    const trigger = (testId: string) => html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>.*?</button>`, "s"))?.[0] ?? "";
    const year = trigger("age-sex-year-select");
    expect(year).toContain('aria-haspopup="listbox"');
    expect(year).toContain('aria-expanded="false"');
    expect(year).toContain(">2026<");
    const compare = trigger("age-sex-compare-select");
    expect(compare).toContain('aria-haspopup="listbox"');
    expect(compare).toContain(">None<");
    const pyramid = html.slice(html.indexOf('data-testid="age-sex-pyramid"'), html.indexOf('data-testid="age-sex-heatmap"'));
    expect(pyramid).not.toContain("<select");
    expect(pyramid).not.toContain('role="listbox"');
    for (const gone of ["age-sex-year-row", "age-sex-compare-row", "age-sex-compare-toggle", "age-sex-pyramid-mode-line", "age-sex-pyramid-mode-table"]) {
      expect(html).not.toContain(`data-testid="${gone}"`);
    }
  });

  it("shows the regional glance without a single link to a region page", async () => {
    const html = renderPageMarkup("en", await renderDemographyAgeSexPage("en"));
    expect(html).not.toContain('#age-sex"');
    expect(html).not.toContain("/explorer/demography/population/region/");
  });

  it("has no Georgian in the English metadata, and its own canonical address and title", async () => {
    const en = await demographyAgeSexPageMetadata("en");
    expect(String(en.title)).not.toMatch(GEORGIAN);
    expect(String(en.description)).not.toMatch(GEORGIAN);
    const metadata = await demographyAgeSexPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/age-sex");
    expect(String(metadata.title)).toBe("ასაკი და სქესი — დემოგრაფია | Fiscal.ge");
  });
});

// The twenty Geostat originals listed in data/methodology/source-archives/demography.csv.
const REVIEWED_SOURCE_IDS = [
  "source.geostat_census2024_population_by_age_settlement",
  "source.geostat_demography_births",
  "source.geostat_demography_crude_birth_rate",
  "source.geostat_demography_crude_death_rate",
  "source.geostat_demography_deaths",
  "source.geostat_demography_density",
  "source.geostat_demography_divorces",
  "source.geostat_demography_fertility",
  "source.geostat_demography_infant_mortality",
  "source.geostat_demography_life_expectancy",
  "source.geostat_demography_marriage_duration",
  "source.geostat_demography_marriages",
  "source.geostat_demography_mean_age_divorced",
  "source.geostat_demography_mean_age_spouses",
  "source.geostat_demography_migration_citizenship",
  "source.geostat_demography_natural_increase",
  "source.geostat_demography_net_migration",
  "source.geostat_demography_population_age_sex",
  "source.geostat_demography_population_mid_year",
  "source.geostat_municipal_population",
];

describe("population sources", () => {
  it("are the twenty reviewed demography sources in either language, each downloadable from the demography files", async () => {
    for (const locale of ["en", "ka"] as const) {
      const sources = await loadPopulationSources(locale);
      expect(sources, locale).toHaveLength(20);
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
