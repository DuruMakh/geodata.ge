import { beforeAll, describe, expect, it } from "vitest";
import { InflationProductTable, nextProductCount } from "../../components/inflation/inflation-product-table";
import { loadProductCatalogueCsv, loadProductFactsCsv } from "../../lib/data/inflation/importProducts";
import type { ProductFactRow, ProductMeasure } from "../../lib/data/inflation/productTypes";
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
    let shown = 40;
    while (shown < index.products.length) shown = nextProductCount(shown, index.products.length);
    expect(shown).toBe(index.products.length);
    const html = renderGeorgianMarkup(<InflationProductTable index={index} state={state} onToggle={() => {}} />, { ...common, ...controls, ...inflation, ...main });
    expect((html.match(/<tr data-product-id="cpi\.product\./g) ?? [])).toHaveLength(40);
    expect(html.includes('data-testid="product-list-search"')).toBe(true);
    expect(html.includes('data-testid="product-list-count"')).toBe(false);
    expect(html.includes('data-testid="product-more"')).toBe(true);
  });

  it("keeps the latest annual period label when the selected years change", () => {
    const past: ProductState = { indicator: "cumulative", range: { startYear: 2015, endYear: 2016 }, selected: [] };
    const html = renderGeorgianMarkup(<InflationProductTable index={index} state={past} onToggle={() => {}} />, { ...common, ...controls, ...inflation, ...main });
    expect(html.includes("აგვისტო 2026")).toBe(true);
    expect(html.includes("2015")).toBe(true);
    expect(html.includes("2016")).toBe(true);
  });

  it("puts cumulative change first and re-ranks when the selected years change", () => {
    const fact = (id: string, measure: ProductMeasure, period: string, index100: string): ProductFactRow => ({
      productId: id, measure, period, index100, availability: "published",
      sourceId: measure === "yoy_index_100" ? "source.geostat_product_yoy" : "source.geostat_product_mom",
      sourceLocator: "fixture", lastReviewedAt: "2026-09-30",
    });
    const products = [
      { productId: "cpi.product.p0001", labelEn: "A", labelKa: "ა", firstPeriod: "2024-01" },
      { productId: "cpi.product.p0002", labelEn: "B", labelKa: "ბ", firstPeriod: "2024-01" },
      { productId: "cpi.product.p0003", labelEn: "C", labelKa: "გ", firstPeriod: "2025-02" },
    ];
    const facts = products.slice(0, 2).flatMap(({ productId }, productIndex) => [
      ...Array.from({ length: 12 }, (_, month) => fact(productId, "mom_index_100", `2024-${String(month + 1).padStart(2, "0")}`, productIndex === 0 && month === 0 ? "150" : "100")),
      fact(productId, "mom_index_100", "2025-01", productIndex === 0 ? "101" : "120"),
      fact(productId, "mom_index_100", "2025-02", "100"),
      fact(productId, "yoy_index_100", "2025-02", productIndex === 0 ? "130" : "110"),
    ]).concat([
      fact("cpi.product.p0003", "mom_index_100", "2025-02", "150"),
      fact("cpi.product.p0003", "yoy_index_100", "2025-02", "150"),
    ]);
    const sample = buildProductIndex(products, packProductFacts(facts));
    const render = (startYear: number) => renderGeorgianMarkup(
      <InflationProductTable index={sample} state={{ indicator: "annual", range: { startYear, endYear: 2025 }, selected: [] }} onToggle={() => {}} />,
      { ...common, ...controls, ...inflation, ...main },
    );
    const recent = render(2025);
    const headers = recent.slice(recent.indexOf("<thead>"), recent.indexOf("</thead>"));
    expect(headers.indexOf("დაგროვილი")).toBeLessThan(headers.indexOf("წლიური"));
    const rowIds = (html: string) => [...html.matchAll(/<tr data-product-id="([^"]+)"/g)].map((match) => match[1]);
    expect(rowIds(recent)).toEqual(["cpi.product.p0002", "cpi.product.p0001", "cpi.product.p0003"]);
    expect(rowIds(render(2024))).toEqual(["cpi.product.p0001", "cpi.product.p0002", "cpi.product.p0003"]);
  });
});
