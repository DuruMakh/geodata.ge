import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { projectNationalObservation } from "../../lib/explorer/clientData";
import { AGE_GROUPS, ageCurves, NATIONAL_SERIES, nationalYears, seriesByYear } from "../../lib/explorer/demographyNational";
import { buildFertilityWorkbookExportModel, buildLifeWorkbookExportModel } from "../../lib/explorer/demographyNationalWorkbook";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { ClientNationalFact } from "../../lib/servedRows";

let facts: ClientNationalFact[];
beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => NATIONAL_SERIES.includes(fact.seriesId)).map(projectNationalObservation);
});

describe("national series", () => {
  it("hold only the five national series, 2014–2025, without provenance", () => {
    expect(facts).toHaveLength(12 * 4 + 84);
    expect(Object.keys(facts[0]!).sort()).toEqual(["ageGroup", "seriesId", "value", "year"]);
    expect(nationalYears(facts)).toEqual([2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it("read the total fertility rate and life expectancy", () => {
    expect(seriesByYear(facts, SERIES.totalFertilityRate)[2014]).toBe(2.31);
    expect(seriesByYear(facts, SERIES.totalFertilityRate)[2025]).toBe(1.53);
    expect(seriesByYear(facts, SERIES.lifeExpectancyTotal)[2025]).toBe(76);
    expect(seriesByYear(facts, SERIES.lifeExpectancyMale)[2025]).toBe(71.4);
    expect(seriesByYear(facts, SERIES.lifeExpectancyFemale)[2025]).toBe(80.6);
  });

  it("build one age curve per year in the published group order", () => {
    const curves = ageCurves(facts);
    expect(curves.years).toHaveLength(12);
    expect(AGE_GROUPS.map((group) => curves.byYear[2014]![group]).slice(0, 3)).toEqual([51.5, 144.7, 131.3]);
    expect(AGE_GROUPS.map((group) => curves.byYear[2025]![group]).slice(0, 3)).toEqual([12.4, 62.4, 95.9]);
  });
});

describe("national workbooks", () => {
  it("fertility: the total rate and the seven age rows, by year", async () => {
    const presentation = await getPresentation("en", ["demography", "workbook"], []);
    const model = buildFertilityWorkbookExportModel({ facts, sources: [], siteOrigin: "https://fiscal.ge" }, presentation);
    expect(model.filename).toContain("demography-fertility-2014-2025");
    expect(model.readable.rows).toHaveLength(8);
    expect(model.readable.rows[0]!.label).toBe("Total fertility rate (children per woman)");
    expect(model.readable.rows[1]!.label).toBe("Under 20 (births per 1,000 women)");
    expect(model.analysis.rows).toHaveLength(12 * 8);
    expect(model.readable.numberFormat).toBe("0.0#");
    expect(model.analysis.numericFormats?.[3]).toBe("0.0#");
  });

  it("life expectancy: three rows by year", async () => {
    const presentation = await getPresentation("en", ["demography", "workbook"], []);
    const model = buildLifeWorkbookExportModel({ facts, sources: [], siteOrigin: "https://fiscal.ge" }, presentation);
    expect(model.readable.rows.map((row) => row.label)).toEqual(["Total", "Men", "Women"]);
    expect(model.readable.rows[0]!.valuesByYear[2025]).toBe(76);
    expect(model.analysis.rows).toHaveLength(36);
  });
});
