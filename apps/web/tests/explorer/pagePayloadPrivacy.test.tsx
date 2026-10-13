import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DebtExplorer } from "../../components/debt/debt-explorer";
import { MoneyBanksExplorer } from "../../components/money-banks/money-banks-explorer";
import { TradeDomesticExports } from "../../components/trade/trade-domestic-exports";
import { TradeProducts } from "../../components/trade/trade-products";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { buildTradeProductsModel } from "../../lib/explorer/tradeProducts";
import { findTradeProducts } from "../../lib/explorer/tradeProductsCatalogue";
import { DEFAULT_TRADE_PRODUCTS_STATE } from "../../lib/explorer/tradeProductsState";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale, Presentation } from "../../lib/i18n/types";
import { renderAnalysisPage } from "../../lib/pages/analysis";
import { renderDebtPage } from "../../lib/pages/debt";
import { renderExpenditurePage } from "../../lib/pages/expenditure";
import { renderForeignInvestmentPage, renderMoneyFromAbroadPage } from "../../lib/pages/external";
import { renderMethodologyArticle } from "../../lib/pages/methodology-article";
import { renderMoneyBanksPage } from "../../lib/pages/moneyBanks";
import { renderMunicipalCountry } from "../../lib/pages/municipal-country";
import { renderMunicipalRegion } from "../../lib/pages/municipal-region";
import { renderMunicipality } from "../../lib/pages/municipality";
import { renderRevenuePage } from "../../lib/pages/revenue";
import { renderTradeDomesticPage, renderTradeOverviewPage, renderTradePartnersPage, renderTradeProductsPage } from "../../lib/pages/trade";
import { renderUnemploymentPage } from "../../lib/pages/unemployment";

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
