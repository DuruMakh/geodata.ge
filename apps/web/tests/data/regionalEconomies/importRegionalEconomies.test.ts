import { beforeAll, describe, expect, test } from "vitest";
import {
  assertRegionalEconomyParity,
  loadRegionalEconomyFacts,
} from "../../../lib/data/regionalEconomies/importRegionalEconomies";
import type { RegionalEconomyObservation } from "../../../lib/data/regionalEconomies/types";
import { loadSourceDocuments } from "../../../lib/data/sources";

let facts: RegionalEconomyObservation[];

beforeAll(async () => {
  facts = await loadRegionalEconomyFacts();
});

describe("regional economy canonical loader and mirror parity", () => {
  test("loads all exact canonical rows", () => {
    expect(facts).toHaveLength(6_930);
    expect(facts.find((row) =>
      row.regionId === "region.imereti" && row.seriesId === "sector.a" &&
      row.measure === "nominal" && row.year === 2024,
    )?.value).toBe("715676721.66770501");
  });

  test("registers every source ID used by Regional GDP facts", async () => {
    const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const sourceIds = new Set(sources.map((source) => source.sourceId));
    expect([...new Set(facts.map((fact) => fact.sourceId))].sort()).toEqual([
      "source.fiscal_regional_economy_share",
      "source.geostat_regional_gdp",
      "source.geostat_regional_gdp_by_activity",
    ]);
    expect(facts.every((fact) => sourceIds.has(fact.sourceId))).toBe(true);
  });

  test("parity ignores row order but preserves exact decimal text", () => {
    expect(() => assertRegionalEconomyParity(facts, [...facts].reverse())).not.toThrow();
    const changed = structuredClone(facts);
    changed[0].value = `${changed[0].value}1`;
    expect(() => assertRegionalEconomyParity(facts, changed)).toThrow(/Regional economies parity/i);
  });

  test.each([
    { status: "preliminary" },
    { unit: "percent" },
    { sourceLocator: "wrong" },
    { sourceId: "source.unknown" },
    { lastReviewedAt: "2026-09-12" },
    { calculation: "ratio_to_region_gdp" },
    { valuation: "basic_prices" },
  ])("rejects a changed mirror field %j", (patch) => {
    const changed = structuredClone(facts);
    changed[0] = { ...changed[0], ...patch } as RegionalEconomyObservation;
    expect(() => assertRegionalEconomyParity(facts, changed)).toThrow();
  });

  test("rejects missing and duplicate mirror keys", () => {
    expect(() => assertRegionalEconomyParity(facts, facts.slice(1))).toThrow(/Regional economies parity/i);
    expect(() => assertRegionalEconomyParity(facts, [...facts, facts[0]])).toThrow();
  });
});
