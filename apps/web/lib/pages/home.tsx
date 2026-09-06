import { LandingPage } from "../../components/landing/landing-page";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { buildLandingModel } from "../landing/landingData";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import type { Locale } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";

export async function homePageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["landing"]);
  const rootMetadata = fiscalMetadata({ title: message(messages, "landing.metaTitle"), description: message(messages, "landing.metaDescription"), path: pageHref("/", locale) });
  // Preserve the exact root-slash canonical contract through the explicit tags below.
  return { ...rootMetadata, alternates: undefined, openGraph: rootMetadata.openGraph ? { ...rootMetadata.openGraph, url: undefined } : undefined };
}

export async function renderHomePage(locale: Locale) {
  const [landingData, municipalData, debtData, balanceData] = await Promise.all([
    loadServedLandingData(), loadServedMunicipalData(), loadServedGovernmentDebtData(), loadServedGeneralGovernmentBalanceData(),
  ]);
  const presentation = await getPresentation(locale, ["common", "landing"], [...landingData.glossary.keys(), ...municipalData.municipalities.map(entity => entity.code)]);
  const model = buildLandingModel({
    ...landingData,
    municipalities: municipalData.municipalities,
    municipalTotalFacts: municipalData.totalFacts,
    municipalCountryTotalFacts: municipalData.countryTotalFacts,
    debtFacts: debtData.facts,
    balanceFacts: balanceData.facts,
  }, presentation);
  const rootUrl = new URL(pageHref("/", locale), `${resolveSiteUrl()}/`).href;
  return <><link rel="canonical" href={rootUrl} /><meta property="og:url" content={rootUrl} /><LandingPage model={model} presentation={presentation} /></>;
}
