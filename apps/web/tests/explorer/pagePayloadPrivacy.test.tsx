import { cloneElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DebtExplorer } from "../../components/debt/debt-explorer";
import { AgeSexExplorer } from "../../components/demography/age-sex-explorer";
import { PopulationPlaceExplorer } from "../../components/demography/population-place-explorer";
import { EconomicSectorsExplorer } from "../../components/economic-sectors/economic-sectors-explorer";
import { MoneyFromAbroad } from "../../components/external/money-from-abroad";
import { HouseholdExplorer } from "../../components/household/household-explorer";
import { loadServedTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { getMessages } from "../../lib/i18n/messages.server";
import { renderDemographyBirthsDeathsPage } from "../../lib/pages/demography-births-deaths";
import { renderDemographyPopulationPage } from "../../lib/pages/demography-population";
import { renderMunicipalIndex } from "../../lib/pages/municipal-index";
import { renderRegionalEconomiesPage } from "../../lib/pages/regional-economies";
import { MainExplorer } from "../../components/main-explorer/main-explorer";
import { RegionalEconomyExplorer } from "../../components/regional-economies/regional-economy-explorer";
import { WagesExplorer } from "../../components/wages/wages-explorer";
import { WagesRegionsIndex } from "../../components/wages/wages-regions-index";
import { AgeSexRegions } from "../../components/demography/age-sex-regions";
import { HouseholdIndex } from "../../components/household/household-index";
import { MunicipalExplorer } from "../../components/municipalities/municipal-explorer";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { RegionalEconomiesIndex } from "../../components/regional-economies/regional-economies-index";
import { SiteFooterView } from "../../components/site/site-footer-view";
import { UnemploymentExplorer } from "../../components/unemployment/unemployment-explorer";
import { UnemploymentRegionsIndex } from "../../components/unemployment/unemployment-regions-index";
import { MoneyBanksExplorer } from "../../components/money-banks/money-banks-explorer";
import { TradeDomesticExports } from "../../components/trade/trade-domestic-exports";
import { TradeProducts } from "../../components/trade/trade-products";
import { packFacts, unpackFacts, type PackedFacts } from "../../lib/data/packedFacts";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { buildTradeProductsModel } from "../../lib/explorer/tradeProducts";
import { findTradeProducts } from "../../lib/explorer/tradeProductsCatalogue";
import { DEFAULT_TRADE_PRODUCTS_STATE } from "../../lib/explorer/tradeProductsState";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale, Presentation } from "../../lib/i18n/types";
import { renderAnalysisPage } from "../../lib/pages/analysis";
import { renderDebtPage } from "../../lib/pages/debt";
import { renderDemographyAgeSexPage } from "../../lib/pages/demography-age-sex";
import { renderPopulationPlacePage } from "../../lib/pages/demography-population-place";
import { renderEconomicSectorsPage } from "../../lib/pages/economic-sectors";
import { renderExpenditurePage } from "../../lib/pages/expenditure";
import { renderForeignInvestmentPage, renderMoneyFromAbroadPage } from "../../lib/pages/external";
import { renderHouseholdRegionPage } from "../../lib/pages/household";
import { renderHouseholdIndexPage } from "../../lib/pages/household-index";
import { renderMethodologyArticle } from "../../lib/pages/methodology-article";
import { renderMoneyBanksPage } from "../../lib/pages/moneyBanks";
import { renderMunicipalCountry } from "../../lib/pages/municipal-country";
import { renderMunicipalRegion } from "../../lib/pages/municipal-region";
import { renderMunicipality } from "../../lib/pages/municipality";
import { renderRegionalEconomyPage } from "../../lib/pages/regional-economy";
import { renderRevenuePage } from "../../lib/pages/revenue";
import { renderTradeDomesticPage, renderTradeOverviewPage, renderTradePartnersPage, renderTradeProductsPage } from "../../lib/pages/trade";
import { renderUnemploymentPage } from "../../lib/pages/unemployment";
import { renderWagesPage } from "../../lib/pages/wages";
import { renderWagesRegionsIndexPage } from "../../lib/pages/wages-regions-index";

// A page ships two things: its markup and, in the RSC payload, every prop a server page hands a client component.
// The payload is not in renderToStaticMarkup's output, so the props of every element in the tree are read as well.
function shippedProps(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(shippedProps).join("");
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";
  const { children, ...props } = node.props;
  return JSON.stringify(props) + shippedProps(children);
}

/** The props a page hands each element of one component type, in tree order. */
function propsOf<P>(node: ReactNode, type: unknown): P[] {
  if (Array.isArray(node)) return node.flatMap((child) => propsOf<P>(child, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [...(node.type === type ? [node.props as P] : []), ...propsOf<P>(node.props.children, type)];
}
const count = (text: string, part: string) => text.split(part).length - 1;

type PageRender = [string, (locale: Locale) => Promise<ReactNode>];

const budgetPages: PageRender[] = [
  ["expenditure", renderExpenditurePage],
  ["revenue", renderRevenuePage],
  ["analysis", renderAnalysisPage],
];

const municipalPages: PageRender[] = [
  ["municipality", (locale) => renderMunicipality("tbilisi", locale)],
  ["region", (locale) => renderMunicipalRegion("imereti", locale)],
  ["country", renderMunicipalCountry],
];

describe.each(["ka", "en"] as const)("%s", (locale) => {
  test.each(budgetPages)("budget pages ship no glossary notes: %s", async (_name, renderPage) => {
    const page = await renderPage(locale);
    const html = renderToStaticMarkup(page) + shippedProps(page);
    expect(["Confirm against source", "Temporary source aggregate", "by user decision"].filter((note) => html.includes(note))).toEqual([]);
  });

  test.each(municipalPages)("municipal pages ship only public fact fields: %s", async (_name, renderPage) => {
    // Props only: the municipal pages' markup needs the client I18nProvider context to render here, and a fact's
    // field names can reach the HTML only through the payload, never through the visible text.
    const html = shippedProps(await renderPage(locale));
    expect(["reconciliationDifferenceGel", "warningType", "sourceId"].filter((field) => html.includes(field))).toEqual([]);
  });
});

// Platform review U22-02, U23-02 (Task 27): a Georgian page names its series in Georgian, so it ships only the English
// names its own search reads.
describe("English names on Georgian pages", () => {
  test("the Georgian page carries no English series names: trade products", async () => {
    const page = await renderTradeProductsPage("ka");
    expect(propsOf<Presentation>(page, I18nProvider)[0]!.englishLabels).toEqual({});
    // The product search reads each source English name, which ships once.
    expect(count(shippedProps(page), '"Live horses, asses, mules and hinnies"')).toBe(1);
  });

  test.each(["ka", "en"] as const)("%s: the trade products search finds a product by its English name", async (locale) => {
    const page = await renderTradeProductsPage(locale);
    const presentation = propsOf<Presentation>(page, I18nProvider)[0]!, { data } = propsOf<{ data: ClientTradeProductsData }>(page, TradeProducts)[0]!;
    const model = buildTradeProductsModel(data, DEFAULT_TRADE_PRODUCTS_STATE, presentation);
    const found = findTradeProducts({ data, model, presentation, view: "all", categoryId: null, query: "live horses", selectedIds: [], page: 0 });
    expect(found.rows.map((row) => row.entityId)).toEqual(["goods.hs4.2020-2025.0101"]);
  });

  test("the English trade products page ships each English name once", async () => {
    expect(count(shippedProps(await renderTradeProductsPage("en")), '"Live horses, asses, mules and hinnies"')).toBe(1);
  });

  test("the Georgian domestic exports page ships only the countries' English names, for the country search", async () => {
    const page = await renderTradeDomesticPage("ka");
    const [{ data }] = propsOf<{ data: Record<string, unknown> & { countries: { entities: { id: string }[] } } }>(page, TradeDomesticExports);
    expect(Object.keys(propsOf<Presentation>(page, I18nProvider)[0]!.englishLabels).sort()).toEqual(data.countries.entities.map((entity) => entity.id).sort());
    expect(data).not.toHaveProperty("englishLabels");
  });

  test.each([["money from abroad", renderMoneyFromAbroadPage], ["foreign investment", renderForeignInvestmentPage]] as const)("the Georgian page carries no English series names: %s", async (_name, renderPage) => {
    const [ka, en] = await Promise.all([renderPage("ka"), renderPage("en")]);
    expect(propsOf<Presentation>(ka, I18nProvider)[0]!.englishLabels).toEqual({});
    const shipped = shippedProps(ka), english = Object.values(propsOf<Presentation>(en, I18nProvider)[0]!.englishLabels);
    expect(english.length).toBeGreaterThan(10);
    expect(english.filter((label) => shipped.includes(JSON.stringify(label)))).toEqual([]);
  });

  test("money from abroad names only the entities it serves, not the withheld transfers estimate", async () => {
    const shipped = shippedProps(await renderMoneyFromAbroadPage("en"));
    expect(shipped).not.toContain("bop.personal_transfers");
    expect(shipped).not.toContain("Personal transfers");
  });

  // The region and place searches (RegionIndex, RegionPicker, MunicipalitiesIndex, EntityPicker) look an English name
  // up only once someone types or opens the picker, so a name missing from a Georgian page's list would not fail the
  // build: it would throw "Missing English label" at the first search. Every place a search component receives (a row
  // with a Georgian name: its id, code and region) must have its English name in what the Georgian page ships.
  const searchedPages: [string, () => Promise<ReactNode>, unknown[]][] = [
    ["regional economies index", () => renderRegionalEconomiesPage("ka"), [RegionalEconomiesIndex]],
    ["regional economy page", () => renderRegionalEconomyPage("tbilisi", "ka"), [RegionalEconomyExplorer]],
    ["unemployment regions index", () => renderUnemploymentPage("ka", "regions"), [UnemploymentRegionsIndex]],
    ["unemployment region page", () => renderUnemploymentPage("ka", "regions", "region.imereti"), [UnemploymentExplorer]],
    ["wages regions index", () => renderWagesRegionsIndexPage("ka"), [WagesRegionsIndex]],
    ["wages region page", () => renderWagesPage("ka", "regions", "region.imereti"), [WagesExplorer]],
    ["household index", () => renderHouseholdIndexPage("ka", "income"), [HouseholdIndex]],
    ["household area page", () => renderHouseholdRegionPage("income", "imereti", "ka"), [HouseholdExplorer]],
    ["municipal index", () => renderMunicipalIndex("ka"), [MunicipalitiesIndex]],
    ["municipality", () => renderMunicipality("tbilisi", "ka"), [MunicipalExplorer]],
    ["population index", () => renderDemographyPopulationPage("ka"), [MunicipalitiesIndex]],
    ["population place page", () => renderPopulationPlacePage({ kind: "region", id: "imereti" }, "ka"), [PopulationPlaceExplorer]],
    ["births and deaths index", () => renderDemographyBirthsDeathsPage("ka"), [MunicipalitiesIndex]],
    ["age and sex regions", () => renderDemographyAgeSexPage("ka"), [AgeSexRegions]],
  ];
  /** The ids, codes and regions of every place row (an object with a Georgian name) in a component's props. */
  function placeIds(value: unknown, ids = new Set<string>(), seen = new WeakSet<object>()): Set<string> {
    if (!value || typeof value !== "object" || seen.has(value)) return ids;
    seen.add(value);
    if (Array.isArray(value)) value.forEach((item) => placeIds(item, ids, seen));
    else {
      const row = value as Record<string, unknown>;
      if (typeof row.nameKa === "string" || typeof row.kaLabel === "string") for (const key of ["id", "code", "regionId"]) if (typeof row[key] === "string") ids.add(row[key]);
      Object.values(row).forEach((item) => placeIds(item, ids, seen));
    }
    return ids;
  }
  test.each(searchedPages)("the Georgian %s ships the English name of every place its search can match", async (_name, renderPage, types) => {
    const page = await renderPage();
    const hosts = types.flatMap((type) => propsOf<Record<string, unknown> & { presentation?: Presentation }>(page, type));
    expect(hosts.length).toBeGreaterThan(0);
    const shipped = new Set([...propsOf<Presentation>(page, I18nProvider), ...hosts.flatMap((host) => host.presentation ? [host.presentation] : [])].flatMap((p) => Object.keys(p.englishLabels)));
    const ids = placeIds(hosts);
    expect(ids.size).toBeGreaterThanOrEqual(11);
    expect([...ids].filter((id) => !shipped.has(id))).toEqual([]);
  });

  // The English page's search reads the curated English label in place of the Geostat English name it no longer ships;
  // they agree today (trailing spaces aside), and a rewording of either becomes a reviewed decision here.
  test("the curated English name of every shipped product is its Geostat English name", async () => {
    const [{ entities }, catalogue] = await Promise.all([loadServedTradeProductsData(), loadEnglishCatalogue(process.cwd() + "/../..")]);
    const shipped = entities.filter((entity) => entity.sourceBlock === "2020-2025");
    expect(shipped.length).toBeGreaterThan(1000);
    expect(shipped.filter((entity) => catalogue.labels[entity.id]?.text.trim() !== entity.sourceLabelEn.trim()).map((entity) => entity.id)).toEqual([]);
  });
});

describe.each(["ka", "en"] as const)("%s small payload rules", (locale) => {
  test("products ship no empty alias lists (U22-03)", async () => {
    const shipped = shippedProps(await renderTradeProductsPage(locale)) + shippedProps(await renderTradeDomesticPage(locale));
    expect(shipped).not.toMatch(/"aliases(Ka|En)":\[\]/);
  });

  test("the footer logo is lazy, so React does not preload it ahead of the header logo (U01-11)", async () => {
    const html = renderToStaticMarkup(<SiteFooterView locale={locale} messages={await getMessages(locale, ["common"])} />);
    expect(html).toMatch(/<img[^>]*data-testid="site-footer-logo"[^>]*loading="lazy"/);
  });
});

// Task 27: fields no page reads stay on the server.
describe.each(["ka", "en"] as const)("%s pages ship only the fields they read", (locale) => {
  test.each([["overview", renderTradeOverviewPage], ["partners", renderTradePartnersPage], ["products", renderTradeProductsPage]] as const)("trade %s totals carry no source or review metadata (U21-15)", async (_name, renderPage) => {
    const shipped = shippedProps(await renderPage(locale));
    expect(["\"publicationStatus\":", "\"role\":\"total\"", "\"role\":\"derived\""].filter((field) => shipped.includes(field))).toEqual([]);
  });

  test("unemployment observations carry no published duplicate of the value (U17-02)", async () => {
    expect(shippedProps(await renderUnemploymentPage(locale, "overview"))).not.toContain("publishedValue");
  });

  test("the methodology archive rows carry no media type (U29-14)", async () => {
    expect(shippedProps(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "expenditure" }) }))).not.toContain("media_type");
  });

  test("debt ships GDP only for the years debt covers (U06-17)", async () => {
    const [{ facts, gdpFacts }] = propsOf<{ facts: { year: number }[]; gdpFacts: { year: number }[] }>(await renderDebtPage(locale), DebtExplorer);
    const years = facts.map((fact) => fact.year);
    expect(Math.min(...gdpFacts.map((fact) => fact.year))).toBe(Math.min(...years));
    expect(gdpFacts.every((fact) => fact.year <= Math.max(...years))).toBe(true);
  });

  test("a money and banks page ships only the source files its observations cite (U24-08)", async () => {
    const [{ facts, sources }] = propsOf<{ facts: { sourceId: string }[]; sources: { sourceId: string }[] }>(await renderMoneyBanksPage(locale, "loans-deposits"), MoneyBanksExplorer);
    expect(new Set(sources.map((source) => source.sourceId))).toEqual(new Set(facts.map((fact) => fact.sourceId)));
  });
});

// Task 28: the heaviest topic pages ship their facts packed (lib/data/packedFacts.ts). Each payload is the facts prop
// of the page's explorer, at least 30% smaller than the Georgian page's objects measured before (in characters of
// JSON), and unpacks to facts that pack to the same payload again.
type PackedProp = PackedFacts<object>;
const factsProp = <P extends { facts: PackedProp }>(type: unknown) => async (page: Promise<ReactNode>) => [propsOf<P>(await page, type)[0]!.facts];
const heaviestPages: [string, number, () => Promise<PackedProp[]>][] = [
  ["money from abroad (U23-01)", 1_224_713, async () => [propsOf<{ data: { facts: PackedProp } }>(await renderMoneyFromAbroadPage("ka"), MoneyFromAbroad)[0]!.data.facts]],
  ["wages industries (U18-01)", 383_860, () => factsProp(WagesExplorer)(renderWagesPage("ka", "industries"))],
  ["household income, Georgia (U19-03)", 171_734, () => factsProp(HouseholdExplorer)(renderHouseholdRegionPage("income", "georgia", "ka"))],
  ["household spending, Georgia (U19-03)", 216_231, () => factsProp(HouseholdExplorer)(renderHouseholdRegionPage("spending", "georgia", "ka"))],
  ["regional economy, Imereti (U12-08)", 86_918, () => factsProp(RegionalEconomyExplorer)(renderRegionalEconomyPage("imereti", "ka"))],
  ["economic sectors (U11-03)", 105_126, () => factsProp(EconomicSectorsExplorer)(renderEconomicSectorsPage("ka"))],
  ["population and sex by age (U27-08)", 75_430, () => factsProp(AgeSexExplorer)(renderDemographyAgeSexPage("ka"))],
  ["population, Lentekhi (U26-03)", 99_513, () => factsProp(PopulationPlaceExplorer)(renderPopulationPlacePage({ kind: "municipality", slug: "lentekhi" }, "ka"))],
  ["expenditure, functions and ministries (U03-07)", 31_408 + 181_997, async () => { const [{ facts, adminFacts }] = propsOf<{ facts: PackedProp; adminFacts: PackedProp }>(await renderExpenditurePage("ka"), MainExplorer); return [facts, adminFacts]; }],
];
describe("the heaviest topic pages ship packed facts", () => {
  test.each(heaviestPages)("%s", async (_name, before, payload) => {
    const packed = await payload();
    expect(JSON.stringify(packed).length).toBeLessThan(before * 0.7);
    for (const facts of packed) expect(packFacts(unpackFacts(JSON.parse(JSON.stringify(facts)) as PackedProp))).toEqual(facts);
  });
});

/** The page's tree with every packed facts prop replaced: as the browser receives it (through JSON) or as plain facts. */
function withFacts(node: ReactNode, replace: (facts: PackedProp) => unknown): ReactNode {
  if (Array.isArray(node)) return node.map((child) => withFacts(child, replace));
  if (!isValidElement<Record<string, unknown> & { children?: ReactNode }>(node)) return node;
  const packed = (value: unknown): value is PackedProp => typeof value === "object" && value !== null && "rows" in value && "fields" in value;
  const props: Record<string, unknown> = { children: withFacts(node.props.children, replace) };
  for (const [key, value] of Object.entries(node.props)) {
    if (packed(value)) props[key] = replace(value);
    else if (key === "data" && typeof value === "object" && value !== null && packed((value as { facts?: unknown }).facts)) props[key] = { ...value, facts: replace((value as { facts: PackedProp }).facts) };
  }
  return cloneElement(node, props);
}

describe.each(["ka", "en"] as const)("%s: a packed page renders as its facts do", (locale) => {
  test.each([
    ["money from abroad", () => renderMoneyFromAbroadPage(locale)],
    ["wages industries", () => renderWagesPage(locale, "industries")],
    ["household spending, Georgia", () => renderHouseholdRegionPage("spending", "georgia", locale)],
    ["regional economy, Imereti", () => renderRegionalEconomyPage("imereti", locale)],
    ["economic sectors", () => renderEconomicSectorsPage(locale)],
    ["population and sex by age", () => renderDemographyAgeSexPage(locale)],
    // The population place pages need the app router to render; populationPlaceExplorer.test.tsx renders their explorer.
    ["expenditure", () => renderExpenditurePage(locale)],
  ] as const)("%s", async (_name, renderPage) => {
    const page = await renderPage();
    const shipped = renderToStaticMarkup(withFacts(page, (facts) => JSON.parse(JSON.stringify(facts))));
    expect(shipped).toBe(renderToStaticMarkup(withFacts(page, (facts) => unpackFacts(facts).map((fact) => ({ ...fact })))));
    expect(shipped).toContain('data-testid="');
  });
});
