import path from "node:path";
import { LandingPage } from "../../components/landing/landing-page";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { loadServedHealthData } from "../data/health/importHealth";
import { loadServedTradeOverviewData } from "../data/tradeOverview/importTradeOverview";
import { loadServedTradePartnersData } from "../data/tradePartners/importTradePartners";
import { loadServedTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { loadServedUnemploymentData } from "../data/unemployment/importUnemployment";
import { loadServedWagesData } from "../data/wages/importWages";
import { loadServedForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { buildMunicipalListRows, MUNICIPAL_PER_RESIDENT_YEAR } from "../explorer/municipalData";
import { buildHomeChapters, societyEnglishLabelIds } from "../landing/chapters";
import { buildLandingContext, landingGdpFigure } from "../landing/landingData";
import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { buildMethodologyHubEntries } from "../methodology/catalog";
import { loadGeneratedArchiveSummaries } from "../methodology/prepareArchives";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import type { Locale } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";

export async function homePageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["landing"]);
  const rootMetadata = fiscalMetadata({ locale, title: message(messages, "landing.metaTitle"), description: message(messages, "landing.metaDescription"), path: "/" });
  // Preserve the exact root-slash canonical contract through the explicit tags below.
  return { ...rootMetadata, alternates: undefined, openGraph: rootMetadata.openGraph ? { ...rootMetadata.openGraph, url: undefined } : undefined };
}

export async function renderHomePage(locale: Locale) {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [landingData, municipalData, debtData, balanceData, gdpData, fdiData, transferData, archives, demographyData, unemploymentData, wagesData, tradeOverview, tradePartners, tradeProducts, healthData] = await Promise.all([
    loadServedLandingData(), loadServedMunicipalData(), loadServedGovernmentDebtData(), loadServedGeneralGovernmentBalanceData(),
    loadServedGdpOverviewData(), loadServedForeignInvestmentData(), loadServedMoneyTransfersData(), loadGeneratedArchiveSummaries(repositoryRoot),
    loadServedDemographyData(), loadServedUnemploymentData(), loadServedWagesData(),
    loadServedTradeOverviewData(), loadServedTradePartnersData(), loadServedTradeProductsData(), loadServedHealthData(),
  ]);
  const trade = { overview: tradeOverview.facts, partners: tradePartners, products: tradeProducts };
  const presentation = await getPresentation(locale, ["landing", "health"], [
    ...landingData.glossary.keys(), ...municipalData.municipalities.map(entity => entity.code), ...societyEnglishLabelIds(trade),
  ]);
  const { updatedAt } = buildLandingContext(landingData);
  const municipalList = buildMunicipalListRows({
    municipalities: municipalData.municipalities,
    regionLabels: new Map(municipalData.regions.map((region) => [region.id, region.kaLabel])),
    totalFacts: municipalData.totalFacts,
    populationFacts: municipalData.populationFacts,
    adjaraBudgetAdjustments: municipalData.adjaraBudgetAdjustments,
    year: MUNICIPAL_PER_RESIDENT_YEAR,
  });
  const chapters = buildHomeChapters({
    gdp: gdpData.facts,
    debtFacts: debtData.facts,
    balanceFacts: balanceData.facts,
    municipalTotals: new Map(municipalData.countryTotalFacts.filter((fact) => fact.municipalityCode === MUNICIPAL_COUNTRY_ID).map((fact) => [fact.year, fact.publicTotalGel])),
    fdiFacts: fdiData.facts,
    transferFacts: transferData.facts,
    budgetFacts: landingData.facts,
    glossary: landingData.glossary,
    municipalRows: municipalList.municipalities,
    municipalYear: MUNICIPAL_PER_RESIDENT_YEAR,
    demographyFacts: demographyData.facts,
    unemploymentFacts: unemploymentData.facts,
    wagesFacts: wagesData.facts,
    trade,
    healthFacts: healthData.facts,
    methodologyEntries: buildMethodologyHubEntries({ budgetFacts: landingData.facts, municipalFacts: municipalData.totalFacts, debtFacts: debtData.facts, archives }, locale),
    updatedAt,
  }, presentation);
  const rootUrl = new URL(pageHref("/", locale), `${resolveSiteUrl()}/`).href;
  const ka = `${resolveSiteUrl()}/`;
  const en = `${resolveSiteUrl()}/en`;
  return <><link rel="canonical" href={rootUrl} /><link rel="alternate" hrefLang="ka" href={ka} /><link rel="alternate" hrefLang="en" href={en} /><link rel="alternate" hrefLang="x-default" href={ka} /><meta property="og:url" content={rootUrl} /><LandingPage chapters={chapters} gdpFigure={landingGdpFigure(gdpData.facts, presentation.messages)} presentation={presentation} updatedAt={updatedAt} mcpEndpoint={`${resolveSiteUrl()}/mcp`} /></>;
}
