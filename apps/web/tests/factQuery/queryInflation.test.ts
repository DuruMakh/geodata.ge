// apps/web/tests/factQuery/queryInflation.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { periodFromKey } from "../../lib/data/inflation/periods";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { contributionIndex } from "../../lib/factQuery/inflationData";
import type { Observation } from "../../lib/factQuery/observations";
import { inflationCellCount, queryInflation } from "../../lib/factQuery/queryInflation";
import { errorCodeSchema, observationSchema } from "../../lib/factQuery/schemas";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function rows(response: FactQueryResponse): Observation[] {
  if (response.kind !== "observations") throw new Error(JSON.stringify(response));
  return (response.data as { observations: Observation[] }).observations;
}

function errorOf(response: FactQueryResponse) {
  if (response.kind !== "error") throw new Error(`expected an error, got ${response.kind}`);
  expect(errorCodeSchema.options).toContain(response.error.code);
  return response.error;
}

const headlineYoy = (period: string) =>
  snapshot.inflation.facts.find((f) => f.seriesId === "cpi.headline" && f.measure === "yoy_pct" && f.period === period)!.value;

describe("queryInflation", () => {
  it("returns a published monthly value with its period, unit and evidence", () => {
    const [row] = rows(queryInflation(snapshot, { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }));
    observationSchema.parse(row);
    expect(row).toMatchObject({
      observationId: "inflation:country.georgia:cpi.headline:2026-08:yoy_pct",
      datasetId: "inflation",
      period: "2026-08",
      year: 2026,
      value: 5.6479,
      unit: "percent",
      basis: "published",
      sourceIds: ["source.geostat_cpi_yoy"],
    });
    expect(row!.documentIds.length).toBeGreaterThan(0);
  });

  it("returns one basket weight per calendar year the range touches, without a period", () => {
    const weights = rows(queryInflation(snapshot, { seriesIds: ["cpi.cat.01"], measure: "basket_weight_pct", fromPeriod: "2024-06", toPeriod: "2025-02" }));
    expect(weights.map((row) => row.year)).toEqual([2024, 2025]);
    expect(weights.every((row) => row.period === undefined)).toBe(true);
    for (const row of weights) {
      expect(row.value).toBe(snapshot.inflation.weights.find((w) => w.categoryId === "cpi.cat.01" && w.year === row.year)!.weightPct);
    }
  });

  it("rejects a measure the series does not publish, naming the valid ones", () => {
    const error = errorOf(queryInflation(snapshot, { seriesIds: ["cpi.core"], measure: "index_2010", fromPeriod: "2026-08", toPeriod: "2026-08" }));
    expect(error.code).toBe("unsupported_measure");
    expect(error.validChoices).toEqual(["mom_pct", "yoy_pct"]);
  });

  it("does not accept the residual or an unknown group as a series", () => {
    for (const seriesId of ["cpi.contribution_residual", "cpi.cat.99"]) {
      const error = errorOf(queryInflation(snapshot, { seriesIds: [seriesId], measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" }));
      expect(error.code).toBe("unknown_series");
      expect(error.validChoices).toContain("cpi.cat.07");
      expect(error.validChoices).not.toContain("cpi.contribution_residual");
    }
  });

  it("reports the target before its first reviewed month as unverified, never zero", () => {
    const [early] = rows(queryInflation(snapshot, { seriesIds: ["cpi.target"], measure: "target_pct", fromPeriod: "2014-06", toPeriod: "2014-06" }));
    expect(early).toMatchObject({ value: null, availability: "missing", caveatIds: ["inflation_target_unverified_before_2015"] });
    expect(early!.missingReasonEn).toContain("does not mean none existed");
    const [current] = rows(queryInflation(snapshot, { seriesIds: ["cpi.target"], measure: "target_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }));
    const inForce = snapshot.inflation.targets.find((t) => t.effectiveFrom <= "2026-08" && (t.effectiveTo === null || "2026-08" <= t.effectiveTo))!;
    expect(current!.value).toBe(inForce.targetPct);
  });

  it("closes division contributions on the published headline with a residual", () => {
    const divisions = snapshot.inflation.groups.filter((g) => g.level === "division").map((g) => g.id);
    const response = queryInflation(snapshot, { seriesIds: divisions, measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" });
    const cells = rows(response);
    expect(cells).toHaveLength(13);
    const residual = cells.at(-1)!;
    expect(residual).toMatchObject({ seriesId: "cpi.contribution_residual", level: "residual", unit: "percentage_points", caveatIds: ["inflation_contribution_residual"] });
    const sum = cells.reduce((total, row) => total + row.value!, 0);
    expect(Math.abs(sum - headlineYoy("2026-08"))).toBeLessThan(1e-9);
    expect(cells.slice(0, 12).every((row) => row.caveatIds.includes("inflation_contribution_derived"))).toBe(true);
    expect(response.meta.caveats[0]!.severity).toBe("severe");
  });

  it("serves exactly the site's contribution arithmetic", () => {
    const divisions = snapshot.inflation.groups.filter((g) => g.level === "division").map((g) => g.id);
    const cells = rows(queryInflation(snapshot, { seriesIds: divisions, measure: "contribution_pp", fromPeriod: "2013-01", toPeriod: "2013-12" }));
    const index = contributionIndex(snapshot);
    for (const row of cells.filter((cell) => cell.seriesId !== "cpi.contribution_residual" && cell.value !== null)) {
      expect(row.value).toBe(index.get(row.seriesId)!.get(periodFromKey(row.period!)));
    }
  });

  it("refuses contributions that mix divisions and subgroups", () => {
    const error = errorOf(queryInflation(snapshot, { seriesIds: ["cpi.cat.01", "cpi.cat.01_1"], measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" }));
    expect(error.code).toBe("invalid_parameters");
  });

  it("explains a contribution before contributions begin", () => {
    const [row] = rows(queryInflation(snapshot, { seriesIds: ["cpi.cat.01"], measure: "contribution_pp", fromPeriod: "2012-06", toPeriod: "2012-06" }));
    expect(row).toMatchObject({ value: null, availability: "missing" });
    expect(row!.missingReasonEn).toContain("2013");
  });

  it("refuses a reversed or out-of-range request", () => {
    expect(errorOf(queryInflation(snapshot, { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-01" })).code).toBe("invalid_parameters");
    expect(errorOf(queryInflation(snapshot, { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "1999-12", toPeriod: "2004-01" })).code).toBe("year_out_of_range");
  });

  it("counts cells before any work", () => {
    expect(inflationCellCount({ seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2024-01", toPeriod: "2025-12" })).toBe(24);
    expect(inflationCellCount({ seriesIds: Array.from({ length: 12 }, (_, i) => `d${i}`), measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" })).toBe(13);
    expect(inflationCellCount({ seriesIds: ["cpi.cat.01"], measure: "basket_weight_pct", fromPeriod: "2024-06", toPeriod: "2025-02" })).toBe(2);
    expect(inflationCellCount({ seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "bad", toPeriod: "2025-02" })).toBe(0);
  });
});
