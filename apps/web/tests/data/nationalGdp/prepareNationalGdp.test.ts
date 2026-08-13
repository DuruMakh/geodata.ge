import { describe, expect, it } from "vitest";

import { prepareNationalGdp } from "../../../lib/data/nationalGdp/prepareNationalGdp";

describe("prepareNationalGdp", () => {
  it("preserves the reviewed Geostat captures", async () => {
    const result = await prepareNationalGdp({ write: false });

    expect(result.validation.sourceHashesMatch).toBe(true);
    expect(result.validation.sourceBytes).toEqual({
      sna1993: 94_214,
      sna2008: 50_098,
    });
  });

  it("keeps the overlap in staging and selects one canonical row per year", async () => {
    const result = await prepareNationalGdp({ write: false });

    expect(result.sourceFacts.filter((row) => row.year === 2010)).toHaveLength(2);
    expect(result.canonicalFacts).toHaveLength(30);
    expect(result.canonicalFacts.map((row) => row.year)).toEqual(
      Array.from({ length: 30 }, (_, index) => 1996 + index),
    );
    expect(
      result.canonicalFacts
        .filter((row) => row.year <= 2009)
        .every((row) => row.accountingStandard === "sna_1993"),
    ).toBe(true);
    expect(
      result.canonicalFacts
        .filter((row) => row.year >= 2010)
        .every((row) => row.accountingStandard === "sna_2008"),
    ).toBe(true);
  });

  it("pins published market-price values and 2025 status", async () => {
    const result = await prepareNationalGdp({ write: false });
    const byYear = new Map(result.canonicalFacts.map((row) => [row.year, row]));

    expect(byYear.get(1996)?.gdpCurrentPricesGel).toBe(3_868_500_000);
    expect(byYear.get(2005)?.gdpCurrentPricesGel).toBe(11_620_900_000);
    expect(byYear.get(2009)?.gdpCurrentPricesGel).toBe(17_986_000_000);
    expect(byYear.get(2010)?.gdpCurrentPricesGel).toBe(22_148_700_000);
    expect(byYear.get(2024)?.gdpCurrentPricesGel).toBe(93_022_300_000);
    expect(byYear.get(2025)).toMatchObject({
      gdpCurrentPricesGel: 104_598_100_000,
      status: "preliminary",
    });
  });
});
