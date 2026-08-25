import { describe, expect, it } from "vitest";
import {
  EXPLORER_ROW_PARITY_CHECKS,
  MUNICIPAL_PARITY_CHECKS,
  loadServedMunicipalData,
  resetServedDataCacheForTests,
} from "../../lib/data/servedData";

// glossary is a Map, not a row array, so it is parity-checked by hand inside
// assertLandingParity rather than through the table. Any OTHER field that is
// neither in the table nor listed here is unverified data reaching production.
const HANDLED_OUTSIDE_THE_TABLES = new Set(["glossary"]);

describe("served data parity coverage", () => {
  it("checks every municipal dataset the site serves", async () => {
    resetServedDataCacheForTests();
    const municipal = await loadServedMunicipalData();

    const unchecked = Object.keys(municipal).filter(
      (field) => !(field in MUNICIPAL_PARITY_CHECKS) && !HANDLED_OUTSIDE_THE_TABLES.has(field),
    );

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
