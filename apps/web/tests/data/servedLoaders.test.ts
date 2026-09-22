import { beforeEach, describe, expect, it } from "vitest";
import { loadServedGovernmentDebtData } from "../../lib/data/governmentDebt/importGovernmentDebtFacts";
import { loadServedGeneralGovernmentBalanceData } from "../../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";
import { loadServedGdpOverviewData, loadServedGdpOverviewRows } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData, loadServedEconomicSectorsRows } from "../../lib/data/economicSectors/importEconomicSectors";
import { loadServedRegionalEconomyData, loadServedRegionalEconomyRows } from "../../lib/data/regionalEconomies/importRegionalEconomies";
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
  // The three the snapshot reads before the numeric projection. Their row memo
  // sits behind the numbers memo, so a reset that clears only the numbers still
  // hands back a fresh wrapper around stale rows — checking the numbers alone
  // cannot see that.
  gdpRows: loadServedGdpOverviewRows,
  sectorRows: loadServedEconomicSectorsRows,
  regionalRows: loadServedRegionalEconomyRows,
} as const;

// Every other file in tests/data pins the mode. Without this the file reads
// whatever the environment happens to set, and a mirror failure reads like a
// memo bug.
beforeEach(() => {
  delete process.env.GEODATA_DATA_SOURCE;
  resetServedDataCacheForTests();
});

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
