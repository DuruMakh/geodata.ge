import { describe, expect, it } from "vitest";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "../../../lib/data/municipal/taxonomyFiles";

const FUNCTIONS = "../../data/taxonomy/municipal-functions.json";
const REGIONS = "../../data/taxonomy/municipal-regions.json";

describe("municipal taxonomy files", () => {
  it("loads exactly ten main functions", async () => {
    const functions = await loadMunicipalFunctionsFile(FUNCTIONS);
    expect(functions).toHaveLength(10);
  });

  it("uses stable municipal.* ids and official functional codes", async () => {
    const functions = await loadMunicipalFunctionsFile(FUNCTIONS);
    const byCode = new Map(functions.map((entry) => [entry.functionalCode, entry.id]));

    expect(byCode.get("7.1")).toBe("municipal.general_public_services");
    expect(byCode.get("7.6")).toBe("municipal.housing_communal");
    expect(byCode.get("7.10")).toBe("municipal.social_protection");
    for (const entry of functions) {
      expect(entry.id).toMatch(/^municipal\.[a-z0-9_]+$/);
      expect(entry.kaLabel.length).toBeGreaterThan(0);
    }
  });

  it("orders functions by official code, not lexically", async () => {
    const functions = await loadMunicipalFunctionsFile(FUNCTIONS);
    const codes = [...functions]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((entry) => entry.functionalCode);

    expect(codes).toEqual(["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10"]);
  });

  it("loads exactly eleven data-bearing regions with stable ids", async () => {
    const regions = await loadMunicipalRegionsFile(REGIONS);
    const ids = regions.map((region) => region.id);

    expect(regions).toHaveLength(11);
    expect(ids).toContain("region.tbilisi");
    expect(ids).toContain("region.adjara");
    // Azhara (code 05) is Upper Abkhazia, not Adjara — see the file comment.
    expect(ids).not.toContain("region.abkhazia");
    for (const region of regions) {
      expect(region.id).toMatch(/^region\.[a-z0-9_]+$/);
    }
  });

  it("has no duplicate ids in either file", async () => {
    const functions = await loadMunicipalFunctionsFile(FUNCTIONS);
    const regions = await loadMunicipalRegionsFile(REGIONS);

    expect(new Set(functions.map((entry) => entry.id)).size).toBe(functions.length);
    expect(new Set(regions.map((region) => region.id)).size).toBe(regions.length);
  });
});
