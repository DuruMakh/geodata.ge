import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildVitalIndexModel, deathsAheadCount, type VitalIndexModel } from "../../lib/explorer/demographyVitalIndex";

let index: VitalIndexModel;
let facts: Awaited<ReturnType<typeof loadServedDemographyData>>["facts"];
beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  index = buildVitalIndexModel({ facts, regions: municipal.regions, municipalities: municipal.municipalities });
});

describe("births per 100 deaths index", () => {
  it("uses the latest year and ranks highest first", () => {
    expect(index.year).toBe(2025);
    expect(index.municipalities).toHaveLength(64);
    expect(index.regions).toHaveLength(11);
    expect(index.regions[0]!.id).toBe("region.adjara");
    expect(index.regions.at(-1)!.id).toBe("region.racha_lechkhumi_kvemo_svaneti");
    expect(index.regions.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(Math.round(index.country.valueGel)).toBe(85);
  });

  it("keeps the counts behind each ratio", () => {
    expect(index.countsById["country.georgia"]).toEqual({ births: 37_867, deaths: 44_319 });
    expect(index.countsById["region.imereti"]).toEqual({ births: 4_275, deaths: 7_197 });
    expect(index.countsById["06"]).toEqual({ births: 2_630, deaths: 1_779 });
    expect(Math.round(index.municipalities.find((row) => row.id === "17")!.valueGel)).toBe(100);
  });

  it("counts municipalities where deaths exceeded births", () => {
    expect(index.deathsAhead).toBe(53);
    expect(index.municipalityCount).toBe(64);
    expect(deathsAheadCount(facts, 2015)).toBe(32);
  });

  it("draws every municipality on the map", () => {
    expect(index.map.shapes.length).toBeGreaterThan(0);
  });
});
