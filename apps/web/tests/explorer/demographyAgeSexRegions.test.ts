import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildAgeSexRegionModel, georgiaOldShare } from "../../lib/explorer/demographyAgeSexRegions";

let served: ServedDemographyObservation[];
let regions: MunicipalRegion[];
beforeAll(async () => {
  [{ facts: served }, { regions }] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
});

describe("age and sex region model", () => {
  it("ranks the 11 regions by the census share aged 65+, the anchor list in order", () => {
    const model = buildAgeSexRegionModel(served, regions);
    expect(model.regions).toHaveLength(11);
    expect(model.regions.map((region) => [region.regionId, region.value.toFixed(1)])).toEqual([
      ["region.racha_lechkhumi_kvemo_svaneti", "31.2"],
      ["region.guria", "24.1"],
      ["region.samegrelo_zemo_svaneti", "22.6"],
      ["region.imereti", "22.0"],
      ["region.kakheti", "21.4"],
      ["region.mtskheta_mtianeti", "20.3"],
      ["region.samtskhe_javakheti", "19.1"],
      ["region.shida_kartli", "18.9"],
      ["region.kvemo_kartli", "16.2"],
      ["region.tbilisi", "14.4"],
      ["region.adjara", "13.1"],
    ]);
    expect(model.regions[0]).toMatchObject({ regionId: "region.racha_lechkhumi_kvemo_svaneti", rank: 1 });
    expect(model.regions.map((region) => region.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(model.firstYear).toBe(2024);
    expect(model.year).toBe(2024);
    expect(new Set(model.regions.map((region) => region.pathD))).toHaveLength(11);
    expect(model.regions.every((region) => region.bucket >= 0 && region.bucket <= 5)).toBe(true);
    expect(model.legendMin).toBeCloseTo(model.regions.at(-1)!.value, 10);
    expect(model.legendMax).toBeCloseTo(model.regions[0]!.value, 10);
  });

  it("throws when a region's census rows are missing", () => {
    const withoutGuria = served.filter((fact) => fact.geographyId !== "region.guria");
    expect(() => buildAgeSexRegionModel(withoutGuria, regions)).toThrow(/guria/);
  });

  it("throws when a region has no map geometry", () => {
    expect(() => buildAgeSexRegionModel(served, [...regions, { id: "region.atlantis", kaLabel: "ატლანტიდა", sortOrder: 99 }])).toThrow(/atlantis/);
  });

  it("gives Georgia's census share aged 65+", () => {
    expect(georgiaOldShare(served).toFixed(1)).toBe("17.6");
  });
});
