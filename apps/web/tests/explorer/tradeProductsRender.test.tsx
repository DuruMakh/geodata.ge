import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { buildTradeProductsModel } from "../../lib/explorer/tradeProducts";
import { DEFAULT_TRADE_PRODUCTS_STATE } from "../../lib/explorer/tradeProductsState";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { productData, productPresentation } from "./tradeProductsFixtures";

async function presentation(locale: "en" | "ka") { return { ...productPresentation(locale), messages: await getMessages(locale, ["trade", "controls", "common", "main", "format", "workbook"]) }; }
test.each(["en", "ka"] as const)("%s starts with the national export chart and a closed picker", async locale => {
  const { TradeProducts } = await import("../../components/trade/trade-products");
  const p = await presentation(locale);
  const html = renderToStaticMarkup(<I18nProvider {...p}><TradeProducts data={productData()} sources={[]} lastReviewedAt="2026-10-09" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  expect(html).toContain('data-mode="line"'); expect(html).toContain('data-measure="trade.exports"');
  expect(html).not.toContain('data-testid="trade-products-picker"');
  expect(html).not.toContain('data-testid="series-aside"');
  expect(html.match(/data-testid="trade-products-selected-label"/g)).toHaveLength(1);
  expect(html).toContain('data-testid="trade-products-add"'); expect(html).toContain('data-testid="trade-products-excel-download"');
  expect(html.indexOf('data-testid="chart-panel"')).toBeLessThan(html.indexOf('data-testid="trade-products-selection"'));
  expect(html).toContain(p.messages["trade.products.historicalNote"]);
  expect(html).not.toMatch(/GEL|₾/);
});

test("product ranking keeps negative values on a signed axis and retains national shares", async () => {
  const { TradePartnersRanking } = await import("../../components/trade/trade-partners-ranking");
  const data = productData(), p = await presentation("en");
  data.facts = data.facts.map(fact => fact[0] === 2 ? [fact[0], fact[1], fact[2], -5] : fact);
  const model = buildTradeProductsModel(data, DEFAULT_TRADE_PRODUCTS_STATE, p);
  const html = renderToStaticMarkup(<I18nProvider {...p}><TradePartnersRanking model={model} tab="products" measure="trade.exports" pageSize={25} /></I18nProvider>);
  expect(html).toContain('data-has-share="true"'); expect(html).toContain('data-testid="trade-partners-zero-axis"');
  expect(html).toContain("8703 · 2020–2025"); expect(html).toContain("2204 · 2020–2025");
  expect(html).not.toContain("8703 · 2015–2019");
  expect(html).toContain("Leading products"); expect(html).toContain("2025");
});

test("Products metadata and page publish the reviewed bilingual dataset coverage", async () => {
  const { tradeProductsMetadata, renderTradeProductsPage } = await import("../../lib/pages/trade");
  const en = await tradeProductsMetadata("en");
  expect(en.alternates?.canonical).toContain("/en/explorer/trade/products");
  expect(en.alternates?.languages).toHaveProperty("ka");
  const html = renderToStaticMarkup(await renderTradeProductsPage("en"));
  expect(html).toContain('"temporalCoverage":"1995/2025"');
  expect(html).toContain('"dateModified":"2026-10-09"');
  expect(html).toContain('"inLanguage":["ka","en"]');
});
