import { beforeAll, describe, expect, it } from "vitest";
import { InflationProductTable, nextProductCount, visibleProductIds } from "../../components/inflation/inflation-product-table";
import { loadProductCatalogueCsv, loadProductFactsCsv } from "../../lib/data/inflation/importProducts";
import { buildProductIndex, packProductFacts, rankProducts, type ProductIndex } from "../../lib/explorer/inflationProducts";
import type { ProductState } from "../../lib/explorer/inflationProductState";
import common from "../../lib/i18n/messages/ka/common.json";
import controls from "../../lib/i18n/messages/ka/controls.json";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";

let index: ProductIndex;
let state: ProductState;
beforeAll(async () => {
  const [catalogue, facts] = await Promise.all([loadProductCatalogueCsv(), loadProductFactsCsv()]);
  index = buildProductIndex(catalogue, packProductFacts(facts));
  state = { indicator: "annual", range: index.defaultRange, selected: [rankProducts(index)[0]!] };
});

describe("complete ranked product list", () => {
  it("starts with 40 and reveals every current product", () => {
    expect(visibleProductIds(index, 40)).toHaveLength(40);
    let shown = 40;
    while (shown < index.products.length) shown = nextProductCount(shown, index.products.length);
    expect(shown).toBe(index.products.length);
    expect(visibleProductIds(index, shown)).toEqual(rankProducts(index));
    const html = renderGeorgianMarkup(<InflationProductTable index={index} state={state} onToggle={() => {}} />, { ...common, ...controls, ...inflation, ...main });
    expect((html.match(/<tr data-product-id="cpi\.product\./g) ?? [])).toHaveLength(40);
    expect(html.includes("40 / 305")).toBe(true);
    expect(html.includes('data-testid="product-more"')).toBe(true);
  });

  it("keeps the latest annual order and period when the selected years change", () => {
    const past: ProductState = { indicator: "cumulative", range: { startYear: 2015, endYear: 2016 }, selected: [] };
    expect(visibleProductIds(index, 40)[0]).toBe("cpi.product.p0058");
    const html = renderGeorgianMarkup(<InflationProductTable index={index} state={past} onToggle={() => {}} />, { ...common, ...controls, ...inflation, ...main });
    expect(html.includes('data-product-id="cpi.product.p0058"')).toBe(true);
    expect(html.includes("აგვისტო 2026")).toBe(true);
    expect(html.includes("2015")).toBe(true);
    expect(html.includes("2016")).toBe(true);
  });
});
