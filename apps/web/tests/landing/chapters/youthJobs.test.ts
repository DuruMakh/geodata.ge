import { beforeAll, describe, expect, it } from "vitest";
import { loadServedUnemploymentData } from "../../../lib/data/unemployment/importUnemployment";
import type { ServedUnemploymentObservation } from "../../../lib/data/unemployment/types";
import type { Presentation } from "../../../lib/i18n/types";
import { buildYouthJobsChapter, comparisonFor, per100 } from "../../../lib/landing/chapters/youthJobs";
import type { YouthJobsChapter } from "../../../lib/landing/chapters/types";

const presentation: Presentation = { locale: "ka", englishLabels: {}, messages: {} };

let facts: ServedUnemploymentObservation[];
let chapter: YouthJobsChapter;

beforeAll(async () => {
  facts = (await loadServedUnemploymentData()).facts;
  chapter = buildYouthJobsChapter(facts, presentation);
}, 60_000);

const fact = (dimension: ServedUnemploymentObservation["dimension"], groupId: string, indicatorId: ServedUnemploymentObservation["indicatorId"], year: number, value: number): ServedUnemploymentObservation => ({
  year,
  frequency: "annual",
  dimension,
  groupId,
  groupLabelEn: groupId,
  sex: "total",
  indicatorId,
  unit: indicatorId.endsWith("_rate") ? "percent" : "thousand_persons",
  value,
  publishedValue: value,
  basis: "actual",
  valueStatus: "survey_estimate",
  methodologyEpoch: "ilo19_20",
  role: "primary",
  sourceId: "source.test",
  sourceSheet: "1",
  sourceCell: "A1",
  sourceGroupLabel: groupId,
  sourceLabel: indicatorId,
  sourceNumberFormat: "0.0",
  lastReviewedAt: "2026-10-01",
});

function labour(dimension: ServedUnemploymentObservation["dimension"], groupId: string, year: number, employed: number, unemployed: number, outside: number) {
  return [fact(dimension, groupId, "employed", year, employed), fact(dimension, groupId, "unemployed", year, unemployed), fact(dimension, groupId, "outside_labour_force", year, outside)];
}

const youthGroups = (year: number) => ["age.15_19", "age.20_24", "age.25_29"].flatMap((id) => labour("age", id, year, 10, 5, 20));

describe("buildYouthJobsChapter", () => {
  it("all ages 15+, 2025", () => {
    expect(chapter.year).toBe(2025);
    expect(chapter.all.employed).toBeCloseTo(1389.7, 1);
    expect(chapter.all.unemployed).toBeCloseTo(224.0, 1);
    expect(chapter.all.outside).toBeCloseTo(1349.4, 1);
    expect(chapter.all.rate).toBeCloseTo(13.9, 1);
    expect(chapter.all.per100).toEqual([47, 8, 45]);
  });

  it("youth 15–29 sums three age groups", () => {
    expect(chapter.youth.employed).toBeCloseTo(195.1, 1);
    expect(chapter.youth.unemployed).toBeCloseTo(66.4, 1);
    expect(chapter.youth.outside).toBeCloseTo(298.4, 1);
    expect(chapter.youth.rate).toBeCloseTo(25.38, 1);
    expect(chapter.youth.per100).toEqual([35, 12, 53]);
    expect(chapter.ratio).toBeCloseTo(chapter.youth.rate / chapter.all.rate, 10);
    expect(chapter.comparison).toBe("almostTwice");
  });

  it("regions are the latest year's rates, highest first", () => {
    expect(chapter.regions).toHaveLength(11);
    expect(chapter.regions[0]!.id).toBe("region.tbilisi");
    expect(chapter.regions[0]!.rate).toBeCloseTo(17.5, 1);
    expect(chapter.regions[10]!.id).toBe("region.samtskhe_javakheti");
    expect(chapter.regions[10]!.rate).toBeCloseTo(7.0, 1);
    expect(chapter.regions.every((region) => region.label.trim().length > 0)).toBe(true);
    for (let i = 1; i < chapter.regions.length; i++) expect(chapter.regions[i - 1]!.rate).toBeGreaterThanOrEqual(chapter.regions[i]!.rate);
  });

  it("year falls back to the latest year with the national row and all three youth groups", () => {
    const rows = [
      ...labour("national", "georgia", 2025, 100, 20, 80),
      ...youthGroups(2025),
      fact("region", "region.tbilisi", "unemployment_rate", 2025, 17.5),
      ...labour("national", "georgia", 2026, 100, 20, 80),
    ];
    expect(buildYouthJobsChapter(rows, presentation).year).toBe(2025);
  });

  it("throws a clear message when no year has the national row and the youth groups", () => {
    expect(() => buildYouthJobsChapter(labour("national", "georgia", 2025, 100, 20, 80), presentation)).toThrow(/Youth jobs chapter/);
  });
});

describe("comparisonFor", () => {
  it("maps a ratio to the comparison word", () => {
    expect(comparisonFor(1.0)).toBe("notHigher");
    expect(comparisonFor(0.8)).toBe("notHigher");
    expect(comparisonFor(1.1)).toBe("littleHigher");
    expect(comparisonFor(1.5)).toBe("oneAndHalf");
    expect(comparisonFor(1.83)).toBe("almostTwice");
    expect(comparisonFor(2.0)).toBe("twice");
    expect(comparisonFor(2.3)).toBe("moreThanTwice");
  });

  it("applies the boundaries", () => {
    expect(comparisonFor(1.2)).toBe("oneAndHalf");
    expect(comparisonFor(1.75)).toBe("almostTwice");
    expect(comparisonFor(1.95)).toBe("twice");
    expect(comparisonFor(2.05)).toBe("twice");
  });
});

describe("per100", () => {
  it("always sums to 100, largest remainder first", () => {
    expect(per100([1, 1, 1])).toEqual([34, 33, 33]);
    for (const values of [[47.4, 8.1, 44.5], [1, 2, 3], [0.1, 0.1, 99.8], [5, 5, 5, 5, 5, 5, 5]]) {
      expect(per100(values).reduce((sum, n) => sum + n, 0)).toBe(100);
    }
  });
});
