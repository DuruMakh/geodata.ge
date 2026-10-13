import { beforeAll, describe, expect, it, vi } from "vitest";
import { InflationProducts, ProductExplorer } from "../../components/inflation/inflation-products";
import { loadProductCatalogueCsv, loadProductFactsCsv } from "../../lib/data/inflation/importProducts";
import { buildProductIndex, packProductFacts, productRunBounds, rankProducts, type PackedProductSeries } from "../../lib/explorer/inflationProducts";
import { filteredProductIds, InflationProductPanel } from "../../components/inflation/inflation-product-panel";
import { InflationProductIndicators } from "../../components/inflation/inflation-product-indicators";
import { InflationProductTable } from "../../components/inflation/inflation-product-table";
import common from "../../lib/i18n/messages/ka/common.json";
import controls from "../../lib/i18n/messages/ka/controls.json";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";

let props: Parameters<typeof InflationProducts>[0];
let runs: PackedProductSeries[];

beforeAll(async () => {
  const [catalogue, facts] = await Promise.all([loadProductCatalogueCsv(), loadProductFactsCsv()]);
  runs = packProductFacts(facts);
  props = {
    products: catalogue.map(({ productId, labelEn, labelKa, firstPeriod }) => ({ productId, labelEn, labelKa, firstPeriod })),
    dataUrl: "/page-data/inflation-products.0123456789abcdef.json", coverage: productRunBounds(runs),
    lastReviewedAt: "2026-09-27", sources: [], siteOrigin: "https://fiscal.ge",
  };
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
    expect(html).toMatch(/data-testid="product-cumulative-toggle"[^>]*aria-pressed="false"/);
    expect(html).toMatch(/data-series-id="cpi.product.p0058"[^>]*bg-\[var\(--tint\)\]/);
    expect(html).toContain('data-testid="series-status"');
    expect(html).toContain("305");
    expect(html).toContain("დაგროვილ ცვლილებას Fiscal.ge ითვლის");
    const clearAction = html.slice(html.indexOf('data-testid="series-toggle-all"'), html.indexOf('data-testid="series-toggle-all"') + 650);
    expect(clearAction).toContain("გასუფთავება");
    expect(clearAction).not.toContain("ყველას მონიშვნა");
    expect(html).not.toContain('data-testid="chart-mode-table"');
    expect(html).not.toContain('data-testid="inflation-tabs"');
    expect(html).not.toContain('data-testid="inflation-category-tabs"');
  });

  it("searches both official names without changing the 305-product scope", () => {
    const index = buildProductIndex(props.products, runs);
    expect(rankProducts(index)[0]).toBe("cpi.product.p0058");
    expect(filteredProductIds(index, "  ToMaTo  ")).toEqual(["cpi.product.p0058", "cpi.product.p0067"]);
    expect(filteredProductIds(index, "  პომიდორი  ")).toEqual(["cpi.product.p0058"]);
    expect(filteredProductIds(index, "  coffee    cup   with saucer  ")).toEqual(["cpi.product.p0179"]);
    expect(index.products).toHaveLength(305);
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
