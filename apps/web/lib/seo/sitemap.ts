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
import { loadServedGdpExpenditureData } from "../data/gdpExpenditure/importGdpExpenditure";
import { loadServedExpenditureTypesData } from "../data/expenditureTypes/importExpenditureTypes";
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
import { loadServedEnvironmentData } from "../data/environment/importEnvironment";
import { ENVIRONMENT_CITIES } from "../data/environment/types";
import { ENVIRONMENT_HUB_PATH, ENVIRONMENT_SECTIONS } from "../explorer/environment";
import { environmentCityHref } from "../explorer/environmentCities";
import { ENVIRONMENT_AREAS, environmentAreaRoutes } from "../explorer/environmentAreas";
import { loadServedLabourData } from "../data/labour/importLabour";
import { EDUCATION_HUB_PATH, EDUCATION_SECTIONS } from "../explorer/education";
import { educationPlaceBase } from "../explorer/educationPlaces";
import { loadServedSocialData } from "../data/social/importSocial";
import { SOCIAL_SECTIONS } from "../explorer/social";
import { socialPlaceBase } from "../explorer/socialPlaces";
import { loadServedScienceCultureData } from "../data/scienceCulture/importScienceCulture";
import { SCIENCE_CULTURE_HUB_PATH, SCIENCE_CULTURE_SECTIONS } from "../explorer/scienceCulture";
import { MUSEUM_AREAS, museumAreaHref } from "../explorer/scienceCultureMuseums";
import { loadServedEnergyFoodData } from "../data/energyFood/importEnergyFood";
import { ENERGY_FOOD_HUB_PATH, ENERGY_FOOD_SECTIONS, energyFoodLastReviewedAt } from "../explorer/energyFood";
import { loadServedMoneyBanksData } from "../data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_SECTIONS } from "../explorer/moneyBanks";
import { MONEY_BANKS_LOAN_AREAS } from "../data/moneyBanks/types";
import { moneyBanksAreaHref } from "../explorer/moneyBanksAreas";
import { loadServedBusinessData } from "../data/business/importBusiness";
import { BUSINESS_HUB_PATH, BUSINESS_SECTIONS } from "../explorer/business";
import { BUSINESS_AREAS, businessAreaHref } from "../explorer/businessAreas";
import { loadServedHousingData } from "../data/housing/importHousing";
import { HOUSING_HUB_PATH, HOUSING_SECTIONS } from "../explorer/housing";
import { HOUSING_AREAS, housingAreaHref } from "../explorer/housingAreas";
import { loadServedInternetData } from "../data/internet/importInternet";
import { INTERNET_HUB_PATH, INTERNET_SECTIONS } from "../explorer/internet";
import { INTERNET_AREAS, internetAreaHref } from "../explorer/internetAreas";
import { loadServedTransportData } from "../data/transport/importTransport";
import { TRANSPORT_HUB_PATH, TRANSPORT_SECTIONS } from "../explorer/transport";
import { TRANSPORT_AREAS, transportAreaHref } from "../explorer/transportAreas";
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
import { awaitNamed } from "../awaitNamed";
import { DEBT_EXPLORER_PATH, DEFICIT_EXPLORER_PATH } from "./internalLinks";
import { pageHref } from "../i18n/routes";
import { UNEMPLOYMENT_SECTIONS } from "../explorer/unemploymentSections";
import { LABOUR_SECTIONS } from "../explorer/labour";
import { unemploymentRegionHref } from "../explorer/unemploymentRegionRoutes";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  // By name, not by position: every result has the same shape, so a swapped pair would still typecheck.
  const data = await awaitNamed({
    landing: loadServedLandingData(),
    municipal: loadServedMunicipalData(),
    governmentDebt: loadServedGovernmentDebtData(),
    generalGovernmentBalance: loadServedGeneralGovernmentBalanceData(),
    inflation: loadServedInflationData(),
    product: loadServedProductData(),
    regionalEconomy: loadServedRegionalEconomyData(),
    gdpOverview: loadServedGdpOverviewData(),
    economicSectors: loadServedEconomicSectorsData(),
    unemployment: loadServedUnemploymentData(),
    tradeOverview: loadServedTradeOverviewData(),
    tradePartners: loadServedTradePartnersData(),
    moneyTransfers: loadServedMoneyTransfersData(),
    demography: loadServedDemographyData(),
    tradeProducts: loadServedTradeProductsData(),
    tradeDomestic: loadServedTradeDomesticData(),
    foreignInvestment: loadServedForeignInvestmentData(),
    wages: loadServedWagesData(),
    currentAccount: loadServedCurrentAccountFacts(),
    poverty: loadServedPovertyData(),
    household: loadServedHouseholdData(),
    energyFood: loadServedEnergyFoodData(),
    moneyBanks: loadServedMoneyBanksData(),
    tradeServices: loadServedTradeServicesData(),
    tradeComposition: loadServedTradeCompositionData(),
    externalPosition: loadServedExternalPositionData(),
    business: loadServedBusinessData(),
    health: loadServedHealthData(),
    crime: loadServedCrimeData(),
    housing: loadServedHousingData(),
    education: loadServedEducationData(),
    social: loadServedSocialData(),
    environment: loadServedEnvironmentData(),
    scienceCulture: loadServedScienceCultureData(),
    labour: loadServedLabourData(),
    gdpExpenditure: loadServedGdpExpenditureData(),
    transport: loadServedTransportData(),
    internet: loadServedInternetData(),
    expenditureTypes: loadServedExpenditureTypesData(),
  });
  const { sourceDocuments } = data.landing;
  const { regions, municipalities, functionFacts, totalFacts, countryFunctionFacts, countryTotalFacts, adjaraBudgetAdjustments } = data.municipal;
  const debtFacts = data.governmentDebt.facts;
  const balanceFacts = data.generalGovernmentBalance.facts;
  const inflationFacts = data.inflation.facts;
  const productFacts = data.product.facts;
  const regionalEconomyFacts = data.regionalEconomy.facts;
  const gdpOverviewFacts = data.gdpOverview.facts;
  const sectorFacts = data.economicSectors.facts;
  const unemploymentFacts = data.unemployment.facts;
  const tradeFacts = data.tradeOverview.facts;
  const tradePartnerFacts = data.tradePartners.facts;
  const moneyTransferFacts = data.moneyTransfers.facts;
  const demographyFacts = data.demography.facts;
  const tradeProductFacts = data.tradeProducts.facts;
  const tradeDomesticFacts = data.tradeDomestic.facts;
  const foreignInvestmentFacts = data.foreignInvestment.facts;
  const wagesFacts = data.wages.facts;
  const currentAccountFacts = data.currentAccount;
  const povertyFacts = data.poverty.facts;
  const householdFacts = data.household.facts;
  const energyFoodFacts = data.energyFood.facts;
  const moneyBanksFacts = data.moneyBanks.facts;
  const tradeServicesFacts = data.tradeServices.facts;
  const tradeCompositionFacts = data.tradeComposition.facts;
  const externalPositionFacts = data.externalPosition.facts;
  const businessFacts = data.business.facts;
  const healthFacts = data.health.facts;
  const crimeFacts = data.crime.facts;
  const housingFacts = data.housing.facts;
  const educationFacts = data.education.facts;
  const socialFacts = data.social.facts;
  const environmentFacts = data.environment;
  const scienceCultureFacts = data.scienceCulture.facts;
  const labourFacts = data.labour.facts;
  const gdpExpenditureFacts = data.gdpExpenditure.facts;
  const transportFacts = data.transport.facts;
  const internetFacts = data.internet.facts;
  const expenditureTypeFacts = data.expenditureTypes.facts;
  const inflationModified = new Date(inflationFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const productModified = new Date(productFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const regionalModified = new Date(regionalEconomyFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  // A GDP or sector refresh must move these URLs' lastmod, exactly as an
  // inflation or debt refresh moves theirs. They used to carry the budget date.
  const gdpModified = new Date(gdpOverviewFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const sectorsModified = new Date(sectorFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const gdpExpenditureModified = new Date(gdpExpenditureFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const expenditureTypesModified = new Date(expenditureTypeFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);
  const unemploymentModified = new Date(unemploymentFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const tradeModified = new Date(tradeFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const wagesModified = new Date(wagesFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const povertyModified = new Date(povertyFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const householdModified = new Date(householdFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const livingStandardsModified = householdModified > povertyModified ? householdModified : povertyModified;
  const healthModified = new Date(healthFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const socialModified = new Date(socialFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  // The hub's cards follow both Geostat's health pages and the Social Service Agency's pages.
  const healthHubModified = socialModified > healthModified ? socialModified : healthModified;
  const crimeModified = new Date(crimeFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const labourModified = new Date(labourFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const educationModified = new Date(educationFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const scienceCultureModified = new Date(scienceCultureFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const internetModified = new Date(internetFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const transportModified = new Date(transportFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const energyFoodModified = new Date(energyFoodFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
  const environmentModified = new Date(environmentFacts.map(fact => fact.lastReviewedAt).sort().at(-1)!);
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
  const economyModified = new Date(Math.max(gdpModified.getTime(), sectorsModified.getTime(), gdpExpenditureModified.getTime(), regionalModified.getTime()));
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
    { url: `${siteUrl}/explorer/economy/expenditure`, lastModified: gdpExpenditureModified },
    { url: `${siteUrl}${BUSINESS_HUB_PATH}`, lastModified: businessModified },
    ...BUSINESS_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: businessModified })),
    ...BUSINESS_AREAS.map(area => ({ url: `${siteUrl}${businessAreaHref(area)}`, lastModified: businessModified })),
    { url: `${siteUrl}${HOUSING_HUB_PATH}`, lastModified: housingModified },
    ...HOUSING_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: housingModified })),
    ...HOUSING_AREAS.map(area => ({ url: `${siteUrl}${housingAreaHref(area)}`, lastModified: housingModified })),
    { url: `${siteUrl}/explorer/unemployment`, lastModified: labourModified > unemploymentModified ? labourModified : unemploymentModified },
    { url: `${siteUrl}/explorer/wages`, lastModified: wagesModified },
    ...WAGES_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: wagesModified })),
    ...WAGES_REGIONS.map(id => ({ url: `${siteUrl}${wagesRegionHref(id)}`, lastModified: wagesModified })),
    { url: `${siteUrl}${LIVING_STANDARDS_HUB_PATH}`, lastModified: livingStandardsModified },
    ...HOUSEHOLD_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: householdModified })),
    ...HOUSEHOLD_SECTIONS.flatMap(section => HOUSEHOLD_PAGE_AREAS.map(id => ({ url: `${siteUrl}${householdRegionHref(section.id, id)}`, lastModified: householdModified }))),
    ...POVERTY_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: povertyModified })),
    { url: `${siteUrl}${HEALTH_HUB_PATH}`, lastModified: healthHubModified },
    ...HEALTH_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: healthModified })),
    ...HEALTH_DEATH_AREAS.map(area => ({ url: `${siteUrl}${healthDeathsAreaHref(area)}`, lastModified: healthModified })),
    ...SOCIAL_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: socialModified })),
    ...(["pensions", "subsistence-allowance"] as const).flatMap(set => placePagePaths(socialPlaceBase(set), regions.map((region) => region.id)).map((path) => ({ url: `${siteUrl}${path}`, lastModified: socialModified }))),
    { url: `${siteUrl}${CRIME_HUB_PATH}`, lastModified: crimeModified },
    ...CRIME_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: crimeModified })),
    { url: `${siteUrl}${INTERNET_HUB_PATH}`, lastModified: internetModified },
    ...INTERNET_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: internetModified })),
    ...INTERNET_AREAS.map(area => ({ url: `${siteUrl}${internetAreaHref(area)}`, lastModified: internetModified })),
    { url: `${siteUrl}${EDUCATION_HUB_PATH}`, lastModified: educationModified },
    ...EDUCATION_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: educationModified })),
    ...(["schools", "kindergartens"] as const).flatMap(set => placePagePaths(educationPlaceBase(set), regions.map((region) => region.id)).map((path) => ({ url: `${siteUrl}${path}`, lastModified: educationModified }))),
    { url: `${siteUrl}${SCIENCE_CULTURE_HUB_PATH}`, lastModified: scienceCultureModified },
    ...SCIENCE_CULTURE_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: scienceCultureModified })),
    ...MUSEUM_AREAS.map(area => ({ url: `${siteUrl}${museumAreaHref(area)}`, lastModified: scienceCultureModified })),
    { url: `${siteUrl}${ENERGY_FOOD_HUB_PATH}`, lastModified: energyFoodModified },
    // Each page carries its own facts' review date, as its header and Dataset JSON-LD do; the hub the newest.
    ...ENERGY_FOOD_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: new Date(energyFoodLastReviewedAt(section.id, energyFoodFacts)) })),
    { url: `${siteUrl}${ENVIRONMENT_HUB_PATH}`, lastModified: environmentModified },
    ...ENVIRONMENT_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: environmentModified })),
    ...ENVIRONMENT_CITIES.map(city => ({ url: `${siteUrl}${environmentCityHref(city)}`, lastModified: environmentModified })),
    ...(["waste", "forests"] as const).flatMap(topic => ENVIRONMENT_AREAS.map(area => ({ url: `${siteUrl}${environmentAreaRoutes(topic).areaHref(area)}`, lastModified: environmentModified }))),
    { url: `${siteUrl}${TRANSPORT_HUB_PATH}`, lastModified: transportModified },
    ...TRANSPORT_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: transportModified })),
    ...TRANSPORT_AREAS.map(area => ({ url: `${siteUrl}${transportAreaHref(area)}`, lastModified: transportModified })),
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
    ...LABOUR_SECTIONS.map(section => ({ url: `${siteUrl}${section.href}`, lastModified: labourModified })),
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
    ...MONEY_BANKS_LOAN_AREAS.map(area => ({ url: `${siteUrl}${moneyBanksAreaHref(area)}`, lastModified: moneyBanksModified })),
    { url: `${siteUrl}${DEMOGRAPHY_HUB_PATH}`, lastModified: demographyModified },
    ...LIVE_DEMOGRAPHY_PAGES.map((page) => ({ url: `${siteUrl}${page.path}`, lastModified: demographyModified })),
    ...populationPlacePaths(regions.map((region) => region.id)).map((path) => ({ url: `${siteUrl}${path}`, lastModified: demographyModified })),
    { url: `${siteUrl}/explorer/expenditure`, lastModified },
    { url: `${siteUrl}/explorer/expenditure-types`, lastModified: expenditureTypesModified },
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
