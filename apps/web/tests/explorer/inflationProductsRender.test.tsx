import { beforeAll, describe, expect, it } from "vitest";
import { InflationProducts } from "../../components/inflation/inflation-products";
import { loadProductCatalogueCsv, loadProductFactsCsv } from "../../lib/data/inflation/importProducts";
import { buildProductIndex, packProductFacts, rankProducts } from "../../lib/explorer/inflationProducts";
import { filteredProductIds } from "../../components/inflation/inflation-product-panel";
import common from "../../lib/i18n/messages/ka/common.json";
import controls from "../../lib/i18n/messages/ka/controls.json";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";

let props: Parameters<typeof InflationProducts>[0];

beforeAll(async () => {
  const [catalogue, facts] = await Promise.all([loadProductCatalogueCsv(), loadProductFactsCsv()]);
  props = {
    products: catalogue.map(({ productId, labelEn, labelKa, firstPeriod }) => ({ productId, labelEn, labelKa, firstPeriod })),
    facts: packProductFacts(facts), lastReviewedAt: "2026-09-27", sources: [], siteOrigin: "https://fiscal.ge",
  };
});

describe("individual-product inflation page", () => {
  it("lands on annual with the latest leader", () => {
    const html = renderGeorgianMarkup(<InflationProducts {...props} />, { ...common, ...controls, ...inflation, ...main });
    expect(html).toContain('data-testid="inflation-products"');
    expect(html).toMatch(/data-testid="product-cumulative-toggle"[^>]*aria-pressed="false"/);
    expect(html).toMatch(/data-series-id="cpi.product.p0058"[^>]*bg-\[var\(--tint\)\]/);
    expect(html).toContain('data-testid="series-status"');
    expect(html).toContain("305");
    const clearAction = html.slice(html.indexOf('data-testid="series-toggle-all"'), html.indexOf('data-testid="series-toggle-all"') + 650);
    expect(clearAction).toContain("გასუფთავება");
    expect(clearAction).not.toContain("ყველას მონიშვნა");
    expect(html).not.toContain('data-testid="chart-mode-table"');
    expect(html).not.toContain('data-testid="inflation-tabs"');
    expect(html).not.toContain('data-testid="inflation-category-tabs"');
  });

  it("searches both official names without changing the 305-product scope", () => {
    const index = buildProductIndex(props.products, props.facts);
    expect(rankProducts(index)[0]).toBe("cpi.product.p0058");
    expect(filteredProductIds(index, "  ToMaTo  ")).toEqual(["cpi.product.p0058", "cpi.product.p0067"]);
    expect(filteredProductIds(index, "  პომიდორი  ")).toEqual(["cpi.product.p0058"]);
    expect(filteredProductIds(index, "  coffee    cup   with saucer  ")).toEqual(["cpi.product.p0179"]);
    expect(index.products).toHaveLength(305);
  });
});
