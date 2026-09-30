import { beforeAll, describe, expect, it } from "vitest";
import { InflationProductIndicators, productIndicatorSummary, productRatePosition } from "../../components/inflation/inflation-product-indicators";
import { loadProductCatalogueCsv, loadProductFactsCsv } from "../../lib/data/inflation/importProducts";
import { buildProductIndex, packProductFacts, rankProducts, type ProductIndex } from "../../lib/explorer/inflationProducts";
import type { ProductState } from "../../lib/explorer/inflationProductState";
import common from "../../lib/i18n/messages/ka/common.json";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";

let index: ProductIndex;
let state: ProductState;
beforeAll(async () => {
  const [catalogue, facts] = await Promise.all([loadProductCatalogueCsv(), loadProductFactsCsv()]);
  index = buildProductIndex(catalogue, packProductFacts(facts));
  state = { indicator: "annual", range: index.defaultRange, selected: rankProducts(index).slice(0, 2) };
});

describe("product inflation indicators", () => {
  it("focuses the last selected product but ranks extremes across the full cohort", () => {
    const summary = productIndicatorSummary(index, state);
    expect(summary.heroProductId).toBe(state.selected.at(-1));
    expect(summary.highestId).toBe(rankProducts(index)[0]);
    expect(summary.lowestId).not.toBeNull();
    const html = renderGeorgianMarkup(<InflationProductIndicators index={index} state={state} />, { ...common, ...inflation, ...main });
    expect(html.includes('data-testid="product-indicators"')).toBe(true);
    expect((html.match(/data-testid="side-kpi"/g) ?? [])).toHaveLength(3);
    expect(html.includes(index.productById.get(state.selected.at(-1)!)!.labelKa)).toBe(true);
  });

  it("centres an all-equal cohort and leaves the focused value empty after Clear", () => {
    expect(productRatePosition(10, 10, 10)).toBe(50);
    const cleared = productIndicatorSummary(index, { ...state, selected: [] });
    expect(cleared.heroProductId).toBeNull();
    const html = renderGeorgianMarkup(<InflationProductIndicators index={index} state={{ ...state, selected: [] }} />, { ...common, ...inflation, ...main });
    expect(html.includes('data-testid="product-rate-marker"')).toBe(false);
    expect(html.includes("—")).toBe(true);
  });

  it("does not draw a shorter cumulative path for a late-start product", () => {
    const late = productIndicatorSummary(index, { ...state, range: { startYear: index.earliestYear, endYear: index.defaultRange.endYear }, selected: ["cpi.product.p0179"] });
    expect(late.cumulative).toMatchObject({ value: null, reason: "late_start" });
    expect(late.cumulativeSpark).toBeNull();
  });
});
