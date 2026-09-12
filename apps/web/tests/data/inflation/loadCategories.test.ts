import { describe, expect, it } from "vitest";
import {
  loadBasketWeights,
  loadCpiCategoryFacts,
  loadServedInflationData,
} from "../../../lib/data/inflation/importInflation";

describe("category loaders", () => {
  it("loads and validates every category fact", async () => {
    const facts = await loadCpiCategoryFacts();
    expect(facts).toHaveLength(27668);
    expect(new Set(facts.map((fact) => fact.categoryId)).size).toBe(55);
  });

  it("resolves each subgroup to its division", async () => {
    const facts = await loadCpiCategoryFacts();
    const divisions = new Set(facts.filter((fact) => fact.level === 2).map((fact) => fact.categoryId));
    expect(facts.filter((fact) => fact.level === 3).every((fact) => divisions.has(fact.parentId!))).toBe(true);
  });

  it("loads weights as numbers on the served path", async () => {
    const weights = await loadBasketWeights();
    expect(weights.length).toBeGreaterThan(700);
    const served = await loadServedInflationData();
    expect(typeof served.weights[0]!.weightPct).toBe("number");
    expect(served.categories.length).toBe(27668);
  });
});
