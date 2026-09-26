import { describe, expect, it } from "vitest";
import { makePeriod, periodKey } from "../../../lib/data/inflation/periods";
import { CITY_SERIES_IDS, CPI_CITY_IDS, type CpiCityFact } from "../../../lib/data/inflation/types";
import {
  assertImpliedCityWeights,
  assertNoCityRevisions,
  chainIndex,
  cityConsistencyError,
  fitImpliedCityWeights,
  validateCityFacts,
} from "../../../lib/data/inflation/validateInflation";

const LATE: Record<string, string> = { "city.zugdidi:yoy_pct": "2016-12", "city.zugdidi:avg12_pct": "2017-12" };
const months = (from: string, to: string) => {
  const out: string[] = [];
  for (let p = makePeriod(+from.slice(0, 4), +from.slice(5)); p <= makePeriod(+to.slice(0, 4), +to.slice(5)); p += 1) out.push(periodKey(p));
  return out;
};

/** A complete, valid city fact set for 2016-01 … 2017-12. */
function validFacts(): CpiCityFact[] {
  const facts: CpiCityFact[] = [];
  for (const cityId of CPI_CITY_IDS) {
    for (const measure of ["yoy_pct", "mom_pct", "avg12_pct"] as const) {
      const series = measure === "avg12_pct" ? ["cpi.headline"] : CITY_SERIES_IDS;
      for (const seriesId of series) {
        for (const period of months(LATE[`${cityId}:${measure}`] ?? "2016-01", "2017-12")) {
          facts.push({ cityId, seriesId, measure, period, value: "1.5", status: "published", sourceId: "source.geostat_cpi_yoy", sourceLocator: "Tbilisi!D7", lastReviewedAt: "2026-09-11" });
        }
      }
    }
  }
  return facts;
}

describe("validateCityFacts", () => {
  it("accepts the full set and reports Zugdidi's late starts", () => {
    const result = validateCityFacts(validFacts());
    expect(result.lastPeriod).toBe("2017-12");
    expect(result.firstPeriods["city.zugdidi:cpi.headline:yoy_pct"]).toBe("2016-12");
    expect(result.firstPeriods["city.tbilisi:cpi.headline:yoy_pct"]).toBe("2016-01");
  });

  it("rejects a month before the city window", () => {
    expect(() => validateCityFacts([...validFacts(), { ...validFacts()[0]!, period: "2015-12" }])).toThrow(/before 2016-01/);
  });

  it("rejects a gap after a series starts", () => {
    const facts = validFacts().filter((fact) => !(fact.cityId === "city.gori" && fact.seriesId === "cpi.cat.03" && fact.measure === "mom_pct" && fact.period === "2016-06"));
    expect(() => validateCityFacts(facts)).toThrow(/gap/);
  });

  it("rejects an unexpected late start", () => {
    const facts = validFacts().filter((fact) => !(fact.cityId === "city.batumi" && fact.measure === "yoy_pct" && fact.period === "2016-01"));
    expect(() => validateCityFacts(facts)).toThrow(/starts 2016-02/);
  });

  it("rejects a 12-month average for a category", () => {
    expect(() => validateCityFacts([...validFacts(), { ...validFacts()[0]!, seriesId: "cpi.cat.01", measure: "avg12_pct" }])).toThrow(/does not publish/);
  });

  it("rejects a missing division", () => {
    expect(() => validateCityFacts(validFacts().filter((fact) => fact.seriesId !== "cpi.cat.12" || fact.cityId !== "city.telavi"))).toThrow(/cpi.cat.12/);
  });
});

describe("assertNoCityRevisions", () => {
  it("stops on a changed published value", () => {
    const previous = validFacts();
    const next = previous.map((fact, index) => (index === 0 ? { ...fact, value: "9.9" } : fact));
    expect(() => assertNoCityRevisions(previous, next)).toThrow(/revised/);
  });
});

// Hand-built series: three cities, known weights, one calendar year.
const MOM: Record<string, number[]> = {
  a: [0.4, -0.2, 1.1, 0.3, 0.0, 0.7, -0.5, 0.9, 0.2, 0.6, -0.1, 0.8],
  b: [1.2, 0.5, -0.3, 0.1, 0.9, -0.4, 0.3, 0.2, 1.0, -0.2, 0.4, 0.0],
  c: [-0.6, 0.8, 0.2, 1.4, -0.3, 0.1, 0.6, -0.2, 0.3, 0.9, 0.5, -0.4],
};
const WEIGHTS: Record<string, number> = { a: 0.5, b: 0.3, c: 0.2 };
function series() {
  const cityMom = new Map(Object.entries(MOM).map(([id, values]) => [id, new Map(values.map((value, i) => [makePeriod(2016, i + 1), value]))]));
  const levels = new Map([...cityMom].map(([id, mom]) => [id, chainIndex(mom)]));
  const nationalLevel = (period: number) => Object.entries(WEIGHTS).reduce((sum, [id, weight]) => sum + weight * levels.get(id)!.get(period)!, 0);
  const nationalMom = new Map(Array.from({ length: 12 }, (_, i) => {
    const period = makePeriod(2016, i + 1);
    return [period, (nationalLevel(period) / nationalLevel(period - 1) - 1) * 100] as const;
  }));
  return { cityMom, nationalMom };
}

describe("fitImpliedCityWeights", () => {
  it("recovers the weights a national index was built from", () => {
    const { cityMom, nationalMom } = series();
    const fit = fitImpliedCityWeights(nationalMom, cityMom, 2016);
    expect(fit.years).toHaveLength(1);
    for (const [id, weight] of Object.entries(WEIGHTS)) expect(fit.years[0]!.weights[id]).toBeCloseTo(weight, 9);
    expect(fit.years[0]!.maxResidualPp).toBeLessThan(1e-9);
    expect(() => assertImpliedCityWeights(fit)).not.toThrow();
  });

  it("fails when the national index is not a weighted mean of the cities", () => {
    const { cityMom, nationalMom } = series();
    nationalMom.set(makePeriod(2016, 6), nationalMom.get(makePeriod(2016, 6))! + 0.05);
    expect(() => assertImpliedCityWeights(fitImpliedCityWeights(nationalMom, cityMom, 2016))).toThrow(/residual/);
  });

  it("skips a year with too few months to determine the weights", () => {
    const { cityMom, nationalMom } = series();
    for (const map of [nationalMom, ...cityMom.values()]) for (const month of [4, 5, 6, 7, 8, 9, 10, 11, 12]) map.delete(makePeriod(2016, month));
    const fit = fitImpliedCityWeights(nationalMom, cityMom, 2016);
    expect(fit.years).toHaveLength(0);
    expect(fit.skippedYears).toEqual([2016]);
    expect(() => assertImpliedCityWeights(fit)).toThrow(/no year/);
  });
});

describe("cityConsistencyError", () => {
  it("agrees with a y/y and 12-month average derived from the same chain", () => {
    const mom = new Map(Array.from({ length: 36 }, (_, i) => [makePeriod(2016, 1) + i, 0.3 + (i % 5) * 0.1] as const));
    const index = chainIndex(mom);
    const yoy = new Map([...mom.keys()].filter((p) => index.has(p - 12)).map((p) => [p, (index.get(p)! / index.get(p - 12)! - 1) * 100] as const));
    const result = cityConsistencyError({ yoy, mom, avg12: new Map() });
    expect(result.comparisons).toBeGreaterThan(20);
    expect(result.maxPp).toBeLessThan(1e-9);
    yoy.set([...yoy.keys()][3]!, yoy.get([...yoy.keys()][3]!)! + 0.5);
    expect(cityConsistencyError({ yoy, mom, avg12: new Map() }).maxPp).toBeGreaterThan(0.4);
  });
});
