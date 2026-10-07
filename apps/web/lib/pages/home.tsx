import { LandingPage } from "../../components/landing/landing-page";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { buildLandingModel } from "../landing/landingData";
import { buildLandingDatasetLinks } from "../landing/landingDatasets";
import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { loadServedUnemploymentData } from "../data/unemployment/importUnemployment";
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
  const [landingData, municipalData, debtData, balanceData, gdpData, inflationData, unemploymentData] = await Promise.all([
    loadServedLandingData(), loadServedMunicipalData(), loadServedGovernmentDebtData(), loadServedGeneralGovernmentBalanceData(),
    loadServedGdpOverviewData(), loadServedInflationData(), loadServedUnemploymentData(),
  ]);
  // "inflation" supplies the short month names of the inflation figure's period.
  const presentation = await getPresentation(locale, ["common", "landing", "inflation"], [...landingData.glossary.keys(), ...municipalData.municipalities.map(entity => entity.code)]);
  const model = buildLandingModel({
    ...landingData,
    municipalities: municipalData.municipalities,
    municipalTotalFacts: municipalData.totalFacts,
    municipalCountryTotalFacts: municipalData.countryTotalFacts,
    debtFacts: debtData.facts,
    balanceFacts: balanceData.facts,
  }, presentation);
  const datasets = buildLandingDatasetLinks({
    expenditure: model.expenditure,
    gdpFacts: gdpData.facts,
    cpiFacts: inflationData.facts,
    unemploymentFacts: unemploymentData.facts,
  }, presentation);
  const rootUrl = new URL(pageHref("/", locale), `${resolveSiteUrl()}/`).href;
  const ka = `${resolveSiteUrl()}/`;
  const en = `${resolveSiteUrl()}/en`;
  return <><link rel="canonical" href={rootUrl} /><link rel="alternate" hrefLang="ka" href={ka} /><link rel="alternate" hrefLang="en" href={en} /><link rel="alternate" hrefLang="x-default" href={ka} /><meta property="og:url" content={rootUrl} /><LandingPage model={model} datasets={datasets} presentation={presentation} /></>;
}
