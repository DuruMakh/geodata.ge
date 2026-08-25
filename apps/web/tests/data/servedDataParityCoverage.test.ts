import { describe, expect, it } from "vitest";
import {
  EXPLORER_ROW_PARITY_CHECKS,
  MUNICIPAL_PARITY_CHECKS,
  loadServedMunicipalData,
  resetServedDataCacheForTests,
} from "../../lib/data/servedData";

describe("served data parity coverage", () => {
  it("checks every municipal dataset the site serves", async () => {
    resetServedDataCacheForTests();
    const municipal = await loadServedMunicipalData();

    // Every MunicipalData field is a row array, so every one of them belongs in
    // the table. A field here that the table does not name is unverified data
    // reaching production.
    const unchecked = Object.keys(municipal).filter((field) => !(field in MUNICIPAL_PARITY_CHECKS));

    expect(unchecked).toEqual([]);
  });

  it("gives every municipal check a distinct label so a failure names its dataset", () => {
    const labels = Object.values(MUNICIPAL_PARITY_CHECKS).map((check) => check.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("gives every explorer check a distinct label", () => {
    const labels = Object.values(EXPLORER_ROW_PARITY_CHECKS).map((check) => check.label);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
