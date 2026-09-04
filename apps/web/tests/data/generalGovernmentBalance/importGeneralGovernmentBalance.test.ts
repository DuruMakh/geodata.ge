import { describe, expect, it } from "vitest";

import { loadGeneralGovernmentBalanceFacts } from "../../../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";

describe("loadGeneralGovernmentBalanceFacts", () => {
  it("loads exactly one fact for every 1995-2031 year", async () => {
    const rows = await loadGeneralGovernmentBalanceFacts(
      "../../data/imports/general-government-balance-annual-1995-2031.csv",
    );
    expect(rows).toHaveLength(37);
    expect(rows[0]?.year).toBe(1995);
    expect(rows.at(-1)?.year).toBe(2031);
    expect(rows.filter((row) => row.status === "actual")).toHaveLength(31);
    expect(rows.filter((row) => row.status === "projection")).toHaveLength(6);
  });

  it("rejects duplicate years", async () => {
    await expect(
      loadGeneralGovernmentBalanceFacts(
        "tests/fixtures/general-government-balance/duplicate-year.csv",
      ),
    ).rejects.toThrow("Duplicate general-government balance year");
  });

  it("rejects percentage and nominal values with different signs", async () => {
    await expect(
      loadGeneralGovernmentBalanceFacts(
        "tests/fixtures/general-government-balance/sign-mismatch.csv",
      ),
    ).rejects.toThrow("sign mismatch");
  });
});
