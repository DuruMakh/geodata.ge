import { describe, expect, it } from "vitest";

import { loadNationalGdpFacts } from "../../../lib/data/nationalGdp/importNationalGdp";

describe("loadNationalGdpFacts", () => {
  it("loads exactly one canonical GDP fact for every 1996–2025 year", async () => {
    const rows = await loadNationalGdpFacts(
      "../../data/imports/national-gdp-annual-1996-2025.csv",
    );

    expect(rows).toHaveLength(30);
    expect(rows[0]?.year).toBe(1996);
    expect(rows.at(-1)?.year).toBe(2025);
    expect(rows.every((row) => row.sourceId.startsWith("source."))).toBe(true);
  });

  it("rejects duplicate years", async () => {
    await expect(
      loadNationalGdpFacts("tests/fixtures/national-gdp/duplicate-year.csv"),
    ).rejects.toThrow(/Duplicate GDP year/);
  });

  it("rejects a non-positive denominator", async () => {
    await expect(
      loadNationalGdpFacts("tests/fixtures/national-gdp/zero-gdp.csv"),
    ).rejects.toThrow(/must be positive/);
  });
});
