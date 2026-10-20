import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, test, vi } from "vitest";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import sitemap from "../../lib/seo/sitemap";
import { MUNICIPALITY_ROUTES } from "../../lib/explorer/municipalityRoutes";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../../lib/data/servedData";
import { loadServedRegionalEconomyData } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { loadServedTradeOverviewData } from "../../lib/data/tradeOverview/importTradeOverview";
import { loadServedTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { loadServedTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { loadServedTradeDomesticData } from "../../lib/data/tradeDomestic/importTradeDomestic";
import { loadServedTradeServicesData } from "../../lib/data/tradeServices/importTradeServices";
import { loadServedTradeCompositionData } from "../../lib/data/tradeComposition/importTradeComposition";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { loadServedProductData } from "../../lib/data/inflation/importProducts";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedGdpOverviewData } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData } from "../../lib/data/economicSectors/importEconomicSectors";
import { loadServedGdpExpenditureData } from "../../lib/data/gdpExpenditure/importGdpExpenditure";
import {
  aggregateFactsForEntity,
  applyAdjaraBudgetAdjustment,
  latestReviewedAtForMunicipalFacts,
  regionFactsFor,
} from "../../lib/explorer/municipalData";
import { populationPlacePaths } from "../../lib/explorer/demographyPlaceRoutes";
import { DEMOGRAPHY_PAGES } from "../../lib/explorer/demographyRoutes";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { loadPageRevisions } from "../../lib/i18n/page-revisions.server";
import { pageHref, splitLanguagePath } from "../../lib/i18n/routes";
import { currentEntry, isActivePath, openHub, sourceNoteKey } from "../../lib/navigation/navTree";
import { inflationProductsMetadata } from "../../lib/pages/inflation-products";
import { municipalEntityHref } from "../../lib/seo/internalLinks";

const llmsPath = fileURLToPath(new URL("../../public/llms.txt", import.meta.url));
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("indexable Fiscal.ge routes", () => {
  it("builds canonical debt metadata from actual stock coverage", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const metadataModule = await import("../../lib/seo/metadata") as Record<string, unknown>;
    const internalLinks = await import("../../lib/seo/internalLinks") as Record<string, unknown>;

    expect(internalLinks.DEBT_EXPLORER_PATH).toBe("/explorer/debt");
    expect(internalLinks.DEFICIT_EXPLORER_PATH).toBe("/explorer/deficit");
    expect(typeof metadataModule.governmentDebtMetadata).toBe("function");
    expect(typeof metadataModule.generalGovernmentDeficitMetadata).toBe("function");
    if (typeof metadataModule.governmentDebtMetadata !== "function") return;

    const metadata = metadataModule.governmentDebtMetadata([
      { year: 2013, family: "stock", status: "actual" },
      { year: 2025, family: "stock", status: "actual" },
      { year: 2030, family: "service", status: "projection_existing_portfolio" },
    ]) as { title?: string; alternates?: { canonical?: string } };

    expect(metadata.title).toContain("2013–2025");
    expect(metadata.title).not.toContain("2030");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/debt");

    if (typeof metadataModule.generalGovernmentDeficitMetadata !== "function") return;
    const deficitMetadata = metadataModule.generalGovernmentDeficitMetadata([
      { year: 1995, status: "actual" },
      { year: 2025, status: "actual" },
      { year: 2031, status: "projection" },
    ]) as { title?: string; alternates?: { canonical?: string } };
    expect(deficitMetadata.title).toContain("1995–2025");
    expect(deficitMetadata.title).not.toContain("2031");
    expect(deficitMetadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/deficit");
  });

  // The first sitemap() call loads every dataset: about 8s alone, 39s once on a loaded 4-core box.
  it("publishes the exact unique Fiscal.ge HTML inventory", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    // Regional economies add a bilingual index, eleven bilingual detail pages
    // and one bilingual methodology page; inflation categories and products
    // add bilingual identities, and the inflation cities page and its six city
    // pages add seven more bilingual pairs (the Georgia page plus one per city).
    // The four unemployment data pages add four bilingual pairs behind their hub.
    // The trade hub, the trade overview and the trade methodology add three more pairs.
    // The demography methodology adds one more, and the demography hub and
    // Population page add two more bilingual pairs; the 75 Population place
    // pages (Georgia, 11 regions and 63 municipalities) add 75 more pairs.
    // Trading partners and Products each add one further bilingual pair.
    // The Migration page adds one more bilingual pair, and so do the Births, deaths and fertility page
    // and the Age and sex page.
    // Wages adds its hub, three pages, 11 region pages and methodology page: 16 bilingual pairs.
    // External flows adds its hub, Money from abroad and its methodology, each in both languages.
    // Domestic exports adds one further bilingual pair.
    // Poverty adds its hub, two pages and methodology page: 4 bilingual pairs.
    // Living standards replaces the Poverty hub and adds Income and Spending: 2 more bilingual pairs.
    // The Household income and spending methodology adds one more bilingual pair.
    // Income and Spending add a page for Georgia and each of the 11 regions: 24 more bilingual pairs.
    // Energy and food adds its hub, four pages and methodology page: 6 bilingual pairs.
    // Money and banks adds its hub, four pages and methodology page: 6 bilingual pairs.
    // Services trade adds one further bilingual pair.
    // Trade composition adds one further bilingual pair.
    // Health adds its hub, three pages and a causes-of-death page for Georgia and each of the 11 regions: 16 bilingual pairs.
    // The Health methodology adds one more bilingual pair.
    // Foreign debt and Reserves add two further bilingual pairs.
    // Business adds its hub, five pages, a page for Georgia and each of the 11 regions and its methodology page: 19 bilingual pairs; Health its hub, three pages, 12 area pages and its methodology page: 17 more.
    // Crime and justice adds its hub and five pages: 6 bilingual pairs; its methodology one more.
    // Housing adds its hub, four pages and a page for Georgia and each of the 11 regions: 17 bilingual pairs.
    // The Housing methodology adds one more bilingual pair.
    // Education adds its hub, four pages, the 75 Schools and 75 Kindergartens place pages and its methodology page: 156 bilingual pairs.
    // Science and culture adds its hub, four pages, a Museums page for Georgia and each of the 11 regions and its methodology page: 18 bilingual pairs.
    // Environment and climate adds its hub, seven pages, nine city pages, a Waste and a Forests page for Georgia and each of the 11 regions and its methodology page: 42 bilingual pairs.
    // Unemployment adds four Labour Force Survey detail pages (industries, hours, informal, young people): 4 bilingual pairs.
    // Farming adds one Energy and food page: 1 bilingual pair. GDP by expenditure adds its page and methodology page: 2 more.
    // Marriages and divorces adds one demography page: one bilingual pair.
    // Transport adds its hub, five pages, a page for Georgia and each of the 11 regions and its methodology page: 19 bilingual pairs.
    // Internet and technology adds its hub, four pages, a page for Georgia and each of the 11 regions and its methodology page: 18 bilingual pairs.
    expect(urls).toHaveLength(1230);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.startsWith("https://fiscal.ge/"))).toBe(true);
    expect(urls).toContain("https://fiscal.ge/about");
    expect(urls).toContain("https://fiscal.ge/connect");
    expect(urls).toContain("https://fiscal.ge/explorer/debt");
    expect(urls).toContain("https://fiscal.ge/explorer/deficit");
    expect(urls).toContain("https://fiscal.ge/explorer/trade/partners");
    expect(urls).toContain("https://fiscal.ge/en/explorer/trade/partners");
    for (const page of ["", "/overview", "/industries", "/regions"]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/wages${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/wages${page}`);
    }
    expect(urls).toContain("https://fiscal.ge/en/methodology/wages");
    expect(urls).toContain("https://fiscal.ge/en/methodology/poverty");
    expect(urls).toContain("https://fiscal.ge/methodology/money");
    expect(urls).toContain("https://fiscal.ge/en/methodology/money");
    expect(urls).toContain("https://fiscal.ge/methodology/business");
    expect(urls).toContain("https://fiscal.ge/en/methodology/business");
    expect(urls).toContain("https://fiscal.ge/methodology/housing");
    expect(urls).toContain("https://fiscal.ge/en/methodology/housing");
    expect(urls).toContain("https://fiscal.ge/methodology/education");
    expect(urls).toContain("https://fiscal.ge/en/methodology/education");
    expect(urls).toContain("https://fiscal.ge/methodology/science-culture");
    expect(urls).toContain("https://fiscal.ge/en/methodology/science-culture");
    expect(urls).toContain("https://fiscal.ge/methodology/transport");
    expect(urls).toContain("https://fiscal.ge/en/methodology/transport");
    expect(urls).toContain("https://fiscal.ge/explorer/wages/regions/adjara");
    for (const page of ["", "/income", "/spending", "/poverty", "/inequality"]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/living-standards${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/living-standards${page}`);
    }
    for (const section of ["income", "spending"]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/living-standards/${section}/regions/guria`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/living-standards/${section}/regions/guria`);
      expect(urls).toContain(`https://fiscal.ge/explorer/living-standards/${section}/regions/georgia`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/living-standards/${section}/regions/georgia`);
    }
    expect(urls.some((url) => url.includes("/explorer/poverty"))).toBe(false);
    for (const page of ["", "/energy-supply", "/electricity", "/energy-use", "/food-self-sufficiency", "/farming"]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/energy-food${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/energy-food${page}`);
    }
    for (const page of ["", "/doctors-hospitals", "/illnesses", "/causes-of-death", "/causes-of-death/regions/georgia", "/causes-of-death/regions/guria", "/causes-of-death/regions/racha_lechkhumi_kvemo_svaneti"]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/health${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/health${page}`);
    }
    expect(urls.filter((url) => url.includes("/explorer/health/causes-of-death/regions/"))).toHaveLength(24);
    for (const page of ["", "/recorded", "/convictions", "/prisons", "/victims", "/road-accidents"]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/crime${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/crime${page}`);
    }
    for (const page of ["", "/supply", "/loans-deposits", "/interest-rates", "/bank-health"]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/money${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/money${page}`);
    }
    const businessAreas = ["georgia", "tbilisi", "adjara", "guria", "imereti", "kakheti", "mtskheta_mtianeti", "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti", "kvemo_kartli", "shida_kartli"];
    for (const page of ["", "/sales", "/jobs", "/investment-profit", "/firms", "/regions", ...businessAreas.map(area => `/regions/${area}`)]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/business${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/business${page}`);
    }
    for (const page of ["", "/permits", "/completed", "/prices", "/regions", ...businessAreas.map(area => `/regions/${area}`)]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/housing${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/housing${page}`);
    }
    expect(urls.filter((url) => url.includes("/explorer/housing"))).toHaveLength(34);
    for (const page of ["", "/homes", "/users", "/online", "/devices", ...businessAreas.map(area => `/homes/${area}`)]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/internet${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/internet${page}`);
    }
    expect(urls.filter((url) => url.includes("/explorer/internet"))).toHaveLength(34);
    expect(urls).toContain("https://fiscal.ge/methodology/internet");
    expect(urls).toContain("https://fiscal.ge/en/methodology/internet");
    for (const page of ["", "/vehicles", "/vehicle-age", "/passengers", "/freight", "/regions", ...businessAreas.map(area => `/regions/${area}`)]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/transport${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/transport${page}`);
    }
    expect(urls.filter((url) => url.includes("/explorer/transport"))).toHaveLength(36);
    const educationRegions = ["tbilisi", "adjara", "guria", "imereti", "kakheti", "mtskheta_mtianeti", "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti", "kvemo_kartli", "shida_kartli"];
    for (const page of ["", "/universities", "/vocational", ...["schools", "kindergartens"].flatMap(set => [`/${set}`, `/${set}/georgia`, ...educationRegions.map(region => `/${set}/region/${region}`), `/${set}/batumi`, `/${set}/ozurgeti`])]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/education${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/education${page}`);
    }
    // Each set: Georgia, the 11 regions and the 63 municipalities other than Tbilisi, which is a region; never a municipality code.
    for (const set of ["schools", "kindergartens"]) {
      expect(urls.filter(url => url.startsWith(`https://fiscal.ge/explorer/education/${set}/`))).toHaveLength(75);
      expect(urls).not.toContain(`https://fiscal.ge/explorer/education/${set}/tbilisi`);
    }
    expect(urls.some(url => /\/explorer\/education\/.*\/\d{2}$/.test(url))).toBe(false);
    for (const page of ["", "/research", "/patents", "/museums", "/theatres", ...businessAreas.map(area => `/museums/${area}`)]) {
      expect(urls).toContain(`https://fiscal.ge/explorer/science-culture${page}`);
      expect(urls).toContain(`https://fiscal.ge/en/explorer/science-culture${page}`);
    }
    expect(urls.filter((url) => url.includes("/explorer/science-culture"))).toHaveLength(34);
    expect(urls).toContain("https://fiscal.ge/explorer/trade/products");
    expect(urls).toContain("https://fiscal.ge/en/explorer/trade/products");
    expect(urls).toContain("https://fiscal.ge/explorer/trade/domestic-exports");
    expect(urls).toContain("https://fiscal.ge/en/explorer/trade/domestic-exports");
    expect(urls).toContain("https://fiscal.ge/explorer/trade/services");
    expect(urls).toContain("https://fiscal.ge/en/explorer/trade/services");
    expect(urls).toContain("https://fiscal.ge/explorer/trade/composition");
    expect(urls).toContain("https://fiscal.ge/en/explorer/trade/composition");
    for (const route of ["/explorer/external", "/explorer/external/money-from-abroad", "/explorer/external/foreign-investment", "/explorer/external/current-account", "/explorer/external/foreign-debt", "/explorer/external/reserves", "/methodology/external-flows"]) {
      expect(urls).toContain(`https://fiscal.ge${route}`);
      expect(urls).toContain(`https://fiscal.ge/en${route}`);
    }
    expect(urls).toContain("https://fiscal.ge/explorer/economy/regions");
    expect(urls).toContain("https://fiscal.ge/en/explorer/economy/regions/imereti");
    expect(urls).toContain("https://fiscal.ge/methodology/debt");
    expect(urls).toContain("https://fiscal.ge/explorer/demography/age-sex");
    expect(urls).toContain("https://fiscal.ge/en/explorer/demography/age-sex");
    expect(urls.some((url) => url.includes("#") || url.includes("?"))).toBe(false);
    // Exactly the live methodology routes, in the hub's order.
    expect(urls.map((url) => new URL(url).pathname).filter((pathname) => pathname === "/methodology" || pathname.startsWith("/methodology/"))).toEqual([
      "/methodology",
      "/methodology/expenditure",
      "/methodology/revenue",
      "/methodology/municipalities",
      "/methodology/debt",
      "/methodology/gdp",
      "/methodology/economic-sectors",
      "/methodology/gdp-expenditure",
      "/methodology/regional-economies",
      "/methodology/business",
      "/methodology/housing",
      "/methodology/inflation",
      "/methodology/money",
      "/methodology/unemployment",
      "/methodology/wages",
      "/methodology/poverty",
      "/methodology/household-income",
      "/methodology/health",
      "/methodology/education",
      "/methodology/science-culture",
      "/methodology/crime",
      "/methodology/internet",
      "/methodology/trade",
      "/methodology/external-flows",
      "/methodology/energy-food",
      "/methodology/environment",
      "/methodology/transport",
      "/methodology/demography",
    ]);
  }, 90_000);

  it("publishes municipality slugs and never the numeric source identities", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const urls = (await sitemap()).map((entry) => entry.url);
    const municipalityUrls = urls.filter((url) => /^https:\/\/fiscal\.ge\/explorer\/municipalities\/(?!georgia$|region\/)/.test(url));

    expect(municipalityUrls).toEqual(
      MUNICIPALITY_ROUTES.map(({ slug }) => `https://fiscal.ge/explorer/municipalities/${slug}`),
    );
    expect(municipalityUrls.some((url) => /\/\d{2}$/.test(url))).toBe(false);
  });
});

// The unit tests that read the whole sitemap live in this file, so `npm test` builds it once instead of once per
// file: building it loads every served dataset, 13-14 s for each file that did. (tests/seo/structuredData.test.ts
// still builds its own, because it renders every page and loads the same data anyway.) Each block below names the
// file it came from; its assertions are unchanged.

// From tests/explorer/unemploymentPage.test.tsx.
describe("unemployment discovery", () => {
  test("localization and sitemap discover the explorer and its methodology in both languages", async () => {
    const paths = await listPublicPagePaths(); expect(paths).toContain("/explorer/unemployment"); expect(paths).toContain("/methodology/unemployment");
    const entries = await sitemap();
    for (const path of ["/explorer/unemployment", "/en/explorer/unemployment", "/methodology/unemployment", "/en/methodology/unemployment"]) expect(entries.some(entry => entry.url.endsWith(path))).toBe(true);
    for (const section of ["overview", "regions", "age", "gender", "industries", "hours", "informal", "young-people"]) {
      expect(paths).toContain(`/explorer/unemployment/${section}`);
      for (const prefix of ["", "/en"]) expect(entries.some(entry => entry.url.endsWith(`${prefix}/explorer/unemployment/${section}`))).toBe(true);
    }
  });
});

// From tests/explorer/demographyDiscovery.test.ts.
const PAGES = [
  "/explorer/demography",
  "/explorer/demography/population",
  "/explorer/demography/age-sex",
  "/explorer/demography/migration",
  "/explorer/demography/births-deaths",
  "/explorer/demography/marriages-divorces",
  "/methodology/demography",
] as const;

// What "indexed in both languages" means, in one place: the page is in the public inventory, has a real English
// review date, and its Georgian and English sitemap rows name each other. The path is in every message, so a failure
// names the page.
async function expectIndexedInBothLanguages(pagePaths: readonly string[]): Promise<void> {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
  try {
    const [paths, revisions, entries] = await Promise.all([listPublicPagePaths(), loadPageRevisions(), sitemap()]);
    for (const path of pagePaths) {
      expect(paths, path).toContain(path);
      expect(revisions[path], path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const ka = entries.find((entry) => entry.url === `https://fiscal.ge${path}`);
      const en = entries.find((entry) => entry.url === `https://fiscal.ge/en${path}`);
      expect(ka?.alternates?.languages, path).toEqual({
        ka: `https://fiscal.ge${path}`,
        en: `https://fiscal.ge/en${path}`,
        "x-default": `https://fiscal.ge${path}`,
      });
      expect(en?.alternates, path).toEqual(ka?.alternates);
    }
  } finally {
    vi.unstubAllEnvs();
  }
}

describe("demography discovery", () => {
  it("indexes the hub, the live page and the methodology in both languages with real English dates", async () => {
    await expectIndexedInBothLanguages(PAGES);
  });

  it("indexes all 75 place pages in both languages with real English dates", async () => {
    const { regions } = await loadServedMunicipalData();
    const placePaths = populationPlacePaths(regions.map((region) => region.id));
    expect(placePaths).toHaveLength(75);
    await expectIndexedInBothLanguages(placePaths);
  });

  it("lists no page that is not live", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, entries] = await Promise.all([listPublicPagePaths(), sitemap()]);
      // Built from the routes module, the one place that says which pages are live. With every page live there is
      // nothing to exclude, and an empty pattern would match every path, so then the pattern matches nothing.
      const notLivePaths = DEMOGRAPHY_PAGES.filter((page) => !page.live).map((page) => page.path);
      const notLive = notLivePaths.length > 0 ? new RegExp(notLivePaths.join("|")) : /(?!)/;
      expect(paths.some((path) => notLive.test(path))).toBe(false);
      expect(entries.some((entry) => notLive.test(entry.url))).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("dates the Georgian pages by the latest review of the figures they show", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [entries, { facts }] = await Promise.all([sitemap(), loadServedDemographyData()]);
      // The served rows come from two files, population and density, reviewed on different days. The pages show
      // both, so the date is the latest over every row of both, read from the facts as the economy pages' test does.
      const latest = (rows: readonly { lastReviewedAt: string }[]) => rows.map((row) => row.lastReviewedAt).sort().at(-1);
      for (const path of [
        "/explorer/demography",
        "/explorer/demography/population",
        "/explorer/demography/age-sex",
        "/explorer/demography/migration",
        "/explorer/demography/births-deaths",
        "/explorer/demography/marriages-divorces",
        "/explorer/demography/population/batumi",
      ]) {
        const entry = entries.find((candidate) => candidate.url === `https://fiscal.ge${path}`);
        expect(new Date(entry!.lastModified!).toISOString().slice(0, 10)).toBe(latest(facts));
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

// From tests/explorer/inflationProductsDiscovery.test.ts.
describe("product inflation discovery", () => {
  it("indexes both localized product routes and dates", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, revisions, urls, metadata] = await Promise.all([
        listPublicPagePaths(), loadPageRevisions(), sitemap(), inflationProductsMetadata("en"),
      ]);
      expect(paths).toContain("/explorer/inflation/products");
      expect(revisions["/explorer/inflation/products"]).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(urls.map((entry) => entry.url)).toContain("https://fiscal.ge/explorer/inflation/products");
      expect(urls.map((entry) => entry.url)).toContain("https://fiscal.ge/en/explorer/inflation/products");
      expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/inflation/products");
      expect(metadata.alternates?.languages?.ka).toBe("https://fiscal.ge/explorer/inflation/products");
    } finally { vi.unstubAllEnvs(); }
  });
});

// From tests/seo/agentFiles.test.ts.
describe("Fiscal.ge agent instructions", () => {
  it("links only to public sitemap pages and the sitemap document", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const content = await readFile(llmsPath, "utf8");
    const targets = [...content.matchAll(/\]\((https:\/\/fiscal\.ge\/[^)]*)\)/g)].map((match) => match[1]!);
    // Downloads are published files, not pages: they are deliberately absent
    // from the sitemap, which lists public HTML routes. Spec section 16 said
    // only requiredTargets needed updating here; it missed this filter, which
    // treated any non-sitemap link as an HTML page owing a sitemap entry.
    const htmlTargets = targets.filter((target) => !/\.(xml|json|csv)$/.test(new URL(target).pathname));
    const sitemapTargets = (await sitemap()).map((entry) => entry.url);

    expect(htmlTargets.every((target) => sitemapTargets.includes(target))).toBe(true);
    expect(targets.filter((target) => new URL(target).pathname === "/sitemap.xml")).toEqual([
      "https://fiscal.ge/sitemap.xml",
    ]);
  });

  it("llms.txt names every hub, section and methodology route in the sitemap", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const content = await readFile(llmsPath, "utf8");
    const linked = new Set([...content.matchAll(/\]\((https:\/\/fiscal\.ge\/[^)]*)\)/g)].map((match) => new URL(match[1]!).pathname));
    // Georgia and the 64 municipalities are places inside Municipal budgets, at
    // the same depth as a section; the deeper place pages (regions, cities)
    // fall outside depth 3 on their own.
    const placePages = new Set([
      municipalEntityHref("country", "georgia"),
      ...MUNICIPALITY_ROUTES.map(({ code }) => municipalEntityHref("municipality", code)),
    ]);
    const expected = (await sitemap())
      .map((entry) => new URL(entry.url).pathname)
      .filter((path) => (/^\/explorer(\/[^/]+){0,2}$/.test(path) || /^\/methodology(\/|$)/.test(path)) && !placePages.has(path));

    expect(expected.length).toBeGreaterThan(0);
    expect(expected.filter((path) => !linked.has(path))).toEqual([]);
  });
});

// From tests/seo/sitemapFreshness.test.ts.
const SITE = "https://fiscal.ge";

async function sitemapDates(): Promise<Map<string, string | undefined>> {
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
  const entries = await sitemap();
  return new Map(
    entries.map((entry) => [
      entry.url,
      entry.lastModified ? new Date(entry.lastModified).toISOString().slice(0, 10) : undefined,
    ]),
  );
}

describe("sitemap lastmod reports each entity's own reviewed date", () => {
  it("dates each energy and food page by its own facts, and the hub by the newest", async () => {
    const dates = await sitemapDates();
    for (const page of ["energy-supply", "electricity", "energy-use", "food-self-sufficiency"]) expect(dates.get(`${SITE}/explorer/energy-food/${page}`), page).toBe("2026-10-11");
    expect(dates.get(`${SITE}/explorer/energy-food/farming`)).toBe("2026-10-20");
    expect(dates.get(`${SITE}/explorer/energy-food`)).toBe("2026-10-20");
  });

  it("gives every municipality the date its own facts were reviewed", async () => {
    const [dates, municipalData, { sourceDocuments }] = await Promise.all([
      sitemapDates(),
      loadServedMunicipalData(),
      loadServedLandingData(),
    ]);
    const { functionFacts, totalFacts } = municipalData;

    for (const { code, slug } of MUNICIPALITY_ROUTES) {
      const expected = latestReviewedAtForMunicipalFacts(
        sourceDocuments,
        functionFacts.filter((row) => row.municipalityCode === code),
        totalFacts.filter((row) => row.municipalityCode === code),
      );

      expect(dates.get(`${SITE}/explorer/municipalities/${slug}`)).toBe(expected);
    }
  });

  // Adjara is the case that matters here: applyAdjaraBudgetAdjustment folds in the
  // republic budget, whose source document is reviewed later than any member
  // municipality's. Deriving the region date from raw member facts alone silently
  // reports Adjara as older than the date its own page renders.
  it("gives every region the date its page renders, republic adjustment included", async () => {
    const [dates, municipalData, { sourceDocuments }] = await Promise.all([
      sitemapDates(),
      loadServedMunicipalData(),
      loadServedLandingData(),
    ]);
    const { regions, municipalities, functionFacts, totalFacts, adjaraBudgetAdjustments } =
      municipalData;

    for (const region of regions) {
      const members = regionFactsFor(region.id, municipalities, functionFacts, totalFacts);
      const rolled = aggregateFactsForEntity(region.id, members.functionFacts, members.totalFacts);
      const ownTotalFacts =
        region.id === "region.adjara"
          ? applyAdjaraBudgetAdjustment(rolled.totalFacts, adjaraBudgetAdjustments)
          : rolled.totalFacts;
      const expected = latestReviewedAtForMunicipalFacts(
        sourceDocuments,
        members.functionFacts,
        ownTotalFacts,
      );
      const slug = region.id.replace("region.", "");

      expect(dates.get(`${SITE}/explorer/municipalities/region/${slug}`)).toBe(expected);
    }
  });

  it("gives the Georgia roll-up the date its country facts were reviewed", async () => {
    const [dates, municipalData, { sourceDocuments }] = await Promise.all([
      sitemapDates(),
      loadServedMunicipalData(),
      loadServedLandingData(),
    ]);

    const expected = latestReviewedAtForMunicipalFacts(
      sourceDocuments,
      municipalData.countryFunctionFacts,
      municipalData.countryTotalFacts,
    );

    expect(dates.get(`${SITE}/explorer/municipalities/georgia`)).toBe(expected);
  });

  it("does not stamp one global date across every municipal URL", async () => {
    const dates = await sitemapDates();
    const municipalDates = [...dates]
      .filter(([url]) => url.startsWith(`${SITE}/explorer/municipalities`))
      .map(([, date]) => date);

    // The bug this guards: municipality pages render a reviewed date that is older
    // than the newest source document, so a single site-wide maximum misreports
    // them as all having changed on the same day.
    expect(municipalDates.length).toBeGreaterThan(70);
    expect(new Set(municipalDates).size).toBeGreaterThan(1);
  });

  it("leaves the national explorer routes on the site-wide reviewed date", async () => {
    const [dates, { sourceDocuments }] = await Promise.all([sitemapDates(), loadServedLandingData()]);
    const siteWide = sourceDocuments
      .map((source) => source.lastReviewedAt)
      .sort()
      .at(-1);

    // These pages display the site-wide maximum by design, so the sitemap must
    // keep agreeing with them rather than being narrowed alongside the municipal URLs.
    for (const path of ["/explorer/expenditure", "/explorer/revenue", "/explorer/analysis"]) {
      expect(dates.get(`${SITE}${path}`)).toBe(siteWide);
    }
  });

  it("dates the economy pages from their own facts, not the budget documents", async () => {
    const [dates, { facts: gdpFacts }, { facts: sectorFacts }] = await Promise.all([
      sitemapDates(),
      loadServedGdpOverviewData(),
      loadServedEconomicSectorsData(),
    ]);
    const latest = (facts: readonly { lastReviewedAt: string }[]) =>
      facts.map((fact) => fact.lastReviewedAt).sort().at(-1);
    const gdp = latest(gdpFacts);
    const sectors = latest(sectorFacts);

    expect(dates.get(`${SITE}/explorer/economy/gdp`)).toBe(gdp);
    expect(dates.get(`${SITE}/explorer/economy/sectors`)).toBe(sectors);
  });

  // U28-13: a hub moves when any dataset one of its cards reads is refreshed, as the date in its header does.
  it("dates each hub by the newest dataset its cards read", async () => {
    const latest = (...datasets: { facts: readonly { lastReviewedAt: string }[] }[]) =>
      datasets.flatMap(({ facts }) => facts.map((fact) => fact.lastReviewedAt)).sort().at(-1);
    const [dates, gdp, sectors, expenditure, regional, trade, partners, products, domestic, services, composition, inflation, inflationProducts, { sourceDocuments }, debt, balance] = await Promise.all([
      sitemapDates(), loadServedGdpOverviewData(), loadServedEconomicSectorsData(), loadServedGdpExpenditureData(), loadServedRegionalEconomyData(),
      loadServedTradeOverviewData(), loadServedTradePartnersData(), loadServedTradeProductsData(), loadServedTradeDomesticData(), loadServedTradeServicesData(), loadServedTradeCompositionData(),
      loadServedInflationData(), loadServedProductData(), loadServedLandingData(), loadServedGovernmentDebtData(), loadServedGeneralGovernmentBalanceData(),
    ]);
    expect(dates.get(`${SITE}/explorer/economy`)).toBe(latest(gdp, sectors, expenditure, regional));
    expect(dates.get(`${SITE}/explorer/trade`)).toBe(latest(trade, partners, products, domestic, services, composition));
    expect(dates.get(`${SITE}/explorer/inflation`)).toBe(latest(inflation, inflationProducts));
    expect(dates.get(`${SITE}/explorer`)).toBe(latest({ facts: sourceDocuments }, debt, balance));
  });

  it("includes both Products routes with their own review date", async () => {
    const dates = await sitemapDates();
    expect(dates.get(`${SITE}/explorer/trade/products`)).toBe("2026-10-09");
    expect(dates.get(`${SITE}/en/explorer/trade/products`)).toBe("2026-10-09");
  });
  it("dates both composition routes from the accepted data", async () => {
    const dates = await sitemapDates();
    expect(dates.get(`${SITE}/explorer/trade/composition`)).toBe("2026-10-14");
    expect(dates.get(`${SITE}/en/explorer/trade/composition`)).toBe("2026-10-14");
  });
});

// From tests/i18n/inventory.test.ts.
describe("served translation inventory", () => {
  it("covers the same public page identities as the existing sitemap without protocol routes", async () => {
    const paths = await listPublicPagePaths();
    const published = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    expect(paths.flatMap(path => [path, path === "/" ? "/en" : `/en${path}`]).sort()).toEqual(published.sort());
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).not.toContain("/mcp");
    expect(paths).toContain("/explorer/municipalities/region/adjara");
    expect(paths).toContain("/methodology/debt");
  });
});

// From tests/i18n/pageRevisions.test.ts.
describe("paired page dates", () => {
  // U10-15: both languages show the same figures, so a page pair carries one lastmod, the date of those figures.
  it("pairs every sitemap URL and gives both languages one lastmod", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, entries] = await Promise.all([listPublicPagePaths(), sitemap()]);
      expect(entries).toHaveLength(paths.length * 2);
      for (const path of paths) {
        const ka = new URL(path, "https://fiscal.ge").href;
        const en = new URL(pageHref(path, "en"), "https://fiscal.ge").href;
        const original = entries.find(entry => entry.url === ka)!;
        const english = entries.find(entry => entry.url === en)!;
        expect(original.alternates?.languages).toEqual({ ka, en, "x-default": ka });
        expect(english.alternates).toEqual(original.alternates);
        expect(original.lastModified, path).toBeDefined();
        expect(english.lastModified, path).toEqual(original.lastModified);
      }
    } finally { vi.unstubAllEnvs(); }
  });
});

// From tests/navigation/navTree.test.ts.
/** Every explorer page the sitemap publishes, Georgian and English, as the sidebar sees it (language prefix removed). */
async function explorerRoutes(): Promise<string[]> {
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  return (await sitemap())
    .map((entry) => splitLanguagePath(new URL(entry.url).pathname).pathname)
    .filter((pathname) => isActivePath(pathname, "/explorer"));
}

describe("the navigation tree", () => {
  it("gives every sitemap explorer route exactly one active entry, inside the hub it opens", async () => {
    const routes = await explorerRoutes();
    expect(routes.length).toBeGreaterThan(500);
    for (const route of routes) {
      // The sidebar marks currentEntry's row; it must exist, sit in the open hub and be the only row there that matches.
      const hub = openHub(route);
      const entry = currentEntry(route);
      expect([hub.href, ...hub.sections.map((section) => section.href)], route).toContain(entry);
      expect(hub.sections.filter((section) => isActivePath(route, section.href)).length, route).toBeLessThanOrEqual(1);
    }
  });
});

describe("the explorer footer source note", () => {
  it("resolves to a note in both languages on every sitemap explorer route", async () => {
    for (const route of await explorerRoutes()) {
      const key = sourceNoteKey(route);
      expect((kaCommon as Record<string, string>)[key], route).toBeTruthy();
      expect((enCommon as Record<string, string>)[key], route).toBeTruthy();
    }
  });
});
