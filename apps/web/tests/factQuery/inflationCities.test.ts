import { describe, expect, it } from "vitest";
import { compare } from "../../lib/factQuery/compare";
import { describeCoverage, type CoverageData } from "../../lib/factQuery/describeCoverage";
import { queryInflation, inflationCellCount } from "../../lib/factQuery/queryInflation";
import { rank } from "../../lib/factQuery/rank";
import { SCHEMA_VERSION, type FactQuerySnapshot } from "../../lib/factQuery/types";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

import { getSources, type GetSourcesData } from "../../lib/factQuery/getSources";
import type { Observation } from "../../lib/factQuery/observations";

const snapshot = loadPackagedSnapshot();
type Obs = { observationId: string; entityType: string; value: number | null; availability: string; missingReasonEn: string | null; caveatIds: string[] };
const observations = (response: ReturnType<typeof queryInflation>) => (response as { data: { observations: Obs[] } }).data.observations;
type CityFact = FactQuerySnapshot["inflation"]["cities"][number];
const cityFact = (cityId: CityFact["cityId"], period: string, overrides: Partial<CityFact> = {}): CityFact => ({
  ...snapshot.inflation.cities.find((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct")!,
  cityId, period, ...overrides,
});
const withCities = (cities: CityFact[]): FactQuerySnapshot => ({ ...snapshot, inflation: { ...snapshot.inflation, cities } });

describe("query_inflation for cities", () => {
  it("answers a city's annual inflation", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" });
    expect(response.status).toBe("ok");
    expect(observations(response)[0]).toMatchObject({ observationId: "inflation:city.batumi:cpi.headline:2026-08:yoy_pct", entityType: "city", value: 7.0857 });
    expect(response).toMatchObject({ data: { observations: [{ value: 7.0857 }], coverage: { availablePeriods: ["2016-01", "2026-09"] } } });
  });

  it("keeps the default answer for Georgia unchanged", () => {
    const response = queryInflation(snapshot, { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" });
    expect(observations(response)[0]!.observationId).toBe("inflation:country.georgia:cpi.headline:2026-08:yoy_pct");
  });

  it("returns Zugdidi's late start as missing, never zero", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.zugdidi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2016-06", toPeriod: "2016-06" });
    expect(response.status).toBe("empty");
    expect(observations(response)[0]).toMatchObject({ value: null, availability: "missing" });
    expect(observations(response)[0]!.missingReasonEn).toMatch(/2016-12/);
    expect(response).toMatchObject({ data: { coverage: { availablePeriods: ["2016-12", "2026-09"] } } });
  });

  it("reports Zugdidi's average coverage while keeping earlier months missing", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.zugdidi"], seriesIds: ["cpi.headline"], measure: "avg12_pct", fromPeriod: "2016-06", toPeriod: "2016-06" });
    expect(response).toMatchObject({ data: { observations: [{ value: null }], coverage: { availablePeriods: ["2017-12", "2026-09"] } } });
    expect(observations(response)[0]!.missingReasonEn).toContain("2017-12");
  });

  it("uses only the selected city, series and measure across full history, without inventing gap years", () => {
    const synthetic = withCities([
      cityFact("city.batumi", "2018-02"), cityFact("city.batumi", "2020-03"),
      cityFact("city.gori", "2016-01"),
      cityFact("city.batumi", "2017-01", { seriesId: "cpi.cat.01" }),
      cityFact("city.batumi", "2026-08", { measure: "mom_pct" }),
    ]);
    const response = queryInflation(synthetic, { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2019-06", toPeriod: "2019-06" });
    expect(response).toMatchObject({ status: "empty", data: { observations: [{ value: null, availability: "missing" }], coverage: { availablePeriods: ["2018-02", "2020-03"], availableYears: [2018, 2020] } } });
    expect(observations(response)[0]!.missingReasonEn).toContain("2018-02");
  });

  it("returns null coverage when the supported city selection has no facts", () => {
    const synthetic = withCities([cityFact("city.gori", "2018-02")]);
    const response = queryInflation(synthetic, { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2019-06", toPeriod: "2019-06" });
    expect(response).toMatchObject({ status: "empty", data: { observations: [{ value: null, availability: "missing" }], coverage: { availablePeriods: null, availableYears: [] } } });
    expect(observations(response)[0]!.missingReasonEn).toContain("2016-01");
  });

  it("unites two cities' observed months and years without filling their gaps", () => {
    const synthetic = withCities([cityFact("city.batumi", "2018-02"), cityFact("city.gori", "2020-03")]);
    const response = queryInflation(synthetic, { entityIds: ["city.batumi", "city.gori"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2018-02", toPeriod: "2018-02" });
    expect(response).toMatchObject({ status: "partial", data: { observations: [{ availability: "available" }, { value: null, availability: "missing" }], coverage: { availablePeriods: ["2018-02", "2020-03"], availableYears: [2018, 2020] } } });
  });

  it("unites selected country and city history while keeping the city missing before publication", () => {
    const synthetic = withCities([cityFact("city.batumi", "2018-02"), cityFact("city.batumi", "2020-03")]);
    const response = queryInflation(synthetic, { entityIds: ["country.georgia", "city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2014-06", toPeriod: "2014-06" });
    const national = snapshot.inflation.facts.find((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2014-06")!;
    expect(response).toMatchObject({ status: "partial", data: { observations: [{ value: national.value }, { value: null, availability: "missing" }], coverage: { availablePeriods: ["2004-01", "2026-09"], availableYears: Array.from({ length: 23 }, (_, index) => 2004 + index) } } });
    expect(observations(response)[1]!.missingReasonEn).toContain("2018-02");
  });

  it("includes only the selected national category in country/city coverage", () => {
    const synthetic = withCities([cityFact("city.batumi", "2018-02", { seriesId: "cpi.cat.01" })]);
    synthetic.inflation.categories = [
      ...snapshot.inflation.categories.filter((fact) => fact.categoryId !== "cpi.cat.01"),
      ...["2010-01", "2025-12"].map((period) => ({ ...snapshot.inflation.categories.find((fact) => fact.categoryId === "cpi.cat.01" && fact.measure === "yoy_pct")!, period })),
    ];
    const response = queryInflation(synthetic, { entityIds: ["country.georgia", "city.batumi"], seriesIds: ["cpi.cat.01"], measure: "yoy_pct", fromPeriod: "2010-01", toPeriod: "2010-01" });
    expect(response).toMatchObject({ data: { observations: [{ availability: "available" }, { value: null }], coverage: { availablePeriods: ["2010-01", "2025-12"], availableYears: [2010, 2018, 2025] } } });
  });

  it("still refuses city dates outside the existing dataset window", () => {
    expect(queryInflation(snapshot, { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "1999-12", toPeriod: "1999-12" })).toMatchObject({ kind: "error", error: { code: "year_out_of_range" } });
  });

  it("refuses what Geostat does not publish for cities", () => {
    for (const request of [
      { seriesIds: ["cpi.cat.01_1"], measure: "yoy_pct" },
      { seriesIds: ["cpi.core"], measure: "yoy_pct" },
      { seriesIds: ["cpi.headline"], measure: "index_2010" },
      { seriesIds: ["cpi.cat.01"], measure: "contribution_pp" },
      { seriesIds: ["cpi.cat.01"], measure: "avg12_pct" },
    ]) {
      const response = queryInflation(snapshot, { entityIds: ["city.gori"], ...request, fromPeriod: "2026-08", toPeriod: "2026-08" });
      expect(response.kind, JSON.stringify(request)).toBe("error");
    }
    expect((queryInflation(snapshot, { entityIds: ["city.rustavi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }) as { error: { code: string } }).error.code).toBe("unknown_entity");
  });

  it("refuses a city subgroup request as unknown_series with the 13 city series ids", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.gori"], seriesIds: ["cpi.cat.01_1"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }) as {
      kind: string;
      error: { code: string; validChoices: string[] };
    };
    expect(response.kind).toBe("error");
    expect(response.error.code).toBe("unknown_series");
    expect(response.error.validChoices).toEqual(["cpi.headline", ...Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`)]);
  });

  it("refuses a city measure Geostat does not publish for that series as unsupported_measure with that series' choices", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.gori"], seriesIds: ["cpi.cat.01"], measure: "avg12_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }) as {
      kind: string;
      error: { code: string; validChoices: string[] };
    };
    expect(response.kind).toBe("error");
    expect(response.error.code).toBe("unsupported_measure");
    expect(response.error.validChoices).toEqual(["yoy_pct", "mom_pct"]);
  });

  it("flags centrally priced items on city division cells", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.telavi"], seriesIds: ["cpi.cat.07"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" });
    expect(response.meta.caveats.map((caveat) => caveat.code)).toContain("inflation_city_central_prices");
    expect(observations(response)[0]!.caveatIds.length).toBeGreaterThan(0);
  });

  it("counts cells across entities", () => {
    expect(inflationCellCount({ entityIds: ["city.gori", "city.telavi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-01", toPeriod: "2026-08" })).toBe(16);
  });
});

describe("city query to original-source lookup", () => {
  it.each(["city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"])("resolves %s originals for every supported headline measure", (cityId) => {
    for (const measure of ["yoy_pct", "mom_pct", "avg12_pct"]) {
      const response = queryInflation(snapshot, { entityIds: [cityId], seriesIds: ["cpi.headline"], measure, fromPeriod: "2026-08", toPeriod: "2026-08" });
      expect(response.status).toBe("ok");
      if (response.kind !== "observations") throw new Error("Expected city observations");
      const observation = (response.data as { observations: Observation[] }).observations[0]!;
      expect(observation.sourceIds.length).toBeGreaterThan(0);
      for (const datasetId of [undefined, "inflation"]) {
        const result = getSources(snapshot, { sourceIds: observation.sourceIds, entityIds: [cityId], years: [2026], ...(datasetId ? { datasetId } : {}) });
        expect(result.kind).toBe("sources");
        const data = (result as { data: GetSourcesData }).data;
        expect(data.narrowedBy).toMatchObject({ entityIds: [cityId], years: [2026], ...(datasetId ? { datasetId } : {}) });
        expect(data.sources.flatMap(source => source.documents.map(document => document.documentId))).toEqual(observation.documentIds);
        for (const source of data.sources) {
          expect(source).toMatchObject({ narrowingOutcome: "applied", narrowed: false, documentCount: source.documents.length });
          expect(source.documents).toEqual(snapshot.sources.find(original => original.sourceId === source.sourceId)!.documents);
          for (const document of source.documents) {
            expect(document.archiveUrl).toMatch(/^https:\/\/fiscal.ge\/downloads\//);
            expect(document.sha256).toMatch(/^[0-9a-f]{64}$/);
            expect(document.byteSize).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("rejects an unregistered city and preserves explicit no-match outcomes for unrelated originals, datasets and years", () => {
    expect(getSources(snapshot, { sourceIds: ["source.geostat_cpi_yoy"], entityIds: ["city.rustavi"] })).toMatchObject({ kind: "error", error: { code: "unknown_entity" } });
    for (const filters of [
      { sourceIds: ["source.mof_2017_revenue_form1_pdf"], years: [2017] },
      { sourceIds: ["source.geostat_cpi_index_2010"], datasetId: "inflation", years: [2026] },
      { sourceIds: ["source.geostat_cpi_yoy"], datasetId: "national-revenue", years: [2026] },
      { sourceIds: ["source.geostat_cpi_yoy"], datasetId: "inflation", years: [1995] },
    ]) {
      const result = getSources(snapshot, { ...filters, entityIds: ["city.batumi"] });
      expect(result.kind).toBe("sources");
      const source = (result as { data: GetSourcesData }).data.sources[0]!;
      expect(source).toMatchObject({ narrowingOutcome: "dropped_no_match", narrowed: false, documentCount: source.documents.length });
      expect(source.documents).toEqual(snapshot.sources.find(original => original.sourceId === source.sourceId)!.documents);
    }
  });
});

describe("city rankings, comparisons and coverage", () => {
  it("city discovery advertises only queryable combinations", () => {
    const response = describeCoverage(snapshot, { datasetId: "inflation", entityType: "city" });
    if (response.kind !== "catalogue") throw new Error("Expected catalogue");
    const coverage = response.data as CoverageData;
    const seriesIds = coverage.series!.map(series => series.seriesId);
    const expectedCitySeriesIds = ["cpi.headline", ...Array.from({ length: 12 }, (_, i) => `cpi.cat.${String(i + 1).padStart(2, "0")}`)];
    expect(seriesIds).toEqual(expectedCitySeriesIds);
    expect(coverage.entities!.map(entity => entity.entityId).sort()).toEqual(["city.batumi", "city.gori", "city.kutaisi", "city.tbilisi", "city.telavi", "city.zugdidi"]);
    for (const series of coverage.series!) {
      const measures = series.seriesId === "cpi.headline" ? ["yoy_pct", "mom_pct", "avg12_pct"] : ["yoy_pct", "mom_pct"];
      expect(Object.keys(series.periodsByMeasure!)).toEqual(measures);
      expect(series.yearsByMeasure).toBeUndefined();
      const facts = snapshot.inflation.cities.filter(fact => fact.seriesId === series.seriesId);
      expect(series.years).toEqual([...new Set(facts.map(fact => Number(fact.period.slice(0, 4))))].sort((a, b) => a - b));
      for (const measure of measures) {
        const periods = facts.filter(fact => fact.measure === measure).map(fact => fact.period).sort();
        expect(series.periodsByMeasure![measure]).toEqual([periods[0], periods.at(-1)]);
        for (const entity of coverage.entities!) {
          const available = facts.find(fact => fact.cityId === entity.entityId && fact.measure === measure)!;
          expect(available).toBeDefined();
          const query = queryInflation(snapshot, { entityIds: [entity.entityId], seriesIds: [series.seriesId], measure, fromPeriod: available.period, toPeriod: available.period });
          expect(query.status).toBe("ok");
          expect(observations(query)[0]!.value).toBe(available.value);
        }
      }
    }
    const periods = snapshot.inflation.cities.map(fact => fact.period).sort();
    expect(coverage.datasets).toEqual([expect.objectContaining({ entityTypes: ["city"], measures: ["yoy_pct", "mom_pct", "avg12_pct"], periods: [periods[0], periods.at(-1)], years: [Number(periods[0].slice(0, 4)), Number(periods.at(-1)!.slice(0, 4))] })]);
    for (const entity of coverage.entities!) {
      const cityPeriods = snapshot.inflation.cities.filter(fact => fact.cityId === entity.entityId).map(fact => fact.period).sort();
      expect(entity.periods).toEqual([cityPeriods[0], cityPeriods.at(-1)]);
    }
  });

  it("ranks the six cities for one series and month, without Georgia", () => {
    const response = rank(snapshot, { datasetId: "inflation", dimension: "entities", entityType: "city", seriesId: "cpi.cat.01", period: "2026-08", measure: "yoy_pct", metric: "value", limit: 3 });
    const data = (response as { data: { entries: { entityId: string; value: number }[]; universe: { candidateCount: number } } }).data;
    expect(data.entries.map((entry) => entry.entityId)).toEqual(["city.kutaisi", "city.batumi", "city.tbilisi"]);
    expect(data.entries.map((entry) => entry.value)).toEqual([6.507, 5.9542, 4.8642]);
    expect(data.universe.candidateCount).toBe(6);
  });

  it("refuses a city ranking without one seriesId", () => {
    expect(rank(snapshot, { datasetId: "inflation", dimension: "entities", entityType: "city", period: "2026-08", measure: "yoy_pct", metric: "value" }).kind).toBe("error");
  });

  it("compares one city between two months", () => {
    const response = compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"], entityIds: ["city.batumi"] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct" });
    expect(response.kind).toBe("comparisons");
  });

  it("lists the cities as inflation entities with their coverage", () => {
    const response = describeCoverage(snapshot, { datasetId: "inflation" });
    const entities = (response as { data: { entities?: { entityId: string; entityType: string; periods?: [string, string] }[] } }).data.entities!;
    expect(entities.map((entity) => entity.entityId)).toEqual(["country.georgia", "city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"]);
    expect(entities.find((entity) => entity.entityId === "city.zugdidi")!.periods![0]).toBe("2016-01");
  });

  it("is schema 1.6.0", () => {
    expect(SCHEMA_VERSION).toBe("1.6.0");
  });
});
