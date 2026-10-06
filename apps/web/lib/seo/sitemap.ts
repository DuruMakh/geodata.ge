import type { MetadataRoute } from "next";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { ADJARA_REGION_ID } from "../data/municipal/types";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { loadServedProductData } from "../data/inflation/importProducts";
import { loadServedRegionalEconomyData } from "../data/regionalEconomies/importRegionalEconomies";
import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData } from "../data/economicSectors/importEconomicSectors";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { LIVE_METHODOLOGY_IDS, METHODOLOGY_CONTENT } from "../methodology/catalog";
import {
  aggregateFactsForEntity,
  applyAdjaraBudgetAdjustment,
  latestReviewedAtForMunicipalFacts,
  regionFactsFor,
} from "../explorer/municipalData";
import { CITY_PAGE_PATHS } from "../explorer/inflationCityRoutes";
import { DEMOGRAPHY_HUB_PATH, LIVE_DEMOGRAPHY_PAGES } from "../explorer/demographyRoutes";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { resolveSiteUrl } from "../siteUrl";
import { DEBT_EXPLORER_PATH, DEFICIT_EXPLORER_PATH } from "./internalLinks";
import { loadPageRevisions } from "../i18n/page-revisions.server";
import { pageHref } from "../i18n/routes";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  const [{ sourceDocuments }, {
    regions,
    municipalities,
    functionFacts,
    totalFacts,
    countryFunctionFacts,
    countryTotalFacts,
    adjaraBudgetAdjustments,
  }, { facts: debtFacts }, { facts: balanceFacts }, { facts: inflationFacts }, { facts: productFacts }, { facts: regionalEconomyFacts }, { facts: gdpOverviewFacts }, { facts: sectorFacts }, { facts: demographyFacts }] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadServedGeneralGovernmentBalanceData(),
    loadServedInflationData(),
    loadServedProductData(),
    loadServedRegionalEconomyData(),
    loadServedGdpOverviewData(),
    loadServedEconomicSectorsData(),
    loadServedDemographyData(),
  ]);
  const inflationModified = new Date(inflationFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const productModified = new Date(productFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const regionalModified = new Date(regionalEconomyFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  // A GDP or sector refresh must move these URLs' lastmod, exactly as an
  // inflation or debt refresh moves theirs. They used to carry the budget date.
  const gdpModified = new Date(gdpOverviewFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const sectorsModified = new Date(sectorFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const economyModified = gdpModified > sectorsModified ? gdpModified : sectorsModified;
  const demographyModified = new Date(demographyFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const lastReviewedAt = sourceDocuments
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1);
  const lastModified = lastReviewedAt ? new Date(lastReviewedAt) : undefined;
  const methodologyLastModified = LIVE_METHODOLOGY_IDS.map(
    (id) => METHODOLOGY_CONTENT[id].reviewedAt,
  )
    .sort()
    .at(-1);

  // lastmod is per-URL, and a municipal entity's facts are usually older than the
  // newest document on the site. Stamping the site-wide maximum on all of them
  // reports every entity as changed on every import, so each municipal route
  // derives its own date the same way its page derives the "განახლდა" it renders.
  const reviewedAt = (
    entityFunctionFacts: typeof functionFacts,
    entityTotalFacts: typeof totalFacts,
  ): Date | undefined => {
    const reviewed = latestReviewedAtForMunicipalFacts(
      sourceDocuments,
      entityFunctionFacts,
      entityTotalFacts,
    );
    return reviewed ? new Date(reviewed) : undefined;
  };

  const georgian: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified },
    { url: `${siteUrl}/about`, lastModified },
    { url: `${siteUrl}/connect`, lastModified },
    // /mcp itself is never listed: a POST-only protocol endpoint answers a
    // crawler's GET with 405, so it is not a page to index.
    { url: `${siteUrl}/explorer`, lastModified },
    { url: `${siteUrl}/explorer/economy`, lastModified: economyModified },
    { url: `${siteUrl}/explorer/economy/gdp`, lastModified: gdpModified },
    { url: `${siteUrl}/explorer/economy/sectors`, lastModified: sectorsModified },
    { url: `${siteUrl}/explorer/economy/regions`, lastModified: regionalModified },
    ...regions.map((region) => ({
      url: `${siteUrl}/explorer/economy/regions/${region.id.replace("region.", "")}`,
      lastModified: regionalModified,
    })),
    { url: `${siteUrl}/explorer/inflation`, lastModified: inflationModified },
    { url: `${siteUrl}/explorer/inflation/overview`, lastModified: inflationModified },
    { url: `${siteUrl}/explorer/inflation/categories`, lastModified: inflationModified },
    { url: `${siteUrl}/explorer/inflation/products`, lastModified: productModified },
    { url: `${siteUrl}/explorer/inflation/cities`, lastModified: inflationModified },
    ...CITY_PAGE_PATHS.map((path) => ({ url: `${siteUrl}${path}`, lastModified: inflationModified })),
    { url: `${siteUrl}${DEMOGRAPHY_HUB_PATH}`, lastModified: demographyModified },
    ...LIVE_DEMOGRAPHY_PAGES.map((page) => ({ url: `${siteUrl}${page.path}`, lastModified: demographyModified })),
    { url: `${siteUrl}/explorer/expenditure`, lastModified },
    { url: `${siteUrl}/explorer/revenue`, lastModified },
    { url: `${siteUrl}/explorer/analysis`, lastModified },
    {
      url: `${siteUrl}${DEBT_EXPLORER_PATH}`,
      lastModified: debtFacts.length > 0
        ? new Date(debtFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!)
        : undefined,
    },
    {
      url: `${siteUrl}${DEFICIT_EXPLORER_PATH}`,
      lastModified: balanceFacts.length > 0
        ? new Date(balanceFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!)
        : undefined,
    },
    {
      url: `${siteUrl}/explorer/municipalities`,
      lastModified: reviewedAt(functionFacts, [...totalFacts, ...countryTotalFacts]),
    },
    {
      url: `${siteUrl}/explorer/municipalities/georgia`,
      lastModified: reviewedAt(countryFunctionFacts, countryTotalFacts),
    },
    {
      url: `${siteUrl}/methodology`,
      lastModified: methodologyLastModified ? new Date(methodologyLastModified) : undefined,
    },
    ...LIVE_METHODOLOGY_IDS.map((id) => ({
      url: `${siteUrl}/methodology/${id}`,
      lastModified: new Date(METHODOLOGY_CONTENT[id].reviewedAt),
    })),
    // The 64 municipality pages and 11 region roll-ups are complete, closed
    // sets. Municipality public identities are stable slugs; numeric codes
    // remain source-data identities only.
    ...MUNICIPALITY_ROUTES.map(({ code, slug }) => ({
      url: `${siteUrl}/explorer/municipalities/${slug}`,
      lastModified: reviewedAt(
        functionFacts.filter((row) => row.municipalityCode === code),
        totalFacts.filter((row) => row.municipalityCode === code),
      ),
    })),
    ...regions.map((region) => {
      const members = regionFactsFor(region.id, municipalities, functionFacts, totalFacts);
      const rolled = aggregateFactsForEntity(region.id, members.functionFacts, members.totalFacts);
      // Adjara's roll-up folds in the republic budget, which is reviewed later than
      // any member municipality, so the raw member facts alone would date it too early.
      const ownTotalFacts =
        region.id === ADJARA_REGION_ID
          ? applyAdjaraBudgetAdjustment(rolled.totalFacts, adjaraBudgetAdjustments)
          : rolled.totalFacts;
      return {
        // Region ids carry a "region." prefix (e.g. "region.tbilisi"); the route
        // strips it, the same way .../region/[id]/page.tsx's own
        // generateStaticParams and prev/next hrefs already do.
        url: `${siteUrl}/explorer/municipalities/region/${region.id.replace("region.", "")}`,
        lastModified: reviewedAt(members.functionFacts, ownTotalFacts),
      };
    }),
  ];
  const revisions = await loadPageRevisions();
  return georgian.flatMap(entry => {
    const path = new URL(entry.url).pathname;
    const reviewedAt = revisions[path];
    if (!reviewedAt) throw new Error(`Missing English page revision: ${path}`);
    const en = new URL(pageHref(path, "en"), siteUrl).href;
    const languages = { ka: entry.url, en, "x-default": entry.url };
    const originalDate = entry.lastModified ? new Date(entry.lastModified).toISOString().slice(0, 10) : "";
    return [
      { ...entry, alternates: { languages } },
      { url: en, lastModified: new Date([originalDate, reviewedAt].sort().at(-1)!), alternates: { languages } },
    ];
  });
}

const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);

const serializeLastModified = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : value;

export function serializeSitemapXml(entries: MetadataRoute.Sitemap): string {
  const urls = entries
    .map((entry) => {
      const alternateLinks = Object.entries(entry.alternates?.languages ?? {}).flatMap(
        ([language, href]) => (Array.isArray(href) ? href : [href]).map((value) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(value)}" />`,
        ),
      );
      const lastModified = entry.lastModified
        ? `    <lastmod>${escapeXml(serializeLastModified(entry.lastModified))}</lastmod>`
        : "";

      return [
        "  <url>",
        `    <loc>${escapeXml(entry.url)}</loc>`,
        lastModified,
        ...alternateLinks,
        "  </url>",
      ].filter(Boolean).join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    `<urlset xmlns="${SITEMAP_NS}" xmlns:xhtml="${XHTML_NS}">`,
    urls,
    "</urlset>",
    "",
  ].join("\n");
}
