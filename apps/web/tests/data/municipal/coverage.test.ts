import { describe, expect, it } from "vitest";
import { MUNICIPAL_YEARS } from "../../../lib/data/coverage";
import { loadMunicipalFunctionFacts } from "../../../lib/data/municipal/importMunicipalFacts";

describe("municipal coverage", () => {
  it("declares 2015-2025", () => {
    expect(MUNICIPAL_YEARS[0]).toBe(2015);
    expect(MUNICIPAL_YEARS.at(-1)).toBe(2025);
    expect(MUNICIPAL_YEARS).toHaveLength(11);
  });

  it("matches the years actually present in the served facts", async () => {
    const facts = await loadMunicipalFunctionFacts(
      "../../data/imports/municipal-function-facts-2015-2025.csv",
    );
    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);

    expect(years).toEqual([...MUNICIPAL_YEARS]);
  });
});
