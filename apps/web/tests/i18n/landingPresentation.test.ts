import { describe, expect, it } from "vitest";
import { GEORGIA_GEO } from "../../lib/landing/georgiaGeo";

describe("public content presentation", () => {
  it("provides English display names for every hero city", () => {
    expect(GEORGIA_GEO.cityMarkers).toHaveLength(21);
    expect(GEORGIA_GEO.cityMarkers.every(city => city.en.trim().length > 0 && !/\p{Script=Georgian}/u.test(city.en))).toBe(true);
  });
});
