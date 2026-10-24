import { loadServedBusinessData, toClientBusinessFact } from "../data/business/importBusiness";
import { loadServedCrimeData, toClientCrimeFact } from "../data/crime/importCrime";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { loadServedEconomicSectorsData } from "../data/economicSectors/importEconomicSectors";
import { loadServedEducationData, shownEducationFacts, toClientEducationFact } from "../data/education/importEducation";
import { loadServedEnergyFoodData, toClientEnergyFoodFact } from "../data/energyFood/importEnergyFood";
import { loadServedEnvironmentData, toClientEnvironmentFact } from "../data/environment/importEnvironment";
import { loadServedExpenditureTypesData } from "../data/expenditureTypes/importExpenditureTypes";
import { EXPENDITURE_TYPES_TOTAL } from "../data/expenditureTypes/types";
import { loadServedCurrentAccountFacts, toClientCurrentAccountFacts } from "../data/externalFlows/importCurrentAccount";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { loadServedExternalPositionData, toClientExternalPositionFact } from "../data/externalPosition/importExternalPosition";
import { loadServedGdpExpenditureData } from "../data/gdpExpenditure/importGdpExpenditure";
import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { loadServedHealthData, toClientHealthFact } from "../data/health/importHealth";
import { loadServedHouseholdData, toClientHouseholdFact } from "../data/household/importHousehold";
import { loadServedHousingData, toClientHousingFact } from "../data/housing/importHousing";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { loadServedProductData } from "../data/inflation/importProducts";
import { periodFromKey } from "../data/inflation/periods";
import { cityFactInput } from "../data/inflation/types";
import { loadServedInternetData, toClientInternetFact } from "../data/internet/importInternet";
import { loadServedLabourData, toClientLabourFact } from "../data/labour/importLabour";
import { loadServedMoneyBanksData, toClientMoneyBanksFact } from "../data/moneyBanks/importMoneyBanks";
import { loadServedPovertyData, toClientPovertyFact } from "../data/poverty/importPoverty";
import { loadServedRegionalEconomyData, REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { loadServedScienceCultureData, toClientScienceCultureFact } from "../data/scienceCulture/importScienceCulture";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { loadServedSocialData, toClientSocialFact } from "../data/social/importSocial";
import { loadServedTradeCompositionData, toClientTradeCompositionData } from "../data/tradeComposition/importTradeComposition";
import { loadServedTradeDomesticData, toClientTradeDomesticData } from "../data/tradeDomestic/importTradeDomestic";
import { loadServedTradeOverviewData, toClientTradeOverviewFact } from "../data/tradeOverview/importTradeOverview";
import { loadServedTradePartnersData, toClientTradePartnersData } from "../data/tradePartners/importTradePartners";
import { loadServedTradeProductsData, toClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { loadServedTradeServicesData, toClientTradeServicesData } from "../data/tradeServices/importTradeServices";
import { loadServedTransportData, toClientTransportFact } from "../data/transport/importTransport";
import { loadServedUnemploymentData, UNEMPLOYMENT_REGISTRY } from "../data/unemployment/importUnemployment";
import { loadServedWagesData, toClientWagesFact } from "../data/wages/importWages";
import { WAGES_REGIONS, WAGES_SECTORS } from "../data/wages/types";
import { buildBusinessHubCards } from "../explorer/businessHubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import { buildCrimeHubCards } from "../explorer/crimeHubCards";
import { buildDemographyHubCards } from "../explorer/demographyHubCards";
import { buildEconomyHubCards } from "../explorer/economyHubCards";
import { schoolYearLabel } from "../explorer/education";
import { buildEducationHubCards } from "../explorer/educationHubCards";
import { buildEnergyFoodHubCards } from "../explorer/energyFoodHubCards";
import { buildEnvironmentHubCards } from "../explorer/environmentHubCards";
import { buildExternalHubCards } from "../explorer/externalHubCards";
import { buildHealthHubCards } from "../explorer/healthHubCards";
import { buildHouseholdHubCards } from "../explorer/householdHubCards";
import { buildHousingHubCards } from "../explorer/housingHubCards";
import { buildHubCards, type HubCardModel } from "../explorer/hubCards";
import { buildInflationHubCards, buildLatestProductHubSummary } from "../explorer/inflationHubCards";
import { periodLabel } from "../explorer/inflationLabels";
import { buildInternetHubCards } from "../explorer/internetHubCards";
import { buildLabourHubCards } from "../explorer/labourHubCards";
import { buildMoneyBanksHubCards } from "../explorer/moneyBanksHubCards";
import { buildPovertyHubCards } from "../explorer/povertyHubCards";
import { buildScienceCultureHubCards } from "../explorer/scienceCultureHubCards";
import { buildSocialHubCards } from "../explorer/socialHubCards";
import type { TopicHubData } from "../explorer/topicHub";
import { buildTradeHubCards } from "../explorer/tradeHubCards";
import { tradePartnersCoverage } from "../explorer/tradePartnersState";
import { tradeProductsCoverage } from "../explorer/tradeProductsState";
import { buildTransportHubCards } from "../explorer/transportHubCards";
import { buildUnemploymentHubCards } from "../explorer/unemploymentHubCards";
import { buildWagesHubCards } from "../explorer/wagesHubCards";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale, Messages } from "../i18n/types";
import type { TopicId } from "../navigation/navTree";
import { wagesLabels } from "./wages-shared";

// One loader per topic: its served data, its hub cards and the coverage its header states. The topic hubs, the group
// pages, All data and search all read a topic from here, so no figure is built twice. Each loader's presentation adds
// `groups` for the card captions a group page shows.

/** The source block the Products pages show; the hub reports the same coverage. */
export const PRODUCT_SOURCE_BLOCK = "2020-2025";

type Loaded = Omit<TopicHubData, "topic">;

/** The range and latest review date of facts counted in calendar years. */
function yearly(cards: HubCardModel[], years: readonly number[], reviewed: readonly string[]): Loaded {
  return { cards, firstPeriod: String(Math.min(...years)), lastPeriod: String(Math.max(...years)), lastReviewedAt: [...reviewed].sort().at(-1) ?? "" };
}

const LOADERS: Record<TopicId, (locale: Locale) => Promise<Loaded>> = {
  budget: async (locale) => {
    const [presentation, { facts, sourceDocuments }, { countryTotalFacts }, { facts: debtFacts }, { facts: balanceFacts }, { facts: expenditureTypeFacts }] = await Promise.all([
      getPresentation(locale, ["main", "hub"], []), loadServedLandingData(), loadServedMunicipalData(), loadServedGovernmentDebtData(), loadServedGeneralGovernmentBalanceData(), loadServedExpenditureTypesData(),
    ]);
    const municipalTotals = new Map<number, number>();
    for (const row of countryTotalFacts) municipalTotals.set(row.year, row.publicTotalGel);
    const expenditureTypeTotals = new Map(expenditureTypeFacts.filter((fact) => fact.seriesId === EXPENDITURE_TYPES_TOTAL && fact.measure === "nominal").map((fact) => [fact.year, fact.value]));
    const cards = buildHubCards(facts, municipalTotals, debtFacts, balanceFacts, presentation, expenditureTypeTotals, true);
    return yearly(cards, facts.map((fact) => fact.year), [...sourceDocuments.map((source) => source.lastReviewedAt), ...debtFacts.map((fact) => fact.lastReviewedAt), ...balanceFacts.map((fact) => fact.lastReviewedAt)]);
  },
  economy: async (locale) => {
    const [{ facts }, presentation, sectors, regional, expenditure] = await Promise.all([
      loadServedGdpOverviewData(),
      getPresentation(locale, ["gdp", "sectors", "gdpExpenditure", "regionalEconomies", "groups"], REGIONAL_ECONOMY_REGIONS.map((region) => region.id)),
      loadServedEconomicSectorsData(), loadServedRegionalEconomyData(), loadServedGdpExpenditureData(),
    ]);
    const cards = buildEconomyHubCards(facts, presentation, sectors.facts, regional.facts, expenditure.facts);
    return yearly(cards, facts.map((f) => f.year), [...facts, ...sectors.facts, ...expenditure.facts, ...regional.facts].map((f) => f.lastReviewedAt));
  },
  business: async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedBusinessData(), getPresentation(locale, ["business", "groups"], [])]);
    return yearly(buildBusinessHubCards(facts.map(toClientBusinessFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  housing: async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedHousingData(), getPresentation(locale, ["housing", "groups"], [])]);
    return yearly(buildHousingHubCards(facts.map(toClientHousingFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  inflation: async (locale) => {
    const [{ facts, categories, weights, cities }, productData, presentation] = await Promise.all([loadServedInflationData(), loadServedProductData(), getPresentation(locale, ["inflation", "groups"], [])]);
    const periods = facts.map((fact) => fact.period).sort();
    const short = (key: string) => periodLabel(presentation.messages, periodFromKey(key), "short");
    return {
      cards: buildInflationHubCards(facts, presentation, categories, weights, buildLatestProductHubSummary(productData), cities.map(cityFactInput)),
      firstPeriod: short(periods[0]), lastPeriod: short(periods.at(-1)!), lastReviewedAt: facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "",
    };
  },
  money: async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedMoneyBanksData(), getPresentation(locale, ["moneyBanks", "groups"], [])]);
    return yearly(buildMoneyBanksHubCards(facts.map(toClientMoneyBanksFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  unemployment: async (locale) => {
    const [{ facts }, { facts: labourFacts }, presentation] = await Promise.all([loadServedUnemploymentData(), loadServedLabourData(), getPresentation(locale, ["unemployment", "labour", "groups"], [])]);
    const cards = [...buildUnemploymentHubCards(facts, presentation, UNEMPLOYMENT_REGISTRY), ...buildLabourHubCards(labourFacts.map(toClientLabourFact), presentation, 5)];
    return yearly(cards, [...facts, ...labourFacts].map((f) => f.year), [...facts, ...labourFacts].map((f) => f.lastReviewedAt));
  },
  wages: async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedWagesData(), getPresentation(locale, ["wages", "groups"], [...WAGES_SECTORS, ...WAGES_REGIONS])]);
    return yearly(buildWagesHubCards(facts.map(toClientWagesFact), presentation, wagesLabels(presentation)), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  "living-standards": async (locale) => {
    const [household, poverty, presentation] = await Promise.all([loadServedHouseholdData(), loadServedPovertyData(), getPresentation(locale, ["household", "poverty", "groups"], [])]);
    // Income and Spending come first, then Poverty and Inequality; the cards are numbered across the hub.
    const cards = [...buildHouseholdHubCards(household.facts.map(toClientHouseholdFact), presentation), ...buildPovertyHubCards(poverty.facts.map(toClientPovertyFact), presentation)]
      .map((card, index) => ({ ...card, index: String(index + 1).padStart(2, "0") }));
    const all = [...household.facts, ...poverty.facts];
    return yearly(cards, all.map((f) => f.year), all.map((f) => f.lastReviewedAt));
  },
  health: async (locale) => {
    // Health's three cards, then the four social protection cards, each from served facts.
    const [{ facts }, { facts: social }, presentation] = await Promise.all([loadServedHealthData(), loadServedSocialData(), getPresentation(locale, ["health", "social", "groups"], [])]);
    const cards = [...buildHealthHubCards(facts.map(toClientHealthFact), presentation), ...buildSocialHubCards(social.map(toClientSocialFact), presentation)];
    return yearly(cards, [...facts, ...social].map((f) => f.year), [...facts, ...social].map((f) => f.lastReviewedAt));
  },
  education: async (locale) => {
    const [{ facts: served }, presentation] = await Promise.all([loadServedEducationData(), getPresentation(locale, ["education", "groups"], [])]);
    const facts = shownEducationFacts(served);
    // The header's years are school years; vocational colleges' calendar years fall inside them.
    const schoolYears = facts.filter((f) => !f.indicatorId.startsWith("education.vet_")).map((f) => f.year);
    return {
      cards: buildEducationHubCards(facts.map(toClientEducationFact), presentation),
      firstPeriod: schoolYearLabel(Math.min(...schoolYears)), lastPeriod: schoolYearLabel(Math.max(...schoolYears)), lastReviewedAt: facts.map((f) => f.lastReviewedAt).sort().at(-1) ?? "",
    };
  },
  "science-culture": async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedScienceCultureData(), getPresentation(locale, ["scienceCulture", "groups"], [])]);
    return yearly(buildScienceCultureHubCards(facts.map(toClientScienceCultureFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  crime: async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedCrimeData(), getPresentation(locale, ["crime", "groups"], [])]);
    return yearly(buildCrimeHubCards(facts.map(toClientCrimeFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  internet: async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedInternetData(), getPresentation(locale, ["internet", "groups"], [])]);
    return yearly(buildInternetHubCards(facts.map(toClientInternetFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  trade: async (locale) => {
    const [{ facts }, partners, products, domestic, services, composition] = await Promise.all([loadServedTradeOverviewData(), loadServedTradePartnersData(), loadServedTradeProductsData(), loadServedTradeDomesticData(), loadServedTradeServicesData(), loadServedTradeCompositionData()]);
    // English partner names, for the largest partner the Partners card names.
    const presentation = await getPresentation(locale, ["trade", "groups"], partners.entities.map((entity) => entity.id));
    const partnerData = toClientTradePartnersData(partners, facts);
    const cards = buildTradeHubCards(facts.map(toClientTradeOverviewFact), presentation, tradePartnersCoverage(partnerData), tradeProductsCoverage(toClientTradeProductsData(products, [], "", PRODUCT_SOURCE_BLOCK)), toClientTradeDomesticData(domestic, []).national, toClientTradeServicesData(services).national, toClientTradeCompositionData(composition, facts).sitc.nationalFacts.filter((fact) => fact.indicatorId === "trade.exports"), partnerData);
    // The header's coverage label spans every trade dataset the hub links to (U28-06).
    const all = [...facts, ...partners.facts, ...products.facts, ...domestic.facts, ...services.facts, ...composition.facts];
    return yearly(cards, all.map((f) => f.year), all.map((f) => f.lastReviewedAt));
  },
  external: async (locale) => {
    const [transfers, investment, account, position] = await Promise.all([loadServedMoneyTransfersData(), loadServedForeignInvestmentData(), loadServedCurrentAccountFacts(), loadServedExternalPositionData()]);
    const [money, foreign] = [toClientMoneyTransfersData(transfers), toClientForeignInvestmentData(investment)];
    // English country names: the money and investment pages' models name their lists.
    const presentation = await getPresentation(locale, ["external", "groups"], [...money.entities, ...foreign.entities].map((entity) => entity.id));
    const cards = buildExternalHubCards(money, foreign, toClientCurrentAccountFacts(account), position.facts.map(toClientExternalPositionFact), presentation, true);
    // The header's coverage label spans the five external datasets (U28-06).
    const all = [...transfers.facts, ...investment.facts, ...account, ...position.facts];
    return yearly(cards, all.map((f) => f.year), all.map((f) => f.lastReviewedAt));
  },
  "energy-food": async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedEnergyFoodData(), getPresentation(locale, ["energyFood", "groups"], [])]);
    return yearly(buildEnergyFoodHubCards(facts.map(toClientEnergyFoodFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  environment: async (locale) => {
    const [facts, presentation] = await Promise.all([loadServedEnvironmentData(), getPresentation(locale, ["environment", "groups"], [])]);
    return yearly(buildEnvironmentHubCards(facts.map(toClientEnvironmentFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  transport: async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedTransportData(), getPresentation(locale, ["transport", "groups"], [])]);
    return yearly(buildTransportHubCards(facts.map(toClientTransportFact), presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
  demography: async (locale) => {
    const [{ facts }, presentation] = await Promise.all([loadServedDemographyData(), getPresentation(locale, ["demography", "groups"], [])]);
    // The header's coverage label spans the demography facts (U28-06).
    return yearly(buildDemographyHubCards(facts, presentation), facts.map((f) => f.year), facts.map((f) => f.lastReviewedAt));
  },
};

const loaded = new Map<string, Promise<TopicHubData>>();

/** Each topic's hub data, loaded once per language for the build. */
export const TOPIC_HUB_LOADERS = Object.fromEntries(Object.entries(LOADERS).map(([topic, load]) => [topic, (locale: Locale) => {
  const key = `${locale}:${topic}`;
  if (!loaded.has(key)) loaded.set(key, load(locale).then((data) => ({ topic: topic as TopicId, ...data })));
  return loaded.get(key)!;
}])) as Record<TopicId, (locale: Locale) => Promise<TopicHubData>>;

export function loadTopicHubs(locale: Locale, topics: readonly TopicId[]): Promise<TopicHubData[]> {
  return Promise.all(topics.map((topic) => TOPIC_HUB_LOADERS[topic](locale)));
}

/** The header's coverage label for a topic: `{first}–{last} · განახლდა {date}`. */
export function topicHubCoverage(messages: Messages, locale: Locale, hub: TopicHubData): string {
  return coverageLabel(messages, locale, hub.firstPeriod, hub.lastPeriod, hub.lastReviewedAt || undefined);
}
