import { beforeAll, describe, expect, test } from "vitest";
import { loadReviewedAnomalies, type ReviewedAnomalies } from "../../../lib/data/demography/anomalies";
import { loadDemographyGeography, type DemographyGeography } from "../../../lib/data/demography/geography";
import { readMarriage } from "../../../lib/data/demography/readMarriage";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import type { DemographyObservation, DemographySources } from "../../../lib/data/demography/types";
import { repositoryRoot } from "./helpers";

let sources: DemographySources;
let geography: DemographyGeography;
let rows: DemographyObservation[];
let anomalies: ReviewedAnomalies;
beforeAll(async () => {
  [sources, geography, anomalies] = await Promise.all([loadDemographySources(repositoryRoot), loadDemographyGeography(repositoryRoot), loadReviewedAnomalies(repositoryRoot)]);
  rows = readMarriage(sources, geography, anomalies);
});

const GEORGIA = "country.georgia";
const SERIES = {
  marriages: "demography.marriages",
  divorces: "demography.divorces",
  midYear: "demography.mid_year_population",
  ageMarriage: "demography.mean_age_at_marriage",
  ageFirstMarriage: "demography.mean_age_at_first_marriage",
  ageDivorce: "demography.mean_age_at_divorce",
  duration: "demography.mean_marriage_duration",
};
const at = (seriesId: string, geographyId: string, year: number, sex?: string) =>
  rows.find((row) => row.seriesId === seriesId && row.geographyId === geographyId && row.year === year && row.sex === sex);

describe("reading marriages and divorces", () => {
  test("reads Georgia's counts as published from 1994", () => {
    expect(at(SERIES.marriages, GEORGIA, 1994)?.value).toBe("21908");
    expect(at(SERIES.marriages, GEORGIA, 2025)?.value).toBe("22285");
    expect(at(SERIES.divorces, GEORGIA, 2018)?.value).toBe("10288");
    expect(at(SERIES.marriages, GEORGIA, 2025)).toMatchObject({ unit: "marriages", estimateBasis: "registered", sourceId: "source.geostat_demography_marriages" });
    expect(at(SERIES.divorces, GEORGIA, 2025)?.unit).toBe("divorces");
  });

  test("gives Tbilisi one municipality row and the same region row", () => {
    expect(at(SERIES.marriages, "04", 2025)?.value).toBe("6553");
    expect(at(SERIES.marriages, "region.tbilisi", 2025)?.value).toBe("6553");
  });

  test("adds a separately printed city row to its municipality in 2014-2016", () => {
    const telavi = at(SERIES.marriages, "15", 2015)!;
    expect(telavi.sourceLocator.split("+")).toHaveLength(2);
    expect(at(SERIES.marriages, "15", 2017)!.sourceLocator).not.toContain("+");
  });

  test("reads the mid-year population to the half person, with the lineage of its year", () => {
    expect(at(SERIES.midYear, GEORGIA, 2025)).toMatchObject({ value: "3935765.5", unit: "persons", estimateBasis: "census_based" });
    expect(at(SERIES.midYear, GEORGIA, 2024)?.estimateBasis).toBe("pre_census");
    expect(at(SERIES.midYear, GEORGIA, 1994)?.estimateBasis).toBe("retro_projection");
  });

  test("reads the ages and the marriage length for Georgia at one decimal", () => {
    expect(at(SERIES.ageFirstMarriage, GEORGIA, 2025, "female")?.value).toBe("30.1");
    expect(at(SERIES.ageFirstMarriage, GEORGIA, 2025, "male")?.value).toBe("32.4");
    expect(at(SERIES.ageMarriage, GEORGIA, 1994, "male")?.value).toBe("27.7");
    expect(at(SERIES.ageDivorce, GEORGIA, 2025, "female")?.value).toBe("39.4");
    expect(at(SERIES.duration, GEORGIA, 2025)?.value).toBe("10.9");
    for (const seriesId of [SERIES.ageMarriage, SERIES.ageFirstMarriage, SERIES.ageDivorce]) {
      const own = rows.filter((row) => row.seriesId === seriesId);
      expect(own).toHaveLength(2 * 32);
      expect(new Set(own.map((row) => row.sex))).toEqual(new Set(["male", "female"]));
      expect(own.every((row) => row.geographyId === GEORGIA && row.unit === "years")).toBe(true);
    }
  });

  test("serves places from 2009 only, for Georgia, 11 regions and 64 municipalities", () => {
    for (const seriesId of [SERIES.marriages, SERIES.divorces, SERIES.midYear]) {
      const own = rows.filter((row) => row.seriesId === seriesId);
      expect(new Set(own.map((row) => row.geographyId)).size).toBe(76);
      expect(own.filter((row) => row.geographyId !== GEORGIA).every((row) => row.year >= 2009)).toBe(true);
      expect(own).toHaveLength(32 + 75 * 17);
    }
    expect(geography.municipalities).toHaveLength(64);
  });
});
