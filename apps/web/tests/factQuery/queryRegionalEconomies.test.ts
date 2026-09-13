import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { queryRegionalEconomies } from "../../lib/factQuery/queryRegionalEconomies";
import type { Observation } from "../../lib/factQuery/observations";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({
    releaseCommit: "test",
    generatedAt: "2026-09-13T00:00:00.000Z",
  });
});

function observations(result: ReturnType<typeof queryRegionalEconomies>): Observation[] {
  if (result.kind !== "observations") throw new Error(`Expected observations, received ${result.kind}`);
  return (result.data as { observations: Observation[] }).observations;
}

describe("queryRegionalEconomies", () => {
  it("returns exact GEL and region-GDP-share values with regional source evidence", () => {
    const amount = queryRegionalEconomies(snapshot, {
      regionIds: ["region.imereti"],
      seriesIds: ["sector.a"],
      years: [2024],
      measure: "amount_gel",
    });
    const share = queryRegionalEconomies(snapshot, {
      regionIds: ["region.imereti"],
      seriesIds: ["sector.a"],
      years: [2024],
      measure: "share_of_region_gdp_pct",
    });

    expect(observations(amount)[0]).toMatchObject({
      datasetId: "regional-economies",
      entityId: "region.imereti",
      entityType: "region",
      entityLabelKa: "იმერეთი",
      entityLabelEn: "Imereti",
      seriesId: "sector.a",
      year: 2024,
      unit: "GEL",
      value: 715_676_721.667705,
      availability: "available",
      basis: "published",
      sourceIds: ["source.geostat_regional_gdp_by_activity"],
    });
    expect(observations(share)[0]).toMatchObject({
      measure: "share_of_region_gdp_pct",
      unit: "percent",
      value: 9.935606228689402,
    });
    expect(observations(share)[0]!.valueDefinitionEn).toContain("same region");
    expect(share.meta.sources[0]?.documents.length).toBeGreaterThan(0);
  });

  it("supports multiple regions and series plus explicit year ranges", () => {
    const result = queryRegionalEconomies(snapshot, {
      regionIds: ["region.guria", "region.imereti"],
      seriesIds: ["economy.regional_gdp_total", "sector.a"],
      fromYear: 2023,
      toYear: 2024,
      measure: "amount_gel",
    });

    expect(result.status).toBe("ok");
    expect(observations(result)).toHaveLength(8);
    expect(new Set(observations(result).map((row) => row.entityId))).toEqual(
      new Set(["region.guria", "region.imereti"]),
    );
  });

  it("keeps missing cells distinct from a reviewed zero", () => {
    const changed = structuredClone(snapshot);
    const zeroCell = changed.regionalEconomies.facts.find(
      (fact) => fact.regionId === "region.guria" && fact.seriesId === "sector.b" && fact.year === 2010 && fact.measure === "nominal",
    )!;
    zeroCell.value = "0";
    changed.regionalEconomies.facts = changed.regionalEconomies.facts.filter(
      (fact) => !(fact.regionId === "region.imereti" && fact.seriesId === "sector.b" && fact.year === 2010 && fact.measure === "nominal"),
    );

    const result = queryRegionalEconomies(changed, {
      regionIds: ["region.guria", "region.imereti"],
      seriesIds: ["sector.b"],
      years: [2010],
      measure: "amount_gel",
    });

    expect(result.status).toBe("partial");
    expect(observations(result).map((row) => [row.entityId, row.value, row.availability])).toEqual([
      ["region.guria", 0, "available"],
      ["region.imereti", null, "missing"],
    ]);
  });

  it.each([
    [{ regionIds: ["region.unknown"], seriesIds: ["sector.a"], years: [2024], measure: "amount_gel" }, "unknown_entity"],
    [{ regionIds: ["region.imereti"], seriesIds: ["sector.unknown"], years: [2024], measure: "amount_gel" }, "unknown_series"],
    [{ regionIds: ["region.imereti"], seriesIds: ["sector.a"], years: [2025], measure: "amount_gel" }, "year_out_of_range"],
    [{ regionIds: ["region.imereti"], seriesIds: ["sector.a"], years: [2024], measure: "share_of_gdp_pct" }, "invalid_parameters"],
    [{ regionIds: ["region.imereti"], seriesIds: ["sector.a"], years: [2024], measure: "amount_gel", expectedDataVersion: "0".repeat(64) }, "data_version_changed"],
  ] as const)("rejects unsupported request %j", (input, code) => {
    const result = queryRegionalEconomies(snapshot, input);
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.error.code).toBe(code);
  });

  it("never exposes national share, growth, per-capita or 2025 observations", () => {
    const text = JSON.stringify(
      queryRegionalEconomies(snapshot, {
        regionIds: ["region.imereti"],
        seriesIds: ["economy.regional_gdp_total", "sector.a"],
        years: [2024],
        measure: "share_of_region_gdp_pct",
      }),
    );

    expect(text).not.toContain('"measure":"share_of_gdp_pct"');
    expect(text).not.toContain("real_growth");
    expect(text).not.toContain("per_capita");
    expect(text).not.toContain('"year":2025');
  });
});
