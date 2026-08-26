import { describe, expect, it } from "vitest";
import { loadMunicipalitiesFile } from "../../lib/data/municipal/municipalitiesFile";
import {
  MUNICIPALITY_ROUTES,
  municipalityCodeForSlug,
  municipalityHrefForCode,
  municipalitySlugForCode,
} from "../../lib/explorer/municipalityRoutes";

describe("municipality public routes", () => {
  it("maps every reviewed municipality code to one stable public slug", async () => {
    const rows = await loadMunicipalitiesFile("../../data/imports/municipalities.csv");

    expect(MUNICIPALITY_ROUTES).toHaveLength(64);
    expect(new Set(MUNICIPALITY_ROUTES.map((row) => row.code))).toEqual(
      new Set(rows.map((row) => row.code)),
    );
    expect(new Set(MUNICIPALITY_ROUTES.map((row) => row.slug)).size).toBe(64);
    expect(MUNICIPALITY_ROUTES.every((row) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug))).toBe(true);
    expect(municipalitySlugForCode("04")).toBe("tbilisi");
    expect(municipalityHrefForCode("04")).toBe("/explorer/municipalities/tbilisi");
    expect(municipalityCodeForSlug("chiatura")).toBe("21");
    expect(municipalityCodeForSlug("unknown")).toBeNull();
  });

  it("rejects an unknown numeric source identity instead of publishing a broken URL", () => {
    expect(() => municipalityHrefForCode("unknown")).toThrow("Missing municipality route for code unknown");
  });
});
