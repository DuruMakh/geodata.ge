import { describe, expect, it } from "vitest";
import {
  MUNICIPAL_FUNCTION_CODES,
  municipalCategoryIdForCode,
} from "../../../lib/data/municipal/functionMapping";
import { loadMunicipalFunctionsFile } from "../../../lib/data/municipal/taxonomyFiles";

describe("municipal function mapping", () => {
  it("maps every official code to its semantic id", () => {
    expect(municipalCategoryIdForCode("7.1")).toBe("municipal.general_public_services");
    expect(municipalCategoryIdForCode("7.8")).toBe("municipal.recreation_culture");
    expect(municipalCategoryIdForCode("7.10")).toBe("municipal.social_protection");
  });

  it("throws on an unknown code rather than inventing an id", () => {
    expect(() => municipalCategoryIdForCode("7.11")).toThrow(/7\.11/);
    expect(() => municipalCategoryIdForCode("7.1.1")).toThrow(/7\.1\.1/);
  });

  it("covers exactly the ten codes in the taxonomy file", async () => {
    const functions = await loadMunicipalFunctionsFile("../../data/taxonomy/municipal-functions.json");

    expect([...MUNICIPAL_FUNCTION_CODES].sort()).toEqual(
      functions.map((entry) => entry.functionalCode).sort(),
    );
    for (const entry of functions) {
      expect(municipalCategoryIdForCode(entry.functionalCode)).toBe(entry.id);
    }
  });
});
