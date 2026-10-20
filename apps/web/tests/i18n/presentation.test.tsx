import { isValidElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { AnalysisExplorer } from "../../components/analysis/analysis-explorer";
import { MainExplorer } from "../../components/main-explorer/main-explorer";
import { MethodologyArticle } from "../../components/methodology/methodology-article";
import { MunicipalExplorer } from "../../components/municipalities/municipal-explorer";
import { getMessages } from "../../lib/i18n/messages.server";
import { clientPresentation, getPresentation, LAYOUT_SCOPES } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale, Messages, Presentation } from "../../lib/i18n/types";
import { renderAnalysisPage } from "../../lib/pages/analysis";
import { renderDebtPage } from "../../lib/pages/debt";
import { renderDeficitPage } from "../../lib/pages/deficit";
import { renderDemographyPage } from "../../lib/pages/demography";
import { renderDemographyAgeSexPage } from "../../lib/pages/demography-age-sex";
import { renderDemographyBirthsDeathsPage } from "../../lib/pages/demography-births-deaths";
import { renderDemographyMigrationPage } from "../../lib/pages/demography-migration";
import { renderDemographyPopulationPage } from "../../lib/pages/demography-population";
import { renderPopulationPlacePage } from "../../lib/pages/demography-population-place";
import { renderEconomicSectorsPage } from "../../lib/pages/economic-sectors";
import { renderEconomyPage } from "../../lib/pages/economy";
import { renderEnergyFoodPage } from "../../lib/pages/energy-food";
import { renderExpenditurePage } from "../../lib/pages/expenditure";
import { renderCurrentAccountPage, renderForeignInvestmentPage, renderMoneyFromAbroadPage } from "../../lib/pages/external";
import { renderGdpPage } from "../../lib/pages/gdp";
import { renderHealthPage } from "../../lib/pages/health";
import { renderCrimePage } from "../../lib/pages/crime";
import { renderHealthDeathsAreaPage } from "../../lib/pages/health-deaths";
import { renderHealthDeathsIndex } from "../../lib/pages/health-deaths-index";
import { renderHouseholdRegionPage } from "../../lib/pages/household";
import { renderHubPage, TopicHub } from "../../lib/pages/hub";
import { renderEnergyFoodHub } from "../../lib/pages/hubs/energy-food";
import { renderEnvironmentHub } from "../../lib/pages/hubs/environment";
import { renderEnvironmentPage } from "../../lib/pages/environment";
import { renderEnvironmentAirQualityIndex, renderEnvironmentCityPage } from "../../lib/pages/environment-air-quality";
import { renderEnvironmentAreaPage, renderEnvironmentRegionIndex } from "../../lib/pages/environment-areas";
import { renderExternalHub } from "../../lib/pages/hubs/external";
import { renderHealthHub } from "../../lib/pages/hubs/health";
import { renderCrimeHub } from "../../lib/pages/hubs/crime";
import { renderInflationHub } from "../../lib/pages/hubs/inflation";
import { renderMoneyBanksHub } from "../../lib/pages/hubs/moneyBanks";
import { renderTradeHub } from "../../lib/pages/hubs/trade";
import { renderUnemploymentHub } from "../../lib/pages/hubs/unemployment";
import { renderWagesHub } from "../../lib/pages/hubs/wages";
import { renderInflationCategories } from "../../lib/pages/inflation-categories";
import { renderInflationCities } from "../../lib/pages/inflation-cities";
import { renderInflationOverview } from "../../lib/pages/inflation-overview";
import { renderInflationProducts } from "../../lib/pages/inflation-products";
import { renderLabourPage } from "../../lib/pages/labour";
import { renderLivingStandardsHub } from "../../lib/pages/living-standards";
import { renderMethodologyArticle } from "../../lib/pages/methodology-article";
import { renderMoneyBanksPage } from "../../lib/pages/moneyBanks";
import { renderMunicipalCountry } from "../../lib/pages/municipal-country";
import { renderMunicipalIndex } from "../../lib/pages/municipal-index";
import { renderMunicipalRegion } from "../../lib/pages/municipal-region";
import { renderMunicipality } from "../../lib/pages/municipality";
import { renderPovertyPage } from "../../lib/pages/poverty";
import { renderRegionalEconomiesPage } from "../../lib/pages/regional-economies";
import { renderRegionalEconomyPage } from "../../lib/pages/regional-economy";
import { renderRevenuePage } from "../../lib/pages/revenue";
import { renderTradeDomesticPage, renderTradeOverviewPage, renderTradePartnersPage, renderTradeProductsPage, renderTradeServicesPage } from "../../lib/pages/trade";
import { renderUnemploymentPage } from "../../lib/pages/unemployment";
import { renderWagesPage } from "../../lib/pages/wages";
import { renderWagesRegionsIndexPage } from "../../lib/pages/wages-regions-index";

// Rendering a methodology page reads the archive report that only `prebuild` writes; see the helper.
vi.mock("../../lib/methodology/prepareArchives", async (importOriginal) =>
  (await import("../helpers/archive-summaries")).withValidatedArchiveSummaries(importOriginal));

// Platform review X1-12 (Task 31): the root layout's I18nProvider holds `common` and the explorer layout's adds
// `controls`. A page's own provider adds to them (lib/i18n/provider.tsx), so what a page hands its client components
// leaves both out, where 39 of 51 pages used to send `common` again.
const layoutKey = (key: string) => LAYOUT_SCOPES.some((scope) => key.startsWith(`${scope}.`));

// Server components that render a page's provider inside them are called, so their providers are read too.
const SERVER_COMPONENTS = new Set<unknown>([TopicHub, MethodologyArticle]);
const EXPLORERS = new Set<unknown>([MainExplorer, AnalysisExplorer, MunicipalExplorer]);

/** The messages every I18nProvider and client explorer in a page's tree receives. */
function shippedMessages(node: ReactNode): Messages[] {
  if (Array.isArray(node)) return node.flatMap(shippedMessages);
  if (!isValidElement<{ children?: ReactNode; messages?: Messages; presentation?: Presentation }>(node)) return [];
  if (SERVER_COMPONENTS.has(node.type)) return shippedMessages((node.type as (props: object) => ReactNode)(node.props));
  const own = node.type === I18nProvider ? [node.props.messages!] : EXPLORERS.has(node.type) ? [node.props.presentation!.messages] : [];
  return [...own, ...shippedMessages(node.props.children)];
}

type PageRender = [string, (locale: Locale) => Promise<ReactNode> | ReactNode, number];
// [page, render, the number of page providers and explorers it has]
const pages: PageRender[] = [
  ["expenditure", renderExpenditurePage, 1],
  ["revenue", renderRevenuePage, 1],
  ["analysis", renderAnalysisPage, 1],
  ["debt", renderDebtPage, 1],
  ["deficit", renderDeficitPage, 1],
  ["budget hub", renderHubPage, 0],
  ["gdp", renderGdpPage, 1],
  ["economy hub", renderEconomyPage, 0],
  ["economic sectors", renderEconomicSectorsPage, 1],
  ["regional economies", renderRegionalEconomiesPage, 1],
  ["regional economy", (locale) => renderRegionalEconomyPage("imereti", locale), 1],
  ["inflation hub", renderInflationHub, 0],
  ["inflation overview", renderInflationOverview, 1],
  ["inflation categories", renderInflationCategories, 1],
  ["inflation cities", renderInflationCities, 1],
  ["inflation products", renderInflationProducts, 1],
  ["unemployment hub", renderUnemploymentHub, 0],
  ["unemployment", (locale) => renderUnemploymentPage(locale, "overview"), 1],
  ["unemployment industries", (locale) => renderLabourPage(locale, "industries"), 1],
  ["wages hub", renderWagesHub, 0],
  ["wages", (locale) => renderWagesPage(locale, "industries"), 1],
  ["wages regions index", renderWagesRegionsIndexPage, 1],
  ["living standards hub", renderLivingStandardsHub, 0],
  ["poverty", (locale) => renderPovertyPage(locale, "inequality"), 1],
  ["household", (locale) => renderHouseholdRegionPage("income", "georgia", locale), 1],
  ["health hub", renderHealthHub, 0],
  ["health", (locale) => renderHealthPage(locale, "doctors-hospitals"), 1],
  ["causes of death", renderHealthDeathsIndex, 1],
  ["causes of death area", (locale) => renderHealthDeathsAreaPage(locale, "guria"), 1],
  ["crime hub", renderCrimeHub, 0],
  ["crime", (locale) => renderCrimePage(locale, "road-accidents"), 1],
  ["trade hub", renderTradeHub, 0],
  ["trade overview", renderTradeOverviewPage, 1],
  ["trade partners", renderTradePartnersPage, 1],
  ["trade products", renderTradeProductsPage, 1],
  ["trade domestic exports", renderTradeDomesticPage, 1],
  ["trade services", renderTradeServicesPage, 1],
  ["external hub", renderExternalHub, 0],
  ["money from abroad", renderMoneyFromAbroadPage, 1],
  ["foreign investment", renderForeignInvestmentPage, 1],
  ["current account", renderCurrentAccountPage, 1],
  ["money and banks hub", renderMoneyBanksHub, 0],
  ["money and banks", (locale) => renderMoneyBanksPage(locale, "loans-deposits"), 1],
  ["energy and food hub", renderEnergyFoodHub, 0],
  ["energy and food", (locale) => renderEnergyFoodPage(locale, "electricity"), 1],
  ["environment hub", renderEnvironmentHub, 0],
  ["environment", (locale) => renderEnvironmentPage(locale, "climate"), 1],
  ["city air quality", renderEnvironmentAirQualityIndex, 1],
  ["city air quality city", (locale) => renderEnvironmentCityPage(locale, "rustavi"), 1],
  ["waste", (locale) => renderEnvironmentRegionIndex(locale, "waste"), 1],
  ["forests area", (locale) => renderEnvironmentAreaPage(locale, "forests", "tbilisi"), 1],
  ["demography hub", renderDemographyPage, 0],
  ["population", renderDemographyPopulationPage, 1],
  ["population place", (locale) => renderPopulationPlacePage({ kind: "region", id: "imereti" }, locale), 1],
  ["births and deaths", renderDemographyBirthsDeathsPage, 1],
  ["migration", renderDemographyMigrationPage, 1],
  ["age and sex", renderDemographyAgeSexPage, 1],
  ["municipal index", renderMunicipalIndex, 1],
  ["municipal country", renderMunicipalCountry, 1],
  ["municipal region", (locale) => renderMunicipalRegion("imereti", locale), 1],
  ["municipality", (locale) => renderMunicipality("tbilisi", locale), 1],
  ["methodology article", (locale) => renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "expenditure" }) }), 1],
];

describe.each(["ka", "en"] as const)("%s", (locale) => {
  test.each(pages)("a page presentation never repeats the layout's namespaces: %s", async (_name, renderPage, providers) => {
    const shipped = shippedMessages(await renderPage(locale));
    expect(shipped).toHaveLength(providers);
    expect(shipped.flatMap((messages) => Object.keys(messages).filter(layoutKey))).toEqual([]);
  });

  test("the server still renders the layout's text, and the client presentation drops only the layout's namespaces", async () => {
    const presentation = await getPresentation(locale, ["debt"], []);
    const [common, controls, debt] = await Promise.all([getMessages(locale, ["common"]), getMessages(locale, ["controls"]), getMessages(locale, ["debt"])]);
    expect(presentation.messages).toEqual({ ...common, ...controls, ...debt });
    expect(clientPresentation(presentation)).toEqual({ ...presentation, messages: debt });
  });

  // The client presentation tells the layout's messages by their prefix, so every key must carry its namespace.
  test.each(LAYOUT_SCOPES)("every %s key starts with its namespace", async (scope) => {
    expect(Object.keys(await getMessages(locale, [scope])).filter((key) => !key.startsWith(`${scope}.`))).toEqual([]);
  });
});
