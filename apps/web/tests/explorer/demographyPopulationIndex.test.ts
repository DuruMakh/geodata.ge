import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationIndexModel, type PopulationIndexModel } from "../../lib/explorer/demographyPopulationIndex";
import { pickerGroupsFromRows } from "../../lib/explorer/municipalData";

let facts: ServedDemographyObservation[];
let regions: MunicipalRegion[];
let municipalities: Municipality[];
let index: PopulationIndexModel;

beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  regions = municipal.regions;
  municipalities = municipal.municipalities;
  index = buildPopulationIndexModel({ facts, regions, municipalities });
});

describe("population index model", () => {
  test("the latest year, Georgia and the map", () => {
    expect(index.year).toBe(2026);
    expect(index.country).toMatchObject({ id: "country.georgia", kind: "country", valueGel: 3_941_103, rank: null });
    expect(index.country.subtitleKa).toBe("64 მუნიციპალიტეტი");
    expect(index.map.shapes).toHaveLength(60);
    expect(index.map.markers).toHaveLength(5);
  });

  test("64 municipalities ranked by persons: Tbilisi, Batumi, Kutaisi, Rustavi first and Lentekhi last", () => {
    expect(index.municipalities).toHaveLength(64);
    expect(index.municipalities.slice(0, 4).map((row) => [row.id, row.rank, row.valueGel])).toEqual([
      ["04", 1, 1_369_356],
      ["06", 2, 246_267],
      ["20", 3, 153_799],
      ["48", 4, 130_174],
    ]);
    expect(index.municipalities.at(-1)).toMatchObject({ id: "70", rank: 64, valueGel: 5_056 });
    expect(index.municipalities.find((row) => row.id === "11")).toMatchObject({ kind: "municipality", regionId: "region.adjara", valueGel: 16_098 });
    expect(index.municipalities.every((row) => row.budgetPerResidentGel === null)).toBe(true);
  });

  test("11 regions ranked by persons, with their municipality counts", () => {
    expect(index.regions).toHaveLength(11);
    expect(index.regions.map((row) => row.id)).toEqual([
      "region.tbilisi", "region.imereti", "region.kvemo_kartli", "region.adjara", "region.kakheti", "region.samegrelo_zemo_svaneti",
      "region.shida_kartli", "region.samtskhe_javakheti", "region.guria", "region.mtskheta_mtianeti", "region.racha_lechkhumi_kvemo_svaneti",
    ]);
    expect(index.regions[3]).toMatchObject({ id: "region.adjara", rank: 4, valueGel: 413_214 });
    expect(index.regions[3]!.subtitleKa).toBe("6 მუნიციპალიტეტი");
    expect(index.regions.find((row) => row.id === "region.tbilisi")!.subtitleKa).toBe("1 მუნიციპალიტეტი");
  });

  test("the parts add up: the regions and the municipalities each sum to Georgia, Adjara to its six", () => {
    const sum = (rows: { valueGel: number }[]) => rows.reduce((total, row) => total + row.valueGel, 0);
    expect(sum(index.regions)).toBe(index.country.valueGel);
    expect(sum(index.municipalities)).toBe(index.country.valueGel);
    expect(sum(index.municipalities.filter((row) => row.regionId === "region.adjara"))).toBe(413_214);
  });

  test("density by place in the latest density year: Georgia and the regions only", () => {
    expect(index.densityYear).toBe(2026);
    expect(Object.keys(index.densityByPlace)).toHaveLength(12);
    expect(index.densityByPlace["region.tbilisi"]).toBe(2715.7);
    expect(index.densityByPlace["region.adjara"]).toBe(142.5);
    expect(index.densityByPlace["06"]).toBeUndefined();
  });

  test("picker groups: 11 regions in value order, each with its municipalities in value order; Tbilisi lists itself", () => {
    const groups = pickerGroupsFromRows(index);
    expect(groups).toHaveLength(11);
    expect(groups[0]).toMatchObject({ regionId: "region.tbilisi", valueGel: 1_369_356, members: [{ code: "04", valueGel: 1_369_356 }] });
    const adjara = groups.find((group) => group.regionId === "region.adjara")!;
    expect(adjara.members.map((member) => member.code)).toEqual(["06", "07", "08", "11", "09", "10"]);
    expect(groups.reduce((total, group) => total + group.members.length, 0)).toBe(64);
  });

  test("a missing municipality value is refused", () => {
    const without = facts.filter((fact) => !(fact.geographyId === "33" && fact.year === 2026));
    expect(() => buildPopulationIndexModel({ facts: without, regions, municipalities })).toThrow(/33/);
  });
});
