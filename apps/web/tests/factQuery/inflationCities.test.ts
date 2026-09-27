import { describe, expect, it } from "vitest";
import { queryInflation, inflationCellCount } from "../../lib/factQuery/queryInflation";
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
    expect(observations(response)[0]!.missingReasonEn).toMatch(/2016-01/);
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

  it("flags centrally priced items on city division cells", () => {
    const response = queryInflation(snapshot, { entityIds: ["city.telavi"], seriesIds: ["cpi.cat.07"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" });
    expect(response.meta.caveats.map((caveat) => caveat.code)).toContain("inflation_city_central_prices");
    expect(observations(response)[0]!.caveatIds.length).toBeGreaterThan(0);
  });

  it("counts cells across entities", () => {
    expect(inflationCellCount({ entityIds: ["city.gori", "city.telavi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-01", toPeriod: "2026-08" })).toBe(16);
  });
});
