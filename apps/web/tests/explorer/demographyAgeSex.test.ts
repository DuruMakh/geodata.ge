import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import {
  AGE_SEX_GROUPS,
  ageGroupLabel,
  ageYears,
  annualAgeFacts,
  annualPyramid,
  bandShares,
  censusAgeFactsForPlace,
  censusPyramid,
  crossesBreak,
  effectiveMeasure,
  heatmapRows,
  parseAgeSexHash,
  serializeAgeSexHash,
  urbanShare,
  womenPer100Men,
} from "../../lib/explorer/demographyAgeSex";
import type { ClientAgeFact } from "../../lib/servedRows";

let served: ServedDemographyObservation[];
let annual: ClientAgeFact[];
let years: number[];

beforeAll(async () => {
  served = (await loadServedDemographyData()).facts;
  annual = annualAgeFacts(served);
  years = ageYears(annual);
});

describe("the age facts", () => {
  it("keeps the annual men and women rows and only the fields the browser reads", () => {
    expect(annual).toHaveLength(874);
    for (const key of ["sourceId", "estimateBasis"]) expect(Object.keys(annual[0]!)).not.toContain(key);
    expect(Object.keys(annual[0]!).sort()).toEqual(["ageGroup", "settlement", "sex", "value", "year"]);
    expect(years[0]).toBe(2004);
    expect(years.at(-1)).toBe(2026);
  });

  it("keeps a place's census rows by sex and settlement, and none for a municipality", () => {
    expect(censusAgeFactsForPlace(served, "region.imereti")).toHaveLength(108);
    expect(censusAgeFactsForPlace(served, "06")).toEqual([]);
  });

  it("labels the groups with an en dash", () => {
    expect(AGE_SEX_GROUPS).toHaveLength(18);
    expect(AGE_SEX_GROUPS[0]).toBe("age_0_4");
    expect(AGE_SEX_GROUPS.at(-1)).toBe("age_85_plus");
    expect(ageGroupLabel("age_0_4")).toBe("0–4");
    expect(ageGroupLabel("age_85_plus")).toBe("85+");
  });
});

describe("the annual pyramid", () => {
  it("adds the first two age rows into 0-4 and totals to the published figure", () => {
    const pyramid = annualPyramid(annual, 2026);
    expect(pyramid.male).toBe(1_887_646);
    expect(pyramid.female).toBe(2_053_457);
    expect(pyramid.total).toBe(3_941_103);
    expect(pyramid.rows).toHaveLength(18);
    expect(pyramid.rows[0]).toEqual({ group: "age_0_4", male: 106_170, female: 97_930 });
  });

  it("throws when a group is missing", () => {
    expect(() => annualPyramid(annual.filter((fact) => fact.ageGroup !== "age_1_4"), 2026)).toThrow();
  });

  it("reads the three bands and the sex ratio", () => {
    const old = (year: number) => bandShares(annualPyramid(annual, year)).old.toFixed(1);
    expect([2004, 2024, 2025, 2026].map(old)).toEqual(["14.1", "16.2", "17.6", "18.1"]);
    const latest = bandShares(annualPyramid(annual, 2026));
    expect(latest.young.toFixed(1)).toBe("19.0");
    expect(latest.working.toFixed(1)).toBe("62.9");
    expect(womenPer100Men(annualPyramid(annual, 2026)).toFixed(1)).toBe("108.8");
    expect(womenPer100Men(annualPyramid(annual, 2004)).toFixed(1)).toBe("110.0");
  });

  it("matches the published age-band rows in every year", () => {
    const bands = { band_0_14: "young", band_15_64: "working", band_65_plus: "old" } as const;
    const published = served.filter((fact) => fact.seriesId === SERIES.populationAgeBand && fact.geographyId === "country.georgia" && fact.sex === "total");
    expect(published.length).toBeGreaterThan(0);
    for (const year of years) {
      const shares = bandShares(annualPyramid(annual, year));
      const rows = published.filter((fact) => fact.year === year);
      const total = rows.reduce((sum, fact) => sum + fact.value, 0);
      for (const row of rows) {
        const key = bands[row.ageGroup as keyof typeof bands];
        expect(Math.abs(shares[key] - (row.value / total) * 100)).toBeLessThan(1e-9);
      }
    }
  });
});

describe("the census pyramids", () => {
  it("reads Georgia and Imereti", () => {
    const georgia = censusAgeFactsForPlace(served, "country.georgia");
    const total = censusPyramid(georgia, "total");
    expect(total.total).toBe(3_929_581);
    expect(total.rows[0]!.male + total.rows[0]!.female).toBe(211_270);
    expect(urbanShare(georgia).toFixed(1)).toBe("62.5");
    const imereti = censusAgeFactsForPlace(served, "region.imereti");
    expect(censusPyramid(imereti, "total").total).toBe(510_741);
    expect(urbanShare(imereti).toFixed(1)).toBe("53.6");
    expect(bandShares(censusPyramid(imereti, "total")).old.toFixed(1)).toBe("22.0");
    expect(urbanShare(censusAgeFactsForPlace(served, "region.tbilisi")).toFixed(1)).toBe("96.6");
    expect(censusPyramid(georgia, "urban").total + censusPyramid(georgia, "rural").total).toBe(total.total);
    expect(censusPyramid(imereti, "urban").total + censusPyramid(imereti, "rural").total).toBe(510_741);
  });
});

describe("the heat map", () => {
  it("puts 85+ on top and makes every year sum to 100", () => {
    const heat = heatmapRows(annual, years);
    expect(heat.rows).toHaveLength(18);
    expect(heat.rows[0]!.id).toBe("age_85_plus");
    expect(heat.rows[0]!.label).toBe("85+");
    expect(heat.rows.at(-1)!.id).toBe("age_0_4");
    years.forEach((_, index) => {
      const sum = heat.rows.reduce((total, row) => total + row.values[index]!, 0);
      expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
    });
    expect(heat.maximum.toFixed(3)).toBe("8.232");
  });
});

describe("the hash", () => {
  it("defaults to the latest year", () => {
    expect(parseAgeSexHash("", years)).toEqual({ year: 2026, compare: null, measure: "share" });
  });

  it("drops an unknown year, an unknown comparison and a comparison with itself", () => {
    expect(parseAgeSexHash("#year=1999&cmp=2030", years)).toMatchObject({ year: 2026, compare: null });
    expect(parseAgeSexHash("#year=2026&cmp=2026", years).compare).toBeNull();
    expect(parseAgeSexHash("#measure=bogus&pyramid=x&bands=y", years)).toEqual(parseAgeSexHash("", years));
  });

  it("forces shares across the census break", () => {
    const within = parseAgeSexHash("#year=2010&cmp=2004&measure=persons", years);
    expect(within).toMatchObject({ year: 2010, compare: 2004, measure: "persons" });
    expect(effectiveMeasure(within)).toBe("persons");
    const across = parseAgeSexHash("#year=2026&cmp=2004&measure=persons", years);
    expect(across.measure).toBe("persons");
    expect(effectiveMeasure(across)).toBe("share");
    expect(crossesBreak(2024, 2025)).toBe(true);
    expect(crossesBreak(2025, 2026)).toBe(false);
    expect(crossesBreak(2004, 2024)).toBe(false);
  });

  it("round-trips and serializes the default state to nothing", () => {
    const hash = "year=2010&cmp=2004&measure=persons";
    expect(serializeAgeSexHash(parseAgeSexHash(`#${hash}`, years), years)).toBe(hash);
    // The age-groups-over-time table and the pyramid's table twin are gone: an old link that asks for either is ignored.
    expect(serializeAgeSexHash(parseAgeSexHash("#bands=table", years), years)).toBe("");
    expect(serializeAgeSexHash(parseAgeSexHash("#pyramid=table", years), years)).toBe("");
    expect(parseAgeSexHash("#pyramid=table", years)).toEqual(parseAgeSexHash("", years));
    expect(serializeAgeSexHash(parseAgeSexHash("", years), years)).toBe("");
  });
});
