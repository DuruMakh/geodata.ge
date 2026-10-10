import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { readTradeProductCatalogue } from "../../lib/data/tradeProducts/catalogue";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { buildTradeProductsModel } from "../../lib/explorer/tradeProducts";
import { DEFAULT_TRADE_PRODUCTS_STATE } from "../../lib/explorer/tradeProductsState";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { productData, productPresentation } from "./tradeProductsFixtures";

test("keeps global selection count while displaying eight category tiles", async () => {
  const { TradeProductsPicker } = await import("../../components/trade/trade-products-picker");
  const entities = (await readTradeProductCatalogue(path.resolve(process.cwd(), "../.."))).filter(entity => entity.sourceBlock === "2020-2025");
  const data: ClientTradeProductsData = { entities, facts: [], years: [2020, 2025], nationalFacts: [], catalogueFingerprint: "a".repeat(64), sourceBlock: "2020-2025" };
  const p = { locale: "en" as const, englishLabels: Object.fromEntries(entities.map(entity => [entity.id, entity.sourceLabelEn])), messages: await getMessages("en", ["trade", "controls", "common"]) };
  const model = buildTradeProductsModel(data, DEFAULT_TRADE_PRODUCTS_STATE, p);
  const html = renderToStaticMarkup(<I18nProvider {...p}><TradeProductsPicker data={data} model={model} selectedIds={["goods.total"]} initialView="categories" returnFocusTo={null} onApply={() => {}} onClose={() => {}} /></I18nProvider>);
  expect(html.match(/data-testid="trade-product-category"/g)).toHaveLength(8);
  expect(html).toContain("1 / 1193");
  expect(html).not.toContain('data-testid="trade-product-result"');
  const sections = [...html.matchAll(/data-selector-section="([^"]+)"/g)].map(match => match[1]);
  expect(sections).toEqual(["controls", "search", "actions", "list"]);
  expect(html.indexOf('data-testid="trade-product-reference"')).toBeLessThan(html.indexOf('data-testid="trade-product-category"'));
  expect(html).not.toContain("max-h-[430px]");
  expect(html).toContain("All products, including Georgia total");
});

test.each(["en", "ka"] as const)("%s selected view has readable identities and checkboxes without a long catalogue", async locale => {
  const { TradeProductsPicker } = await import("../../components/trade/trade-products-picker");
  const data = productData(), p = { ...productPresentation(locale), messages: await getMessages(locale, ["trade", "controls", "common"]) };
  const selectedIds = data.entities.map(entity => entity.id), model = buildTradeProductsModel(data, { ...DEFAULT_TRADE_PRODUCTS_STATE, selectedIds }, p);
  const html = renderToStaticMarkup(<I18nProvider {...p}><TradeProductsPicker data={data} model={model} selectedIds={selectedIds} initialView="selected" returnFocusTo={null} onApply={() => {}} onClose={() => {}} /></I18nProvider>);
  expect(html.match(/data-testid="trade-product-result"/g)).toHaveLength(4);
  expect(html).toContain("8703 · 2015–2019"); expect(html).toContain("8703 · 2020–2025");
  expect(html.match(/role="checkbox" aria-checked="true"/g)).toHaveLength(4);
  expect(html).toContain('aria-labelledby="trade-products-picker-title"');
  expect(html).toContain('data-testid="trade-products-compare"');
  expect(html).toContain("4 / 5");
  expect(html).not.toMatch(/GEL|₾/);
});
