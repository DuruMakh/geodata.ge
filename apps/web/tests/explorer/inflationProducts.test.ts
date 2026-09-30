import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { ProductFactRow } from "../../lib/data/inflation/productTypes";
import { loadProductCatalogueCsv, loadProductFactsCsv } from "../../lib/data/inflation/importProducts";
import {
  buildProductIndex, packProductFacts, productAnnual, productCumulative, rankProducts,
} from "../../lib/explorer/inflationProducts";

const id = "cpi.product.p0001";
const product = { productId: id, labelEn: "Example", labelKa: "მაგალითი", firstPeriod: "2026-01" };
const fact = (measure: ProductFactRow["measure"], period: string, index100: string | null): ProductFactRow => ({
  productId: id, measure, period, index100, availability: index100 === null ? "not_published" : "published",
  sourceId: "source.test", sourceLocator: "Test!D1", lastReviewedAt: "2026-09-01",
});

describe("individual-product inflation model", () => {
  it("packs source precision without rounding or inventing unavailable values", () => {
    const packed = packProductFacts([
      fact("mom_index_100", "2026-01", "101.6031"),
      fact("mom_index_100", "2026-02", null),
    ]);
    expect(packed).toHaveLength(1);
    expect(packed[0]!.v[0]! / packed[0]!.q).toBe(101.6031);
    expect(packed[0]!.v[1]).toBeNull();
  });

  it("compounds monthly indices only and rebases the selected January", () => {
    const index = buildProductIndex([product], packProductFacts([
      fact("mom_index_100", "2026-01", "101"),
      fact("mom_index_100", "2026-02", "102"),
      fact("yoy_index_100", "2026-01", "150"),
      fact("yoy_index_100", "2026-02", "160"),
    ]));
    expect(productCumulative(index, id, 2026, makePeriod(2026, 2)).value).toBeCloseTo(3.02);
    expect(productAnnual(index, id, makePeriod(2026, 2))).toBe(60);
    expect(productCumulative(index, id, 2025, makePeriod(2026, 2))).toMatchObject({ value: null, reason: "late_start" });
    const missing = buildProductIndex([product], packProductFacts([
      fact("mom_index_100", "2026-01", "101"),
      fact("mom_index_100", "2026-02", null),
      fact("mom_index_100", "2026-03", "103"),
    ]));
    expect(productCumulative(missing, id, 2026, makePeriod(2026, 3))).toMatchObject({
      value: null, reason: "missing_month", missingPeriod: makePeriod(2026, 2),
    });
  });

  it("handles a 2015 baseline, a past December and a partial current year", () => {
    const oldProduct = { ...product, firstPeriod: "2015-01" };
    const facts = Array.from({ length: 12 }, (_, offset) => fact("mom_index_100", `2015-${String(offset + 1).padStart(2, "0")}`, offset === 0 ? "110" : "100"));
    facts.push(fact("mom_index_100", "2016-01", "110"), fact("mom_index_100", "2016-02", "90"));
    const index = buildProductIndex([oldProduct], packProductFacts(facts));
    expect(productCumulative(index, id, 2015, makePeriod(2015, 12)).value).toBeCloseTo(10);
    expect(productCumulative(index, id, 2016, makePeriod(2016, 1)).value).toBeCloseTo(10);
    expect(productCumulative(index, id, 2016, makePeriod(2016, 2)).value).toBeCloseTo(-1);
    expect(productCumulative(index, id, 2015, makePeriod(2016, 2)).value).toBeCloseTo(8.9);
  });

  it("ranks the latest published month, with stable ties and missing rates last", () => {
    const products = [product, { ...product, productId: "cpi.product.p0002" }, { ...product, productId: "cpi.product.p0003" }];
    const facts = [
      fact("yoy_index_100", "2026-08", "110"),
      { ...fact("yoy_index_100", "2026-08", "110"), productId: products[1]!.productId },
      { ...fact("yoy_index_100", "2026-08", null), productId: products[2]!.productId },
    ];
    const index = buildProductIndex(products, packProductFacts(facts));
    expect(rankProducts(index)).toEqual(products.map((item) => item.productId));
    expect(productAnnual(index, products[2]!.productId, index.latestPeriod)).toBeNull();
  });

  it("uses the current source vintage and derives the latest-four-year range", async () => {
    const [catalogue, facts] = await Promise.all([loadProductCatalogueCsv(), loadProductFactsCsv()]);
    const index = buildProductIndex(catalogue, packProductFacts(facts));
    expect(index.latestPeriod).toBe(makePeriod(2026, 8));
    expect(index.defaultRange).toEqual({ startYear: 2023, endYear: 2026 });
    expect(productAnnual(index, "cpi.product.p0058", index.latestPeriod)).toBeCloseTo(57.5291);
    expect(rankProducts(index)[0]).toBe("cpi.product.p0058");
  });
});
