import { describe, expect, it } from "vitest";
import { buildProductIndex } from "../../lib/explorer/inflationProducts";
import { parseProductHash, serializeProductHash, toggleProduct } from "../../lib/explorer/inflationProductState";

const products = ["p0001", "p0002", "p0003"].map((short) => ({
  productId: `cpi.product.${short}`, labelEn: short, labelKa: short, firstPeriod: "2015-01",
}));
const series = products.map((row) => ({ k: `${row.productId}:a`, s: "2026-08", q: 1, v: [110] }));
const index = buildProductIndex(products, series);

describe("individual-product inflation URL state", () => {
  it("starts annual with the latest leader and preserves deliberate empty selection", () => {
    const initial = parseProductHash("", index);
    expect(initial).toEqual({ indicator: "annual", range: { startYear: 2026, endYear: 2026 }, selected: [products[0]!.productId] });
    expect(parseProductHash("#i=cumulative&r=2023-2026&sel=", index).selected).toEqual([]);
  });

  it("drops unknown IDs, clamps years and keeps ordered selection", () => {
    const state = parseProductHash(`#i=cumulative&r=1900-2099&sel=${products[1]!.productId},unknown,${products[0]!.productId}`, index);
    expect(state).toEqual({ indicator: "cumulative", range: { startYear: 2026, endYear: 2026 }, selected: [products[1]!.productId, products[0]!.productId] });
    expect(parseProductHash(`#${serializeProductHash(state)}`, index)).toEqual(state);
    expect(toggleProduct(state, products[0]!.productId).selected).toEqual([products[1]!.productId]);
    expect(toggleProduct(state, products[2]!.productId).selected.at(-1)).toBe(products[2]!.productId);
  });
});
