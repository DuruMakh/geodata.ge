import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCpiFacts } from "../../../lib/data/inflation/importInflation";
import { prepareInflationCities, serializeCityFacts } from "../../../lib/data/inflation/prepareInflation";
import { INFLATION_RAW_ROOT, latestCpiVintage, readVerifiedCpiFiles } from "../../../lib/data/inflation/sourceFiles";
import { IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP } from "../../../lib/data/inflation/validateInflation";

// The same verified buffers serve every call, so the reader's book cache parses
// each of the six workbooks once for the whole file (a parse costs ~3 s).
const files = latestCpiVintage().then((vintage) => readVerifiedCpiFiles(path.join(INFLATION_RAW_ROOT, "geostat-cpi", vintage)));
const prepared = files.then((shared) => prepareInflationCities({ previousFacts: null, files: shared }));

describe("prepareInflationCities", () => {
  it("extracts six cities from 2016 in three measures", async () => {
    const { facts, validation } = await prepared;
    expect(validation.cityCount).toBe(6);
    expect(facts).toHaveLength(20570);
    expect(facts.every((fact) => fact.period >= "2016-01")).toBe(true);
    expect(facts.filter((fact) => fact.measure === "avg12_pct").every((fact) => fact.seriesId === "cpi.headline")).toBe(true);
    expect(validation.firstPeriods["city.zugdidi:cpi.headline:yoy_pct"]).toBe("2016-12");
    expect(validation.firstPeriods["city.zugdidi:cpi.headline:avg12_pct"]).toBe("2017-12");
  });

  it("keeps the published value and a sheet locator", async () => {
    const { facts } = await prepared;
    const batumi = facts.find((fact) => fact.cityId === "city.batumi" && fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2026-08")!;
    expect(batumi.value).toBe("7.0857");
    expect(batumi.sourceId).toBe("source.geostat_cpi_yoy");
    expect(batumi.sourceLocator).toMatch(/^Batumi!/);
  });

  it("proves the cities add up to the national index, within the limit, every year", async () => {
    const { validation } = await prepared;
    expect(validation.impliedWeights.map((entry) => entry.year)[0]).toBe(2016);
    for (const entry of validation.impliedWeights) expect(entry.maxResidualPp).toBeLessThan(IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP);
    const latest = validation.impliedWeights.at(-1)!;
    expect(latest.weights["city.tbilisi"]).toBeGreaterThan(0.5);
    expect(validation.maxConsistencyErrorPp).toBeLessThan(0.001);
  });

  it("stops on a revised published value", async () => {
    const { facts } = await prepared;
    const previous = facts.map((fact, index) => (index === 0 ? { ...fact, value: "99" } : fact));
    await expect(prepareInflationCities({ previousFacts: previous, files: await files })).rejects.toThrow(/revised/);
  });

  it("stops when the national sheet disagrees with the headline being written", async () => {
    const headline = await loadCpiFacts();
    const tampered = headline.map((fact) => (fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2020-01" ? { ...fact, value: "1" } : fact));
    await expect(prepareInflationCities({ previousFacts: null, headlineFacts: tampered, files: await files })).rejects.toThrow(/national sheet/);
  });

  it("serializes with a BOM and the documented header", async () => {
    const text = serializeCityFacts((await prepared).facts.slice(0, 1));
    expect(text.startsWith("﻿city_id,series_id,measure,period,value,status,source_id,source_locator,last_reviewed_at\n")).toBe(true);
  });
});
