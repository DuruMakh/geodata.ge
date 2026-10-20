import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import {
  buildMarriageIndexModel,
  buildMarriageModel,
  changeMarriageSelection,
  MARRIAGE_DEFAULT_SELECTION,
  MARRIAGE_SERIES,
  marriageFactsForPlace,
  parseMarriageHash,
  perThousand,
  serializeMarriageHash,
  type MarriageIndexModel,
  type MarriagePlaceFacts,
  type MarriageState,
} from "../../lib/explorer/demographyMarriage";

let facts: Awaited<ReturnType<typeof loadServedDemographyData>>["facts"];
let georgia: MarriagePlaceFacts;
let index: MarriageIndexModel;
beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  georgia = marriageFactsForPlace(facts, "country.georgia", MARRIAGE_SERIES.map((series) => series.id));
  index = buildMarriageIndexModel({ facts, regions: municipal.regions, municipalities: municipal.municipalities });
});

const state = (overrides: Partial<MarriageState> = {}): MarriageState => ({
  mode: "line",
  range: { kind: "all" },
  measure: "count",
  selectedIds: [...MARRIAGE_DEFAULT_SELECTION],
  ...overrides,
});

describe("marriages and divorces page model", () => {
  it("lists the counts, the ages and the length under their headings", () => {
    expect(MARRIAGE_SERIES.map((series) => series.id)).toEqual([
      "marriages",
      "divorces",
      "age_marriage_male",
      "age_marriage_female",
      "age_first_marriage_male",
      "age_first_marriage_female",
      "age_divorce_male",
      "age_divorce_female",
      "duration",
    ]);
    expect(MARRIAGE_SERIES.map((series) => series.heading)).toEqual(["number", "number", "ageMarriage", "ageMarriage", "ageMarriage", "ageMarriage", "ageDivorce", "ageDivorce", "duration"]);
  });

  it("gives Georgia's 2025 marriages and divorces per 1,000 residents as Geostat rounds them", () => {
    const model = buildMarriageModel(georgia, state({ measure: "per1000" }));
    const value = (id: string) => model.series.find((series) => series.id === id)!.valuesByYear[2025]!;

    expect(Number(value("marriages").toFixed(1))).toBe(5.7);
    expect(Number(value("divorces").toFixed(1))).toBe(3.3);
    expect(model).toMatchObject({ unitKey: "demography.marriageUnitPer1000", decimals: 1, breaks: [{ year: 2025, label: "newCounting" }] });
    expect(model.years[0]).toBe(1994);
  });

  it("shows counts as published, with no break", () => {
    const model = buildMarriageModel(georgia, state());

    expect(model.series.find((series) => series.id === "marriages")!.valuesByYear[2025]).toBe(22_285);
    expect(model).toMatchObject({ unitKey: "demography.marriageUnitCount", decimals: 0, breaks: [] });
  });

  it("leaves the ages unchanged per 1,000 residents, in years and with no break", () => {
    const ages = state({ measure: "per1000", selectedIds: ["age_first_marriage_male", "age_first_marriage_female"] });
    const model = buildMarriageModel(georgia, ages);

    expect(model.selected.find((series) => series.id === "age_first_marriage_female")!.valuesByYear[2025]).toBe(30.1);
    expect(model).toMatchObject({ unitKey: "demography.marriageUnitYears", decimals: 1, breaks: [] });
  });

  it("divides by the same year's mid-year population, as Geostat's unrounded 2025 rate", () => {
    expect(perThousand(22_285, 3_935_765.5)).toBeCloseTo(5.662176773489173, 10);
  });

  it("ticking an age after the counts keeps only the ages", () => {
    const next = changeMarriageSelection(state(), [...MARRIAGE_DEFAULT_SELECTION, "age_marriage_male"], georgia);
    expect(next.selectedIds).toEqual(["age_marriage_male"]);
  });

  it("reads and writes the hash, with the counts as the default", () => {
    expect(parseMarriageHash("#sel=nope", georgia).selectedIds).toEqual(["marriages", "divorces"]);
    expect(parseMarriageHash("", georgia)).toEqual(state());
    const written = state({ measure: "per1000", mode: "table", selectedIds: ["divorces"] });
    expect(parseMarriageHash(`#${serializeMarriageHash(written)}`, georgia)).toEqual(written);
    expect(parseMarriageHash("#sel=marriages,duration", georgia).selectedIds).toEqual(["marriages"]);
  });

  it("gives a place its two counts from 2009", () => {
    const tbilisi = marriageFactsForPlace(facts, "region.tbilisi");

    expect(new Set(tbilisi.facts.map((fact) => fact.indicatorId))).toEqual(new Set(["marriages", "divorces"]));
    expect(Math.min(...tbilisi.facts.map((fact) => fact.year))).toBe(2009);
    expect(Math.max(...tbilisi.facts.map((fact) => fact.year))).toBe(2025);
    expect(tbilisi.midYear.map((row) => row.year)).toEqual(Array.from({ length: 17 }, (_, i) => 2009 + i));
    expect(buildMarriageModel(tbilisi, state()).series.map((series) => series.id)).toEqual(["marriages", "divorces"]);
  });
});

describe("marriages per 1,000 residents index", () => {
  it("ranks the 64 municipalities and the 11 regions for the latest year, Tbilisi once", () => {
    expect(index.year).toBe(2025);
    expect(index.municipalities).toHaveLength(64);
    expect(index.regions).toHaveLength(11);
    expect(index.municipalities.filter((row) => row.id === "04")).toHaveLength(1);
    expect(index.municipalities.find((row) => row.id === "68")!.valueGel).toBeGreaterThan(9.5);
    expect(Number(index.country.valueGel.toFixed(1))).toBe(5.7);
    expect(index.map.shapes.length).toBeGreaterThan(0);
  });

  it("keeps each place's marriages and divorces", () => {
    expect(index.countsById["country.georgia"]).toEqual({ marriages: 22_285, divorces: 13_173 });
    expect(index.countsById["region.tbilisi"]).toEqual(index.countsById["04"]);
  });
});
