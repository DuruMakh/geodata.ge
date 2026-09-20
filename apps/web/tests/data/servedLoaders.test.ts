import { describe, expect, it } from "vitest";
import { loadServedGovernmentDebtData } from "../../lib/data/governmentDebt/importGovernmentDebtFacts";
import { loadServedGeneralGovernmentBalanceData } from "../../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";
import { loadServedGdpOverviewData } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData } from "../../lib/data/economicSectors/importEconomicSectors";
import { loadServedRegionalEconomyData } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { resetServedDataCacheForTests } from "../../lib/data/servedData";

// A build prerenders ~25 routes that each need debt data, and generateMetadata
// loads again beside its own page. Without a memo every one of those re-parses
// the CSVs and, in db mode, re-runs the full row-by-row parity check.
const loaders = {
  debt: loadServedGovernmentDebtData,
  deficit: loadServedGeneralGovernmentBalanceData,
  gdp: loadServedGdpOverviewData,
  sectors: loadServedEconomicSectorsData,
  regional: loadServedRegionalEconomyData,
  inflation: loadServedInflationData,
} as const;

describe("served loaders", () => {
  it("returns the same promise to concurrent and later callers", () => {
    for (const [name, load] of Object.entries(loaders)) {
      expect(load(), name).toBe(load());
    }
  });

  it("returns identical data to repeated callers", async () => {
    for (const [name, load] of Object.entries(loaders)) {
      const [first, second] = await Promise.all([load(), load()]);
      expect(first, name).toBe(second);
    }
  });

  it("resetServedDataCacheForTests clears every loader", async () => {
    const before = await Promise.all(Object.values(loaders).map((load) => load()));
    resetServedDataCacheForTests();
    const after = await Promise.all(Object.values(loaders).map((load) => load()));
    after.forEach((value, index) => expect(value).not.toBe(before[index]));
  });
});
