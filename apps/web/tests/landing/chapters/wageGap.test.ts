import { beforeAll, describe, expect, it } from "vitest";
import { loadServedWagesData } from "../../../lib/data/wages/importWages";
import type { WagesFact } from "../../../lib/data/wages/types";
import type { Presentation } from "../../../lib/i18n/types";
import { buildWageGapChapter } from "../../../lib/landing/chapters/wageGap";
import type { WageGapChapter } from "../../../lib/landing/chapters/types";

const presentation: Presentation = { locale: "ka", englishLabels: {}, messages: {} };

let facts: WagesFact[];
let chapter: WageGapChapter;

beforeAll(async () => {
  facts = (await loadServedWagesData()).facts;
  chapter = buildWageGapChapter(facts, presentation);
}, 60_000);

const fact = (
  indicatorId: WagesFact["indicatorId"],
  dimension: WagesFact["dimension"],
  groupId: string,
  sectorId: WagesFact["sectorId"],
  year: number,
  value: number | null,
): WagesFact => ({
  year,
  indicatorId,
  dimension,
  groupId,
  sectorId,
  value: value === null ? null : String(value),
  publishedValue: value === null ? null : String(value),
  unit: "gel",
  basis: "actual",
  valueStatus: value === null ? "unavailable" : "survey_estimate",
  sourceId: "geostat_earnings_annual_headline",
  sourceSheet: "1",
  sourceCell: "A1",
  sourceNumberFormat: "0.0",
  lastReviewedAt: "2026-10-01",
});

const average = "average_monthly_nominal_earnings" as const;
const median = (year: number, value: number) => fact("median_monthly_earnings", "national", "georgia", "total", year, value);

/** A year with every row the chapter needs: national, both sexes, both ownerships, and sector.a and sector.b. */
function fullYear(year: number, womenSectorB: number | null = 800): WagesFact[] {
  return [
    fact(average, "national", "georgia", "total", year, 1000),
    fact(average, "sex", "women", "total", year, 800),
    fact(average, "sex", "men", "total", year, 1200),
    fact(average, "ownership", "public", "total", year, 900),
    fact(average, "ownership", "non_public", "total", year, 1100),
    fact(average, "national", "georgia", "sector.a", year, 500),
    fact(average, "sex", "women", "sector.a", year, 400),
    fact(average, "sex", "men", "sector.a", year, 600),
    fact(average, "national", "georgia", "sector.b", year, 2000),
    fact(average, "sex", "women", "sector.b", year, womenSectorB),
    fact(average, "sex", "men", "sector.b", year, 2500),
  ];
}

describe("buildWageGapChapter", () => {
  it("latest year 2025: average, women, men and the ratio", () => {
    expect(chapter.year).toBe(2025);
    expect(chapter.average).toBeCloseTo(2165.2, 1);
    expect(chapter.women).toBeCloseTo(1743.4, 1);
    expect(chapter.men).toBeCloseTo(2586.5, 1);
    expect(chapter.ratio).toBeCloseTo(0.674, 3);
    expect(chapter.ratio).toBeCloseTo(chapter.women / chapter.men, 10);
  });

  it("median 1531 (2025), public sector and non-public averages", () => {
    expect(chapter.median.year).toBe(2025);
    expect(chapter.median.value).toBeCloseTo(1531, 0);
    expect(chapter.publicSector).toBeCloseTo(1895, 0);
    expect(chapter.nonPublic).toBeCloseTo(2301, 0);
  });

  it("history starts at the first national average year (13.5 in 1995) and ends at the latest", () => {
    expect(chapter.history.years[0]).toBe(1995);
    expect(chapter.history.values[0]).toBeCloseTo(13.5, 1);
    expect(chapter.history.years.at(-1)).toBe(2025);
    expect(chapter.history.values.at(-1)).toBeCloseTo(chapter.average, 10);
    expect(chapter.history.values).toHaveLength(chapter.history.years.length);
    for (let i = 1; i < chapter.history.years.length; i++) expect(chapter.history.years[i]).toBeGreaterThan(chapter.history.years[i - 1]!);
  });

  it("19 sector rows sorted by average desc; sector.k women 3111.6, men 6164.3", () => {
    expect(chapter.sectors).toHaveLength(19);
    for (let i = 1; i < chapter.sectors.length; i++) expect(chapter.sectors[i - 1]!.average).toBeGreaterThanOrEqual(chapter.sectors[i]!.average);
    const k = chapter.sectors.find((sector) => sector.id === "sector.k")!;
    expect(k.women).toBeCloseTo(3111.6, 1);
    expect(k.men).toBeCloseTo(6164.3, 1);
    expect(chapter.sectors.every((sector) => sector.label.trim().length > 0)).toBe(true);
  });

  it("a sector missing women or men is dropped", () => {
    const built = buildWageGapChapter([...fullYear(2025, null), ...fullYear(2024), median(2025, 700)], presentation);
    expect(built.sectors.map((sector) => sector.id)).toEqual(["sector.a"]);
  });

  it("median takes its own latest year when the average year has none", () => {
    const rows = [...fullYear(2025), median(2024, 700)];
    expect(buildWageGapChapter(rows, presentation).median).toEqual({ year: 2024, value: 700 });
  });

  it("the year is the latest with a national average; later partial years do not count", () => {
    const rows = [...fullYear(2024), median(2024, 700), fact(average, "national", "georgia", "total", 2025, 1100)];
    expect(() => buildWageGapChapter(rows, presentation)).toThrow(/Wage gap chapter: no data for women 2025/);
  });

  it("throws a clear message when the median or the sectors are missing", () => {
    expect(() => buildWageGapChapter(fullYear(2025), presentation)).toThrow(/Wage gap chapter: no data for median earnings/);
    const noSectors = fullYear(2025).filter((row) => row.sectorId === "total");
    expect(() => buildWageGapChapter([...noSectors, median(2025, 700)], presentation)).toThrow(/Wage gap chapter: no data for sector averages 2025/);
  });
});
