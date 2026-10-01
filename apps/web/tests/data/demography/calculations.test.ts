import { describe, expect, test } from "vitest";
import { ageBands } from "../../../lib/data/demography/calculations";
import { AGE_GROUPS } from "../../../lib/data/demography/series";

describe("age bands", () => {
  test("adds the 19 age groups into 0–14, 15–64 and 65+", () => {
    const bands = ageBands(Array.from({ length: 19 }, (_, index) => index + 1));

    expect(bands).toEqual({ band_0_14: 1 + 2 + 3 + 4, band_15_64: 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14, band_65_plus: 15 + 16 + 17 + 18 + 19 });
    expect(bands.band_0_14 + bands.band_15_64 + bands.band_65_plus).toBe(190);
  });

  test("refuses a row count that is not the 19 reviewed groups", () => {
    expect(AGE_GROUPS).toHaveLength(19);
    expect(() => ageBands([1, 2, 3])).toThrow(/19 age groups/);
  });
});
