import { beforeAll, describe, expect, test } from "vitest";
import { loadServedCrimeData, toClientCrimeFact } from "../../lib/data/crime/importCrime";
import { CRIME_INDICATORS, type ClientCrimeFact, type CrimeSeriesBreak } from "../../lib/data/crime/types";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { INK } from "../../lib/explorer/colors";
import {
  CRIME_HUB_PATH, CRIME_SECTIONS, buildCrimeModel, changeCrimeMeasure, crimeCoverage, crimeDefaultSelection, crimeMeasureFacts, crimeSeries,
  crimeSeriesColor, crimeUnitKey, defaultCrimeState, parseCrimeHash, serializeCrimeHash, type CrimeMeasure, type CrimePopulation, type CrimeSectionId,
} from "../../lib/explorer/crime";

let facts: ClientCrimeFact[];
let breaks: CrimeSeriesBreak[];
let population: CrimePopulation;
beforeAll(async () => {
  const served = await loadServedCrimeData();
  facts = served.facts.map(toClientCrimeFact);
  breaks = served.breaks;
  population = (await loadServedDemographyData()).facts
    .filter(f => f.seriesId === SERIES.populationTotal && f.geographyId === "country.georgia")
    .map(f => ({ year: f.year, persons: f.value }));
});

const state = (section: CrimeSectionId, selectedIds: string[], measure: CrimeMeasure = "count", range = { kind: "all" } as ReturnType<typeof defaultCrimeState>["range"]) =>
  ({ ...defaultCrimeState(section), selectedIds, measure, range });
const breakYears = (section: CrimeSectionId, selectedIds: string[], measure: CrimeMeasure, start?: number, end?: number) =>
  buildCrimeModel(section, facts, population, state(section, selectedIds, measure, start === undefined ? { kind: "all" } : { kind: "manual", start, end: end! }), breaks).breaks.map(b => b.year);

describe("sections, defaults and coverage", () => {
  test("the five sections", () => {
    expect(CRIME_HUB_PATH).toBe("/explorer/crime");
    expect(CRIME_SECTIONS).toEqual([
      { id: "recorded", href: "/explorer/crime/recorded", labelKey: "common.crimeRecorded" },
      { id: "convictions", href: "/explorer/crime/convictions", labelKey: "common.crimeConvictions" },
      { id: "prisons", href: "/explorer/crime/prisons", labelKey: "common.crimePrisons" },
      { id: "victims", href: "/explorer/crime/victims", labelKey: "common.crimeVictims" },
      { id: "road-accidents", href: "/explorer/crime/road-accidents", labelKey: "common.crimeRoadAccidents" },
    ]);
  });

  test("only the page total is selected by default", () => {
    expect(crimeDefaultSelection("recorded")).toEqual(["crime.recorded.total"]);
    expect(crimeDefaultSelection("road-accidents")).toEqual(["crime.road.accidents"]);
    expect(defaultCrimeState("convictions")).toEqual({ mode: "line", range: { kind: "all" }, measure: "count", selectedIds: ["crime.convicted.total"] });
  });

  test("coverage follows the section's count years", () => {
    const recorded = crimeCoverage("recorded", facts);
    expect([recorded.min, recorded.max]).toEqual([2015, 2025]);
    const convictions = crimeCoverage("convictions", facts);
    expect([convictions.min, convictions.max]).toEqual([2001, 2025]);
    const victims = crimeCoverage("victims", facts).years;
    expect(victims).toContain(2011);
    expect(victims).toContain(2015);
    expect(victims).not.toContain(2012);
  });

  test("the model's range resolves to the section's coverage", () => {
    const model = buildCrimeModel("recorded", facts, population, defaultCrimeState("recorded"), breaks);
    expect([model.range.start, model.range.end]).toEqual([2015, 2025]);
  });
});

describe("the series lists", () => {
  const headings = (section: CrimeSectionId) => crimeSeries(section).map(s => s.heading);
  test("every list starts with its reference and lists each served series once, in table order", () => {
    for (const { id } of CRIME_SECTIONS) {
      const list = crimeSeries(id);
      expect(list[0].reference).toBe(true);
      expect(list.filter(s => s.reference)).toHaveLength(1);
      expect(new Set(list.map(s => s.id)).size).toBe(list.length);
      expect(list.map(s => s.id)).toEqual(CRIME_INDICATORS.filter(i => list.some(s => s.id === i)));
    }
    expect(CRIME_SECTIONS.flatMap(s => crimeSeries(s.id)).map(s => s.id).sort()).toEqual([...CRIME_INDICATORS].sort());
    expect(crimeSeries("recorded")[0]).toEqual({ id: "crime.recorded.total", reference: true });
  });

  test("convictions: total, 11 types, 5 ages, 2 sexes, 7 sentences", () => {
    const expected = [undefined, ...Array(11).fill("type"), ...Array(5).fill("age"), ...Array(2).fill("sex"), ...Array(7).fill("sentence")];
    expect(headings("convictions")).toEqual(expected);
    expect(crimeSeries("convictions")).toHaveLength(26);
  });

  test("recorded, prisons, victims and road accidents", () => {
    expect(headings("recorded")).toEqual([undefined, ...Array(11).fill("type")]);
    expect(crimeSeries("prisons")).toHaveLength(7);
    expect(headings("prisons")).toEqual([undefined, "sex", "sex", "age", "age", "status", "status"]);
    expect(crimeSeries("victims")).toHaveLength(14);
    expect(headings("victims")).toEqual([undefined, ...Array(3).fill("sex"), ...Array(5).fill("age"), ...Array(5).fill("citizenship")]);
    expect(crimeSeries("road-accidents")).toHaveLength(4);
    expect(headings("road-accidents")).toEqual(["accidents", "accidents", "people", "people"]);
    expect(crimeSeries("road-accidents").map(s => s.reference)).toEqual([true, false, false, false]);
  });
});

describe("the per-100,000 view", () => {
  test("a count is divided by the population of the same year, in hundred-thousands", () => {
    const rate = (year: number) => buildCrimeModel("convictions", facts, population, state("convictions", ["crime.convicted.total"], "per100k"), breaks)
      .selected[0].valuesByYear[year];
    expect(Number(rate(2004)!.toFixed(1))).toBe(230.4);
    expect(rate(2004)).toBe(Number((9071 / 3937716 * 100000).toPrecision(15)));
    for (const year of [2001, 2002, 2003]) expect(rate(year)).toBeNull();
    const recorded = buildCrimeModel("recorded", facts, population, state("recorded", ["crime.recorded.total"], "per100k"), breaks);
    expect(recorded.selected[0].valuesByYear[2025]).toBe(Number((54134 / 3930428 * 100000).toPrecision(15)));
    expect(recorded.unitKey).toBe("crime.unitPer100k");
    expect(recorded.decimals).toBe(1);
  });

  test("crimeMeasureFacts keeps counts as they are and drops a year without population", () => {
    const counts = crimeMeasureFacts("count", facts, population);
    expect(counts).toHaveLength(facts.length);
    expect(counts.every(f => f.decimals === 0)).toBe(true);
    const rates = crimeMeasureFacts("per100k", facts, population);
    expect(rates.every(f => f.decimals === 1 && f.calculated)).toBe(true);
    expect(rates.some(f => f.year <= 2003)).toBe(false);
    expect(rates.length).toBeLessThan(facts.length);
    expect(rates.length).toBe(facts.filter(f => f.year >= 2004).length);
  });

  test("the unit follows the measure and the series", () => {
    expect(crimeUnitKey("per100k", "crime.prison.total")).toBe("crime.unitPer100k");
    expect(crimeUnitKey("count", "crime.recorded.life")).toBe("crime.unitCrimes");
    expect(crimeUnitKey("count", "crime.road.accidents")).toBe("crime.unitAccidents");
    expect(crimeUnitKey("count", "crime.road.accidents_drunk")).toBe("crime.unitAccidents");
    expect(crimeUnitKey("count", "crime.road.killed")).toBe("crime.unitPersons");
    expect(crimeUnitKey("count", "crime.convicted.total")).toBe("crime.unitPersons");
    expect(buildCrimeModel("road-accidents", facts, population, defaultCrimeState("road-accidents"), breaks).unitKey).toBe("crime.unitAccidents");
  });
});

describe("series breaks", () => {
  test("the 2018 registration change, where a selected series is affected", () => {
    expect(breakYears("recorded", ["crime.recorded.total"], "count", 2015, 2025)).toEqual([2018]);
    expect(breakYears("recorded", ["crime.recorded.total"], "count", 2019, 2025)).toEqual([]);
    expect(breakYears("recorded", ["crime.recorded.total"], "count")).toEqual([2018]);
  });

  test("the census recalculation is drawn only on the per-100,000 view", () => {
    expect(breakYears("recorded", ["crime.recorded.total"], "per100k", 2015, 2025)).toEqual([2018, 2025]);
    expect(breakYears("prisons", ["crime.prison.total"], "count")).toEqual([]);
    expect(breakYears("prisons", ["crime.prison.total"], "per100k")).toEqual([2025]);
    expect(breakYears("prisons", ["crime.prison.total"], "per100k", 2025, 2025)).toEqual([]);
  });

  test("the drunk-driving coverage change applies to its own series", () => {
    expect(breakYears("road-accidents", ["crime.road.accidents_drunk"], "count")).toEqual([2025]);
    expect(breakYears("road-accidents", ["crime.road.accidents"], "count")).toEqual([]);
  });

  test("every break is labelled newCounting", () => {
    const model = buildCrimeModel("recorded", facts, population, state("recorded", ["crime.recorded.total"], "per100k"), breaks);
    expect(model.breaks.every(b => b.label === "newCounting")).toBe(true);
  });
});

describe("gaps are null, never zero", () => {
  const series = (section: CrimeSectionId, id: string) => buildCrimeModel(section, facts, population, state(section, [id]), breaks).series.find(s => s.id === id)!;
  test("victims by sex start in 2015", () => {
    const women = series("victims", "crime.victims.sex_women");
    for (const year of [2012, 2013, 2014]) expect(women.valuesByYear[year]).toBeNull();
    expect(women.valuesByYear[2015]).toBeGreaterThan(0);
  });
  test("pre-trial prisoners start in 2010", () => {
    const pretrial = series("prisons", "crime.prison.pretrial");
    for (let year = 2001; year <= 2009; year++) expect(pretrial.valuesByYear[year]).toBeNull();
    expect(pretrial.valuesByYear[2010]).not.toBeNull();
  });
  test("drunk-driving accidents have no 2002 figure", () => {
    expect(series("road-accidents", "crime.road.accidents_drunk").valuesByYear[2002]).toBeNull();
  });
});

describe("the hash", () => {
  test("a selection mixing units keeps the first one's unit", () => {
    expect(parseCrimeHash("#sel=crime.road.accidents,crime.road.killed", "road-accidents", facts).selectedIds).toEqual(["crime.road.accidents"]);
    expect(parseCrimeHash("#sel=crime.road.killed,crime.road.injured", "road-accidents", facts).selectedIds).toEqual(["crime.road.injured", "crime.road.killed"]);
  });

  test("tab names the measure and an unknown one is count", () => {
    expect(parseCrimeHash("#tab=per100k", "recorded", facts).measure).toBe("per100k");
    expect(parseCrimeHash("#tab=xyz", "recorded", facts).measure).toBe("count");
    expect(parseCrimeHash("", "recorded", facts)).toEqual(defaultCrimeState("recorded"));
  });

  test("an explicit empty selection stays empty and round-trips", () => {
    const parsed = parseCrimeHash("#tab=per100k&sel=", "recorded", facts);
    expect(parsed.selectedIds).toEqual([]);
    expect(parsed.measure).toBe("per100k");
    expect(parseCrimeHash(`#${serializeCrimeHash(parsed)}`, "recorded", facts)).toEqual(parsed);
  });

  test("a selection naming nothing in the section falls back to the default", () => {
    expect(parseCrimeHash("#sel=crime.prison.total", "recorded", facts).selectedIds).toEqual(["crime.recorded.total"]);
  });

  test("the serialised hash always carries the measure and round-trips the years", () => {
    const original = state("recorded", ["crime.recorded.total", "crime.recorded.life"], "count", { kind: "manual", start: 2017, end: 2022 });
    const hash = serializeCrimeHash(original);
    expect(new URLSearchParams(hash).get("tab")).toBe("count");
    expect(parseCrimeHash(`#${hash}`, "recorded", facts)).toEqual(original);
  });

  test("changing the measure keeps the selection, range and mode", () => {
    const before = { ...state("recorded", ["crime.recorded.life"], "count", { kind: "manual", start: 2017, end: 2022 }), mode: "table" as const };
    expect(changeCrimeMeasure(before, "per100k")).toEqual({ ...before, measure: "per100k" });
  });
});

describe("colour", () => {
  test("the reference is drawn in ink, others keep a stable colour", () => {
    expect(crimeSeriesColor({ id: "crime.recorded.total", reference: true }, 0)).toBe(INK);
    expect(crimeSeriesColor({ id: "crime.recorded.life", reference: false }, 1)).not.toBe(INK);
  });
});
