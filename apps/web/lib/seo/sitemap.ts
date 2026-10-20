import { loadServedTradeCompositionData } from "../data/tradeComposition/importTradeComposition";
import type { MetadataRoute } from "next";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { ADJARA_REGION_ID } from "../data/municipal/types";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { loadServedProductData } from "../data/inflation/importProducts";
import { loadServedRegionalEconomyData } from "../data/regionalEconomies/importRegionalEconomies";
import { loadServedExternalPositionData } from "../data/externalPosition/importExternalPosition";
import { EXTERNAL_POSITION_SECTIONS } from "../explorer/externalPosition";
import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData } from "../data/economicSectors/importEconomicSectors";
import { loadServedUnemploymentData } from "../data/unemployment/importUnemployment";
import { loadServedTradeOverviewData } from "../data/tradeOverview/importTradeOverview";
import { loadServedWagesData } from "../data/wages/importWages";
import { WAGES_SECTIONS, wagesRegionHref } from "../explorer/wages";
import { WAGES_REGIONS } from "../data/wages/types";
import { loadServedPovertyData } from "../data/poverty/importPoverty";
import { POVERTY_SECTIONS } from "../explorer/poverty";
import { loadServedHouseholdData } from "../data/household/importHousehold";
import { HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_SECTIONS, householdRegionHref } from "../explorer/household";
import { LIVING_STANDARDS_HUB_PATH } from "../explorer/livingStandards";
import { loadServedHealthData } from "../data/health/importHealth";
import { HEALTH_DEATH_AREAS, healthDeathsAreaHref } from "../explorer/healthDeaths";
import { HEALTH_HUB_PATH, HEALTH_SECTIONS } from "../explorer/health";
import { loadServedCrimeData } from "../data/crime/importCrime";
import { CRIME_HUB_PATH, CRIME_SECTIONS } from "../explorer/crime";
import { loadServedEducationData } from "../data/education/importEducation";
import { EDUCATION_HUB_PATH, EDUCATION_SECTIONS } from "../explorer/education";
import { educationPlaceBase } from "../explorer/educationPlaces";
import { loadServedScienceCultureData } from "../data/scienceCulture/importScienceCulture";
import { SCIENCE_CULTURE_HUB_PATH, SCIENCE_CULTURE_SECTIONS } from "../explorer/scienceCulture";
import { MUSEUM_AREAS, museumAreaHref } from "../explorer/scienceCultureMuseums";
import { loadServedEnergyFoodData } from "../data/energyFood/importEnergyFood";
import { ENERGY_FOOD_HUB_PATH, ENERGY_FOOD_SECTIONS } from "../explorer/energyFood";
import { loadServedMoneyBanksData } from "../data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_SECTIONS } from "../explorer/moneyBanks";
import { loadServedBusinessData } from "../data/business/importBusiness";
import { BUSINESS_HUB_PATH, BUSINESS_SECTIONS } from "../explorer/business";
import { BUSINESS_AREAS, businessAreaHref } from "../explorer/businessAreas";
import { loadServedHousingData } from "../data/housing/importHousing";
import { HOUSING_HUB_PATH, HOUSING_SECTIONS } from "../explorer/housing";
import { HOUSING_AREAS, housingAreaHref } from "../explorer/housingAreas";
import { loadServedTradePartnersData } from "../data/tradePartners/importTradePartners";
import { loadServedMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { loadServedForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import { loadServedCurrentAccountFacts } from "../data/externalFlows/importCurrentAccount";
import { loadServedTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { loadServedTradeServicesData } from "../data/tradeServices/importTradeServices";
import { loadServedTradeDomesticData } from "../data/tradeDomestic/importTradeDomestic";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { LIVE_METHODOLOGY_IDS, METHODOLOGY_CONTENT } from "../methodology/catalog";
import {
  aggregateFactsForEntity,
  applyAdjaraBudgetAdjustment,
  latestReviewedAtForMunicipalFacts,
  regionFactsFor,
} from "../explorer/municipalData";
import { CITY_PAGE_PATHS } from "../explorer/inflationCityRoutes";
import { placePagePaths, populationPlacePaths } from "../explorer/demographyPlaceRoutes";
import { DEMOGRAPHY_HUB_PATH, LIVE_DEMOGRAPHY_PAGES } from "../explorer/demographyRoutes";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { resolveSiteUrl } from "../siteUrl";
import { DEBT_EXPLORER_PATH, DEFICIT_EXPLORER_PATH } from "./internalLinks";
import { pageHref } from "../i18n/routes";
import { UNEMPLOYMENT_SECTIONS } from "../explorer/unemploymentSections";
import { unemploymentRegionHref } from "../explorer/unemploymentRegionRoutes";

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
  }, { facts: debtFacts }, { facts: balanceFacts }, { facts: inflationFacts }, { facts: productFacts }, { facts: regionalEconomyFacts }, { facts: gdpOverviewFacts }, { facts: sectorFacts }, { facts: unemploymentFacts }, { facts: tradeFacts }, { facts: tradePartnerFacts }, { facts: moneyTransferFacts }, { facts: demographyFacts }, { facts: tradeProductFacts }, { facts: tradeDomesticFacts }, { facts: foreignInvestmentFacts }, { facts: wagesFacts }, currentAccountFacts, { facts: povertyFacts }, { facts: householdFacts }, { facts: energyFoodFacts }, { facts: moneyBanksFacts }, { facts: tradeServicesFacts }, { facts: tradeCompositionFacts }, { facts: externalPositionFacts }, { facts: businessFacts }, { facts: healthFacts }, { facts: crimeFacts }, { facts: housingFacts }, { facts: educationFacts }, { facts: scienceCultureFacts }] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadServedGeneralGovernmentBalanceData(),
    loadServedInflationData(),
    loadServedProductData(),
    loadServedRegionalEconomyData(),
    loadServedGdpOverviewData(),
    loadServedEconomicSectorsData(),
    loadServedUnemploymentData(),
    loadServedTradeOverviewData(),
    loadServedTradePartnersData(),
    loadServedMoneyTransfersData(),
    loadServedDemographyData(),
    loadServedTradeProductsData(),
    loadServedTradeDomesticData(),
    loadServedForeignInvestmentData(),
    loadServedWagesData(),
    loadServedCurrentAccountFacts(),
    loadServedPovertyData(),
    loadServedHouseholdData(),
    loadServedEnergyFoodData(),
    loadServedMoneyBanksData(),
    loadServedTradeServicesData(),
    loadServedTradeCompositionData(),
    loadServedExternalPositionData(),
    loadServedBusinessData(),
    loadServedHealthData(),
    loadServedCrimeData(),
    loadServedHousingData(),
    loadServedEducationData(),
    loadServedScienceCultureData(),
  ]);
  const inflationModified = new Date(inflationFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const productModified = new Date(productFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const regionalModified = new Date(regionalEconomyFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  // A GDP or sector refresh must move these URLs' lastmod, exactly as an
  // inflation or debt refresh moves theirs. They used to carry the budget date.
  const gdpModified = new Date(gdpOverviewFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const sectorsModified = new Date(sectorFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const unemploymentModified = new Date(unemploymentFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const tradeModified = new Date(tradeFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const wagesModified = new Date(wagesFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const povertyModified = new Date(povertyFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const householdModified = new Date(householdFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const livingStandardsModified = householdModified > povertyModified ? householdModified : povertyModified;
  const healthModified = new Date(healthFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const crimeModified = new Date(crimeFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const educationModified = new Date(educationFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const scienceCultureModified = new Date(scienceCultureFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const energyFoodModified = new Date(energyFoodFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const moneyBanksModified = new Date(moneyBanksFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const businessModified = new Date(businessFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const housingModified = new Date(housingFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const tradePartnersModified = new Date(tradePartnerFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const moneyTransfersModified = new Date(moneyTransferFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const foreignInvestmentModified = new Date(foreignInvestmentFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const currentAccountModified = new Date(currentAccountFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const externalPositionModified = new Date(externalPositionFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const externalModified = new Date(Math.max(moneyTransfersModified.getTime(), foreignInvestmentModified.getTime(), currentAccountModified.getTime(), externalPositionModified.getTime()));
  const tradeProductsModified = new Date(tradeProductFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const tradeCompositionModified = new Date(tradeCompositionFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const tradeServicesModified = new Date(tradeServicesFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const tradeDomesticModified = new Date(tradeDomesticFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  // A hub is dated by the latest of every dataset its cards read.
  const tradeHubModified = new Date(Math.max(tradeModified.getTime(), tradePartnersModified.getTime(), tradeProductsModified.getTime(), tradeDomesticModified.getTime(), tradeServicesModified.getTime(), tradeCompositionModified.getTime()));
  const economyModified = new Date(Math.max(gdpModified.getTime(), sectorsModified.getTime(), regionalModified.getTime()));
  const inflationHubModified = productModified > inflationModified ? productModified : inflationModified;
  const demographyModified = new Date(demographyFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const lastReviewedAt = sourceDocuments
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1);
  const lastModified = lastReviewedAt ? new Date(lastReviewedAt) : undefined;
  // The budget hub shows the debt and deficit cards beside the budget ones, and dates itself by all three.
  const budgetHubReviewedAt = [lastReviewedAt, ...debtFacts.map((fact) => fact.lastReviewedAt), ...balanceFacts.map((fact) => fact.lastReviewedAt)]
    .filter(Boolean)
    .sort()
    .at(-1);
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
    { url: `${siteUrl}/explorer`, lastModified: budgetHubReviewedAt ? new Date(budgetHubReviewedAt) : undefined },
    { url: `${siteUrl}/explorer/economy`, lastModified: economyModified },
    { url: `${siteUrl}/explorer/economy/gdp`, lastModified: gdpModified },
    { url: `${siteUrl}/explorer/economy/sectors`, lastModified: sectorsModified },
    { url: `${siteUrl}${BUSINESS_HUB_PATH}`, lastModified: businessModified },
    ...BUSINESS_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: businessModified })),
    ...BUSINESS_AREAS.map(area => ({ url: `${siteUrl}${businessAreaHref(area)}`, lastModified: businessModified })),
    { url: `${siteUrl}${HOUSING_HUB_PATH}`, lastModified: housingModified },
    ...HOUSING_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: housingModified })),
    ...HOUSING_AREAS.map(area => ({ url: `${siteUrl}${housingAreaHref(area)}`, lastModified: housingModified })),
    { url: `${siteUrl}/explorer/unemployment`, lastModified: unemploymentModified },
    { url: `${siteUrl}/explorer/wages`, lastModified: wagesModified },
    ...WAGES_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: wagesModified })),
    ...WAGES_REGIONS.map(id => ({ url: `${siteUrl}${wagesRegionHref(id)}`, lastModified: wagesModified })),
    { url: `${siteUrl}${LIVING_STANDARDS_HUB_PATH}`, lastModified: livingStandardsModified },
    ...HOUSEHOLD_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: householdModified })),
    ...HOUSEHOLD_SECTIONS.flatMap(section => HOUSEHOLD_PAGE_AREAS.map(id => ({ url: `${siteUrl}${householdRegionHref(section.id, id)}`, lastModified: householdModified }))),
    ...POVERTY_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: povertyModified })),
    { url: `${siteUrl}${HEALTH_HUB_PATH}`, lastModified: healthModified },
    ...HEALTH_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: healthModified })),
    ...HEALTH_DEATH_AREAS.map(area => ({ url: `${siteUrl}${healthDeathsAreaHref(area)}`, lastModified: healthModified })),
    { url: `${siteUrl}${CRIME_HUB_PATH}`, lastModified: crimeModified },
    ...CRIME_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: crimeModified })),
    { url: `${siteUrl}${EDUCATION_HUB_PATH}`, lastModified: educationModified },
    ...EDUCATION_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: educationModified })),
    ...(["schools", "kindergartens"] as const).flatMap(set => placePagePaths(educationPlaceBase(set), regions.map((region) => region.id)).map((path) => ({ url: `${siteUrl}${path}`, lastModified: educationModified }))),
    { url: `${siteUrl}${SCIENCE_CULTURE_HUB_PATH}`, lastModified: scienceCultureModified },
    ...SCIENCE_CULTURE_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: scienceCultureModified })),
    ...MUSEUM_AREAS.map(area => ({ url: `${siteUrl}${museumAreaHref(area)}`, lastModified: scienceCultureModified })),
    { url: `${siteUrl}${ENERGY_FOOD_HUB_PATH}`, lastModified: energyFoodModified },
    ...ENERGY_FOOD_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: energyFoodModified })),
    { url: `${siteUrl}/explorer/trade`, lastModified: tradeHubModified },
    { url: `${siteUrl}/explorer/trade/overview`, lastModified: tradeModified },
    { url: `${siteUrl}/explorer/trade/partners`, lastModified: tradePartnersModified },
    { url: `${siteUrl}/explorer/external`, lastModified: externalModified },
    { url: `${siteUrl}/explorer/external/money-from-abroad`, lastModified: moneyTransfersModified },
    { url: `${siteUrl}/explorer/external/foreign-investment`, lastModified: foreignInvestmentModified },
    { url: `${siteUrl}/explorer/external/current-account`, lastModified: currentAccountModified },
    ...EXTERNAL_POSITION_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: externalPositionModified })),
    { url: `${siteUrl}/explorer/trade/products`, lastModified: tradeProductsModified },
    { url: `${siteUrl}/explorer/trade/domestic-exports`, lastModified: tradeDomesticModified },
    { url: `${siteUrl}/explorer/trade/services`, lastModified: tradeServicesModified },
    { url: `${siteUrl}/explorer/trade/composition`, lastModified: tradeCompositionModified },
    ...UNEMPLOYMENT_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: unemploymentModified })),
    ...regions.map(region => ({ url: `${siteUrl}${unemploymentRegionHref(region.id)}`, lastModified: new Date(unemploymentFacts.filter(fact => fact.dimension === "region" && fact.groupId === region.id).map(fact => fact.lastReviewedAt).sort().at(-1)!) })),
    { url: `${siteUrl}/explorer/economy/regions`, lastModified: regionalModified },
    ...regions.map((region) => ({
      url: `${siteUrl}/explorer/economy/regions/${region.id.replace("region.", "")}`,
      lastModified: regionalModified,
    })),
    { url: `${siteUrl}/explorer/inflation`, lastModified: inflationHubModified },
    { url: `${siteUrl}/explorer/inflation/overview`, lastModified: inflationModified },
    { url: `${siteUrl}/explorer/inflation/categories`, lastModified: inflationModified },
    { url: `${siteUrl}/explorer/inflation/products`, lastModified: productModified },
    { url: `${siteUrl}/explorer/inflation/cities`, lastModified: inflationModified },
    ...CITY_PAGE_PATHS.map((path) => ({ url: `${siteUrl}${path}`, lastModified: inflationModified })),
    { url: `${siteUrl}/explorer/money`, lastModified: moneyBanksModified },
    ...MONEY_BANKS_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: moneyBanksModified })),
    { url: `${siteUrl}${DEMOGRAPHY_HUB_PATH}`, lastModified: demographyModified },
    ...LIVE_DEMOGRAPHY_PAGES.map((page) => ({ url: `${siteUrl}${page.path}`, lastModified: demographyModified })),
    ...populationPlacePaths(regions.map((region) => region.id)).map((path) => ({ url: `${siteUrl}${path}`, lastModified: demographyModified })),
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
  // The two languages show the same figures, so a page pair carries one lastmod: the date of the data it shows.
  return georgian.flatMap(entry => {
    const en = new URL(pageHref(new URL(entry.url).pathname, "en"), siteUrl).href;
    const languages = { ka: entry.url, en, "x-default": entry.url };
    return [
      { ...entry, alternates: { languages } },
      { url: en, lastModified: entry.lastModified, alternates: { languages } },
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
