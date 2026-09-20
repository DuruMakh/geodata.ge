import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import {
  buildAllPublications,
  buildRegionalEconomiesCsv,
  buildRegionalEconomiesJson,
} from "../../../lib/factQuery/publications";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({
    releaseCommit: "test",
    generatedAt: "2026-09-13T00:00:00.000Z",
  });
});

describe("regional economy publications", () => {
  it("publishes all 6,930 canonical cells in the approved CSV schema", () => {
    const artifact = buildRegionalEconomiesCsv(snapshot);
    const text = artifact.bytes.toString("utf8");

    expect(artifact.fileName).toBe("regional-economies.csv");
    expect(artifact.rowCount).toBe(6_930);
    expect(text.split("\n")[0]).toBe(
      "﻿region_id,region_name_ka,region_name_en,series_id,series_name_ka,series_name_en,year,measure,value,unit,valuation,price_basis,status,source_id",
    );
    expect(text).toContain("region.imereti,იმერეთი,Imereti,sector.a");
    expect(text).toContain("Agriculture, forestry and fishing");
    expect(text).not.toContain("real_growth");
    expect(text).not.toContain("per_capita");
  });

  it("publishes the same 6,930 cells with definitions and source evidence in JSON", () => {
    const artifact = buildRegionalEconomiesJson(snapshot);
    const published = JSON.parse(artifact.bytes.toString("utf8")) as {
      datasetId: string;
      observations: unknown[];
      supportingValues: { definitions: Record<string, unknown> };
      sources: unknown[];
    };

    expect(artifact.fileName).toBe("regional-economies.json");
    expect(artifact.rowCount).toBe(6_930);
    expect(published.datasetId).toBe("regional-economies");
    expect(published.observations).toHaveLength(6_930);
    expect(Object.keys(published.supportingValues.definitions)).toEqual(["nominal", "share_of_region_gdp"]);
    expect(published.sources.length).toBeGreaterThan(0);
  });

  it("registers both files in the complete publication set", () => {
    const names = buildAllPublications(snapshot).map((artifact) => artifact.fileName);
    expect(names).toContain("regional-economies.csv");
    expect(names).toContain("regional-economies.json");
  });
});
