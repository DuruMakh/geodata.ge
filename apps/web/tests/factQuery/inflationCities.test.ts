import { describe, expect, it } from "vitest";
import { compare } from "../../lib/factQuery/compare";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { queryInflation, inflationCellCount } from "../../lib/factQuery/queryInflation";
import { rank } from "../../lib/factQuery/rank";
import { SCHEMA_VERSION } from "../../lib/factQuery/types";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

const snapshot = loadPackagedSnapshot();
type Obs = { observationId: string; entityType: string; value: number | null; availability: string; missingReasonEn: string | null; caveatIds: string[] };
const observations = (response: ReturnType<typeof queryInflation>) => (response as { data: { observations: Obs[] } }).data.observations;

describe("query_inflation for cities", () => {
  it("answers a city's annual inflation", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" });
    expect(response.status).toBe("ok");
    expect(observations(response)[0]).toMatchObject({ observationId: "inflation:city.batumi:cpi.headline:2026-08:yoy_pct", entityType: "city", value: 7.0857 });
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

describe("city rankings, comparisons and coverage", () => {
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

  it("is schema 1.4.0", () => {
    expect(SCHEMA_VERSION).toBe("1.4.0");
  });
});
