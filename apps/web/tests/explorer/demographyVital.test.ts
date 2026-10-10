import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import { birthsPer100Deaths, buildVitalPlaceModel, vitalFactsForPlace, vitalStreak } from "../../lib/explorer/demographyVital";

let served: ServedDemographyObservation[];
beforeAll(async () => {
  served = (await loadServedDemographyData()).facts;
});
const model = (placeId: string) => buildVitalPlaceModel(vitalFactsForPlace(served, placeId), placeId)!;

describe("vital facts for one place", () => {
  it("hand the browser only that place's three series, without provenance", () => {
    const rows = vitalFactsForPlace(served, "06");
    expect(rows).toHaveLength(33);
    expect(new Set(rows.map((row) => row.geographyId))).toEqual(new Set(["06"]));
    expect(Object.keys(rows[0]!).sort()).toEqual(["geographyId", "seriesId", "value", "year"]);
    expect(vitalFactsForPlace(served, "country.georgia")).toHaveLength(36);
  });
});

describe("the place model", () => {
  it("Georgia 2014–2025, deaths ahead since 2020", () => {
    const georgia = model("country.georgia");
    expect(georgia.years).toEqual([2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(georgia.births[2014]).toBe(60_635);
    expect(georgia.natural[2014]).toBe(11_548);
    expect(georgia.latest).toEqual({ year: 2025, births: 37_867, deaths: 44_319, natural: -6_452, ratio: expect.closeTo(85.44, 2) });
    expect(georgia.streak).toEqual({ kind: "deaths-ahead", since: 2020, wholeSeries: false });
  });

  it("Imereti: deaths ahead in every year of the series", () => {
    const imereti = model("region.imereti");
    expect(imereti.years[0]).toBe(2015);
    expect(imereti.latest.births).toBe(4_275);
    expect(imereti.latest.deaths).toBe(7_197);
    expect(Math.round(imereti.latest.ratio!)).toBe(59);
    expect(imereti.streak).toEqual({ kind: "deaths-ahead", since: 2015, wholeSeries: true });
  });

  it("Tbilisi and Batumi: births ahead; Sagarejo: equal", () => {
    expect(model("region.tbilisi").streak).toEqual({ kind: "births-ahead", year: 2025 });
    expect(Math.round(model("region.tbilisi").latest.ratio!)).toBe(112);
    expect(Math.round(model("06").latest.ratio!)).toBe(148);
    expect(model("17").streak).toEqual({ kind: "even", year: 2025 });
    expect(model("17").latest.ratio).toBe(100);
  });

  it("returns null for a place without rows", () => {
    expect(buildVitalPlaceModel([], "99")).toBeNull();
  });
});

describe("helpers", () => {
  it("births per 100 deaths has no value without deaths", () => {
    expect(birthsPer100Deaths(10, 0)).toBeNull();
    expect(birthsPer100Deaths(50, 200)).toBe(25);
  });

  it("the streak ends at an equal year and at a missing year", () => {
    const years = [2020, 2021, 2022];
    expect(vitalStreak(years, { 2020: 1, 2021: 5, 2022: 1 }, { 2020: 2, 2021: 5, 2022: 2 })).toEqual({ kind: "deaths-ahead", since: 2022, wholeSeries: false });
    expect(vitalStreak(years, { 2020: 1, 2021: null, 2022: 1 }, { 2020: 2, 2021: 3, 2022: 2 })).toEqual({ kind: "deaths-ahead", since: 2022, wholeSeries: false });
  });
});
