import { beforeAll, describe, expect, it } from "vitest";
import {
  assertProductParity,
  loadProductCatalogueCsv,
  loadProductFactsCsv,
  loadServedProductData,
  type ServedProductData,
} from "../../../lib/data/inflation/importProducts";

let csv: ServedProductData;

beforeAll(async () => {
  const [catalogue, facts] = await Promise.all([loadProductCatalogueCsv(), loadProductFactsCsv()]);
  csv = { catalogue, facts };
});

describe("individual-product inflation serving", () => {
  it("serves the reviewed current roster and original index precision", async () => {
    expect(csv.catalogue).toHaveLength(305);
    expect(csv.facts).toHaveLength(84_056);
    expect(csv.facts.filter((row) => row.availability === "not_published")).toHaveLength(176);
    expect(csv.catalogue.find((row) => row.productId === "cpi.product.p0179")?.firstPeriod).toBe("2019-01");
    expect(csv.facts.find((row) => row.productId === "cpi.product.p0058" && row.measure === "yoy_index_100" && row.period === "2026-08")?.index100).toBe("157.5291");
    await expect(loadServedProductData()).resolves.toEqual(csv);
  });

  it("rejects any changed mirror field, including a missing latest annual fact", () => {
    expect(() => assertProductParity(csv, csv)).not.toThrow();
    const changedCatalogue = { ...csv, catalogue: [{ ...csv.catalogue[0]!, labelKa: "changed" }, ...csv.catalogue.slice(1)] };
    expect(() => assertProductParity(csv, changedCatalogue)).toThrow(/differs/);
    const original = csv.facts.find((row) => row.index100 !== null)!;
    const changes = [
      { index100: "1" }, { availability: "not_published" as const },
      { sourceLocator: "wrong" }, { lastReviewedAt: "2020-01-01" }, { sourceId: "source.wrong" },
    ];
    for (const change of changes) {
      const altered = { ...csv, facts: csv.facts.map((row) => row === original ? { ...row, ...change } : row) };
      expect(() => assertProductParity(csv, altered)).toThrow(/differs/);
    }
    const absent = { ...csv, facts: csv.facts.filter((row) => !(row.productId === "cpi.product.p0058" && row.measure === "yoy_index_100" && row.period === "2026-08")) };
    expect(() => assertProductParity(csv, absent)).toThrow(/row count differs|not in db/);
  });

  it("treats equivalent decimal formatting as the same published index", () => {
    const original = csv.facts.find((row) => row.index100?.endsWith(".5"))!;
    expect(original).toBeDefined();
    const altered = { ...csv, facts: csv.facts.map((row) => row === original ? { ...row, index100: `${row.index100}0` } : row) };
    expect(() => assertProductParity(csv, altered)).not.toThrow();
  });
});
