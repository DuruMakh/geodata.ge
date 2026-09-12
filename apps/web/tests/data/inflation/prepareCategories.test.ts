import { describe, expect, it } from "vitest";
import {
  prepareInflationCategories,
  serializeBasketWeights,
  serializeCategoryFacts,
} from "../../../lib/data/inflation/prepareInflation";
import {
  MAX_MEAN_RECONSTRUCTION_ERROR_PP,
  MAX_RECONSTRUCTION_ERROR_PP,
} from "../../../lib/data/inflation/contributions";

// One extraction of two 800 KB workbooks serves every assertion below.
const prepared = prepareInflationCategories({ previousFacts: null });

describe("prepareInflationCategories", () => {
  it("extracts every category for both measures", async () => {
    const { facts, validation } = await prepared;
    expect(validation.categoryCount).toBe(55);
    expect(facts.filter((fact) => fact.measure === "yoy_pct")).toHaveLength(13492);
    expect(facts.filter((fact) => fact.measure === "mom_pct")).toHaveLength(14176);
  });

  it("keeps the reconstruction inside the published bounds", async () => {
    const { validation } = await prepared;
    expect(validation.reconstruction.maxPp).toBeLessThan(MAX_RECONSTRUCTION_ERROR_PP);
    expect(validation.reconstruction.meanPp).toBeLessThan(MAX_MEAN_RECONSTRUCTION_ERROR_PP);
    expect(validation.reconstruction.months).toBeGreaterThan(150);
  });

  it("records the known gaps rather than failing on them", async () => {
    const { validation } = await prepared;
    expect(validation.gaps.some((gap) => gap.startsWith("cpi.cat.12_5:"))).toBe(true);
  });

  it("carries weights for 2012 onward", async () => {
    const { weights, validation } = await prepared;
    expect(validation.weightYears[0]).toBe(2012);
    expect(weights.some((row) => row.categoryId === "cpi.cat.01" && row.year === 2026)).toBe(true);
  });

  it("serializes a stable, sorted CSV", async () => {
    const { facts, weights } = await prepared;
    const csv = serializeCategoryFacts(facts).split("\n");
    expect(csv[0]).toContain("category_id,coicop_code,level,parent_id,measure,period,value");
    expect(csv[1]!.startsWith("cpi.cat.01,")).toBe(true);
    expect(serializeBasketWeights(weights).split("\n")[0]).toContain("category_id,year,weight_pct");
  });
});
