import { describe, expect, it } from "vitest";
import { DATASETS, isTopicDatasetId, keywordsFor, measurementTechniqueFor, sourceAgenciesFor } from "../../lib/seo/datasetVocabulary";
import {
  debtMeasure,
  deficitMeasure,
  municipalMeasure,
  nationalMeasure,
} from "../../lib/factQuery/schemas";

// schemas.ts warns that a second hand-maintained copy of the measure lists
// silently drifts from what the query functions accept. The SEO vocabulary is
// such a copy, so this locks the two together rather than trusting a comment.
describe("SEO dataset measures match the measures the query layer serves", () => {
  it.each([
    ["national-expenditure", nationalMeasure],
    ["national-revenue", nationalMeasure],
    ["municipal-expenditure", municipalMeasure],
    ["government-debt", debtMeasure],
    ["general-government-balance", deficitMeasure],
  ] as const)("%s", (datasetId, enumeration) => {
    expect([...DATASETS[datasetId].measures]).toEqual([...enumeration.options]);
  });
});

describe("isTopicDatasetId", () => {
  it("knows only the topic datasets' own ids, never an object's inherited keys", () => {
    expect(isTopicDatasetId("inflation")).toBe(true);
    expect(["toString", "constructor", "__proto__", "hasOwnProperty"].filter(isTopicDatasetId)).toEqual([]);
  });
});

describe("demography Dataset vocabulary", () => {
  const georgian = /[\u10A0-\u10FF]/;

  it("carries the English keywords, technique and Geostat as the only source", () => {
    expect(isTopicDatasetId("demography")).toBe(true);
    expect(keywordsFor("demography", "en")).toEqual(["Georgia", "population", "demography", "migration", "births", "deaths", "marriages"]);
    expect(measurementTechniqueFor("demography", "en")).toBe(
      "Geostat's 1 January population estimates, the 2024 census and registered births, deaths, marriages, divorces and border crossings.",
    );
    expect(sourceAgenciesFor("demography", "en").map((a) => a.url)).toEqual(["https://www.geostat.ge"]);
  });

  it("keeps Georgian in the ka strings and none in the en strings", () => {
    const ka = [...keywordsFor("demography", "ka"), measurementTechniqueFor("demography", "ka"), ...sourceAgenciesFor("demography", "ka").map((a) => a.name)];
    const en = [...keywordsFor("demography", "en"), measurementTechniqueFor("demography", "en"), ...sourceAgenciesFor("demography", "en").map((a) => a.name)];
    expect(ka.every((text) => georgian.test(text))).toBe(true);
    expect(en.some((text) => georgian.test(text))).toBe(false);
  });
});
