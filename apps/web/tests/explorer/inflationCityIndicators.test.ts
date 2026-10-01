import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { CityFactInput } from "../../lib/data/inflation/types";
import { buildCityIndex } from "../../lib/explorer/inflationCities";
import { latestCityCategoryIndicators, latestCityIndicators } from "../../lib/explorer/inflationCityIndicators";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const index = buildCityIndex(fixtureCityFacts);

describe("latestCityIndicators", () => {
  it("names the highest and lowest city against Georgia for the total", () => {
    const latest = latestCityIndicators(index)!;
    expect(latest.period).toBe(makePeriod(2026, 8));
    expect(latest.highest.cityIds).toEqual(["city.batumi"]);
    expect(latest.lowest.cityIds).toEqual(["city.telavi"]);
    expect(latest.lowest.fell).toBe(false);
    expect(latest.aboveNational).toMatchObject({ count: 2, total: 6 });
  });

  it("argues differences from the printed one-decimal figures", () => {
    // 7.0857 - 5.6479 = 1.4378 would print 1.4 beside 7.1% and 5.6%; the reader checks 7.1 - 5.6.
    const latest = latestCityIndicators(index)!;
    expect(latest.highest.deltaPp).toBe(1.5);
    expect(latest.lowest.deltaPp).toBe(-1.2);
    expect(latest.gap.value).toBe(2.7);
  });

  it("says prices fell only when the printed rate is negative", () => {
    const withTelavi = (value: number) =>
      buildCityIndex(fixtureCityFacts.map((fact) => (fact.lineId === "city.telavi" && fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2026-08" ? { ...fact, value } : fact)));
    expect(latestCityIndicators(withTelavi(-0.3))!.lowest.fell).toBe(true);
    expect(latestCityIndicators(withTelavi(-0.03))!.lowest.fell).toBe(false);
  });

  it("never ranks Georgia", () => {
    const latest = latestCityIndicators(index)!;
    expect([...latest.highest.cityIds, ...latest.lowest.cityIds]).not.toContain("country.georgia");
  });

  it("names every tied city", () => {
    // Set exactly, not by arithmetic: 5.3103 + 1.7754 need not equal 7.0857 in floating point.
    const tied = buildCityIndex(fixtureCityFacts.map((fact) => (fact.lineId === "city.gori" && fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2026-08" ? { ...fact, value: 7.0857 } : fact)));
    expect(latestCityIndicators(tied)!.highest.cityIds).toEqual(["city.batumi", "city.gori"]);
  });
});

// Batumi in August 2026 with four divisions, and Georgia's rates for the same month.
const AUGUST = "2026-08";
const batumi = (seriesId: string, value: number): CityFactInput => ({ lineId: "city.batumi", seriesId, measure: "yoy_pct", period: AUGUST, value });
const georgia = (seriesId: string, value: number): CityFactInput => ({ lineId: "country.georgia", seriesId, measure: "yoy_pct", period: AUGUST, value });
const cityFacts: CityFactInput[] = [
  batumi("cpi.headline", 7.0857),
  batumi("cpi.cat.01", 9.46),
  batumi("cpi.cat.02", 3.04),
  batumi("cpi.cat.05", -0.38),
  batumi("cpi.cat.07", 1.2),
  georgia("cpi.headline", 5.6479),
  georgia("cpi.cat.01", 8.04),
  georgia("cpi.cat.05", -1.02),
];

describe("latestCityCategoryIndicators", () => {
  const latest = latestCityCategoryIndicators(buildCityIndex(cityFacts), "city.batumi")!;

  it("reports the city's total against Georgia from the printed figures", () => {
    expect(latest.period).toBe(makePeriod(2026, 8));
    expect(latest.total).toMatchObject({ value: 7.0857, national: 5.6479, deltaPp: 1.5 });
  });

  it("names the fastest and slowest division with their distance from Georgia's same division", () => {
    expect(latest.fastest).toMatchObject({ categoryId: "cpi.cat.01", value: 9.46, deltaPp: 1.5 });
    expect(latest.slowest).toMatchObject({ categoryId: "cpi.cat.05", deltaPp: 0.6, fell: true });
  });

  it("leaves the distance empty when Georgia has no figure for that division", () => {
    const withoutGeorgia = latestCityCategoryIndicators(buildCityIndex(cityFacts.filter((fact) => fact.seriesId !== "cpi.cat.01" || fact.lineId !== "country.georgia")), "city.batumi")!;
    expect(withoutGeorgia.fastest.deltaPp).toBeNull();
  });

  it("counts divisions whose printed rate is above zero", () => {
    expect(latest.breadth).toMatchObject({ rose: 3, total: 4 });
  });

  it("says prices fell only when the printed rate is negative", () => {
    const nearZero = latestCityCategoryIndicators(buildCityIndex(cityFacts.map((fact) => (fact.seriesId === "cpi.cat.05" && fact.lineId === "city.batumi" ? { ...fact, value: -0.03 } : fact))), "city.batumi")!;
    expect(nearZero.slowest.fell).toBe(false);
    expect(nearZero.breadth.rose).toBe(3);
  });

  it("breaks ties by COICOP order, as the Categories page does", () => {
    const tied = latestCityCategoryIndicators(buildCityIndex([...cityFacts.filter((fact) => fact.seriesId !== "cpi.cat.02"), batumi("cpi.cat.02", 9.46)]), "city.batumi")!;
    expect(tied.fastest.categoryId).toBe("cpi.cat.01");
  });

  it("returns null for a city with no divisions", () => {
    expect(latestCityCategoryIndicators(buildCityIndex(cityFacts), "city.gori")).toBeNull();
  });
});
