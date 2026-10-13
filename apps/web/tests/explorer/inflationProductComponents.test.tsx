import { beforeAll, describe, expect, it, vi } from "vitest";
import { InflationProducts, ProductExplorer } from "../../components/inflation/inflation-products";
import { InflationProductPanel } from "../../components/inflation/inflation-product-panel";
import { InflationProductIndicators, productIndicatorSummary, productRatePosition } from "../../components/inflation/inflation-product-indicators";
import { InflationProductTable } from "../../components/inflation/inflation-product-table";
import { loadProductCatalogueCsv, loadProductFactsCsv } from "../../lib/data/inflation/importProducts";
import type { ProductFactRow, ProductMeasure } from "../../lib/data/inflation/productTypes";
import { buildProductIndex, packProductFacts, productRunBounds, rankProducts, type PackedProductSeries, type ProductIndex } from "../../lib/explorer/inflationProducts";
import type { ProductState } from "../../lib/explorer/inflationProductState";
import common from "../../lib/i18n/messages/ka/common.json";
import controls from "../../lib/i18n/messages/ka/controls.json";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";

// The product page, its ranked list and its indicators, over one load of the product CSVs.
let props: Parameters<typeof InflationProducts>[0];
let runs: PackedProductSeries[];
let index: ProductIndex;
let indicatorState: ProductState;

beforeAll(async () => {
  const [catalogue, facts] = await Promise.all([loadProductCatalogueCsv(), loadProductFactsCsv()]);
  runs = packProductFacts(facts);
  props = {
    products: catalogue.map(({ productId, labelEn, labelKa, firstPeriod }) => ({ productId, labelEn, labelKa, firstPeriod })),
    dataUrl: "/page-data/inflation-products.0123456789abcdef.json", coverage: productRunBounds(runs),
    lastReviewedAt: "2026-09-27", sources: [], siteOrigin: "https://fiscal.ge",
  };
  index = buildProductIndex(catalogue, runs);
  indicatorState = { indicator: "annual", range: index.defaultRange, selected: rankProducts(index).slice(0, 2) };
});

describe("individual-product inflation page", () => {
  // U14-01: the 610 index runs are fetched after load, so the prerendered page is the shell around a loading status.
  it("prerenders the heading, unit line and coverage, with a loading status in place of the runs", () => {
    const html = renderGeorgianMarkup(<InflationProducts {...props} />, { ...common, ...controls, ...inflation, ...main });
    expect(html).toContain('data-testid="inflation-products"');
    expect(html).toContain(inflation["inflation.productsHeading"]);
    expect(html).toContain(inflation["inflation.productsUnit"]);
    expect(html).toContain("2015–");
    expect(html).toMatch(/role="status"[^>]*>[^]*data-testid="page-data-loading"/);
    expect(html).toContain(common["common.dataLoading"]);
    expect(html).not.toContain('data-testid="series-row"');
    expect(html).not.toContain('data-testid="chart-panel"');
  });

  it("lands on annual with the latest leader", () => {
    const index = buildProductIndex(props.products, runs);
    const { lastReviewedAt, sources, siteOrigin } = props;
    const html = renderGeorgianMarkup(<ProductExplorer index={index} lastReviewedAt={lastReviewedAt} sources={sources} siteOrigin={siteOrigin} />, { ...common, ...controls, ...inflation, ...main });
    // An action button named for what a press shows, with no pressed state to announce on top.
    expect(html).toMatch(/data-testid="product-cumulative-toggle"[^>]*aria-label="დაგროვილი ცვლილების ჩვენება"/);
    expect(html).not.toMatch(/data-testid="product-cumulative-toggle"[^>]*aria-pressed/);
    expect(html).toContain('data-testid="series-status"');
    expect(html).toContain("305");
    // The derived cumulative change is labelled as Fiscal.ge's own calculation.
    expect(html).toContain("დაგროვილ ცვლილებას Fiscal.ge ითვლის");
    // With a selection, the bulk action is Clear, never Select all (AGENTS UI contract).
    const clearAction = html.slice(html.indexOf('data-testid="series-toggle-all"'), html.indexOf('data-testid="series-toggle-all"') + 650);
    expect(clearAction).toContain("გასუფთავება");
    expect(clearAction).not.toContain("ყველას მონიშვნა");
  });

  // U14-03: the ranking and the lower list's order do not depend on the selection, yet a row click re-sorted all
  // 305 products three times (the panel, the indicators and the list) and the list's cumulative order once more.
  it("a selection click re-ranks zero times", () => {
    const index = buildProductIndex(props.products, runs);
    const messages = { ...common, ...controls, ...inflation, ...main };
    const render = (selected: string[]) => {
      const state = { indicator: "annual" as const, range: index.defaultRange, selected };
      renderGeorgianMarkup(<>
        <InflationProductPanel index={index} state={state} onToggle={() => {}} onClear={() => {}} downloadAction={null} />
        <InflationProductIndicators index={index} state={state} />
        <InflationProductTable index={index} state={state} onToggle={() => {}} />
      </>, messages);
    };
    render(["cpi.product.p0058"]);
    // Only sorts of product ids count: next/image sorts its own breakpoints on every server render.
    const sort = vi.spyOn(Array.prototype, "sort");
    try {
      render(["cpi.product.p0058", "cpi.product.p0001"]);
      const rankings = sort.mock.contexts.filter((array) => (array as unknown[]).some((entry) => typeof entry === "string" && entry.startsWith("cpi.product.")));
      expect(rankings).toHaveLength(0);
    } finally {
      sort.mockRestore();
    }
  });
});

describe("complete ranked product list", () => {
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

describe("product inflation indicators", () => {
  it("focuses the last selected product but ranks extremes across the full cohort", () => {
    const summary = productIndicatorSummary(index, indicatorState);
    expect(summary.heroProductId).toBe(indicatorState.selected.at(-1));
    expect(summary.highestId).toBe(rankProducts(index)[0]);
    expect(summary.lowestId).not.toBeNull();
    const html = renderGeorgianMarkup(<InflationProductIndicators index={index} state={indicatorState} />, { ...common, ...inflation, ...main });
    expect(html.includes('data-testid="product-indicators"')).toBe(true);
    expect((html.match(/data-testid="side-kpi"/g) ?? [])).toHaveLength(3);
    expect(html.includes(index.productById.get(indicatorState.selected.at(-1)!)!.labelKa)).toBe(true);
  });

  it("centres an all-equal cohort and leaves the focused value empty after Clear", () => {
    expect(productRatePosition(10, 10, 10)).toBe(50);
    const cleared = productIndicatorSummary(index, { ...indicatorState, selected: [] });
    expect(cleared.heroProductId).toBeNull();
    const html = renderGeorgianMarkup(<InflationProductIndicators index={index} state={{ ...indicatorState, selected: [] }} />, { ...common, ...inflation, ...main });
    expect(html.includes('data-testid="product-rate-marker"')).toBe(false);
    expect(html.includes("—")).toBe(true);
  });

  it("does not draw a shorter cumulative path for a late-start product", () => {
    const late = productIndicatorSummary(index, { ...indicatorState, range: { startYear: index.earliestYear, endYear: index.defaultRange.endYear }, selected: ["cpi.product.p0179"] });
    expect(late.cumulative).toMatchObject({ value: null, reason: "late_start" });
    expect(late.cumulativeSpark).toBeNull();
  });
});
