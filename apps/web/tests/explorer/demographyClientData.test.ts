import { describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { formatInUnit, thousandsUnit, UNIT_DENSITY, UNIT_PERSONS } from "../../lib/explorer/format";

describe("demography client rows", () => {
  it("keeps only the fields the browser reads", async () => {
    const { facts } = await loadServedDemographyData();
    expect(Object.keys(projectDemographyObservation(facts[0]!)).sort()).toEqual([
      "geographyId", "seriesId", "value", "year",
    ]);
  });
});

describe("persons formats", () => {
  it("prints whole persons in full and density at one decimal", () => {
    expect(formatInUnit(3_694_608, UNIT_PERSONS)).toBe("3,694,608");
    expect(formatInUnit(2495.9, UNIT_DENSITY)).toBe("2,495.9");
    expect(formatInUnit(5.7, UNIT_DENSITY)).toBe("5.7");
    expect(formatInUnit(65, UNIT_DENSITY)).toBe("65.0");
    expect(formatInUnit(null, UNIT_PERSONS)).toBe("—");
  });

  it("labels the thousands axis unit in both languages", () => {
    expect(thousandsUnit("ka")).toEqual({ divisor: 1000, decimals: 1, label: "ათ." });
    expect(thousandsUnit("en")).toEqual({ divisor: 1000, decimals: 1, label: "k" });
    expect(formatInUnit(3_694_608, thousandsUnit("en"))).toBe("3,694.6");
  });
});
