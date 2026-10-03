import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare } from "../../lib/factQuery/compare";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { queryNational } from "../../lib/factQuery/queryNational";
import { queryInflation } from "../../lib/factQuery/queryInflation";
import { LIMITS, boundedToolResult, toolResult, tooLargeResponse } from "../../lib/mcp/result";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import { queryInflationProducts } from "../../lib/factQuery/queryInflationProducts";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { rank } from "../../lib/factQuery/rank";
import type { Observation } from "../../lib/factQuery/observations";
import type { RankData } from "../../lib/factQuery/rank";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-02T00:00:00.000Z" });
});

const size = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

describe("MCP tool results", () => {
  it.each([
    { name: "Batumi", entityIds: ["city.batumi"], measure: "yoy_pct", periods: ["2016-01", "2026-08"], years: Array.from({ length: 11 }, (_, i) => 2016 + i) },
    { name: "Zugdidi average", entityIds: ["city.zugdidi"], measure: "avg12_pct", periods: ["2017-12", "2026-08"], years: Array.from({ length: 10 }, (_, i) => 2017 + i) },
    { name: "country and city", entityIds: ["country.georgia", "city.batumi"], measure: "yoy_pct", periods: ["2004-01", "2026-08"], years: Array.from({ length: 23 }, (_, i) => 2004 + i) },
    { name: "no city facts", entityIds: ["city.batumi"], measure: "yoy_pct", periods: null, years: [], synthetic: "empty" },
    { name: "sparse city years", entityIds: ["city.batumi"], measure: "yoy_pct", periods: ["2018-02", "2020-03"], years: [2018, 2020], synthetic: "sparse" },
  ])("preserves $name availability in the text a client reads", ({ entityIds, measure, periods, years, synthetic }) => {
    const fact = snapshot.inflation.cities.find(row => row.cityId === "city.batumi" && row.seriesId === "cpi.headline" && row.measure === "yoy_pct")!;
    const selectedSnapshot = synthetic === undefined ? snapshot : {
      ...snapshot, inflation: { ...snapshot.inflation, cities: synthetic === "empty" ? [] : ["2018-02", "2020-03"].map(period => ({ ...fact, period })) },
    };
    const response = queryInflation(selectedSnapshot, { entityIds, seriesIds: ["cpi.headline"], measure, fromPeriod: "2016-06", toPeriod: "2016-06" });
    expect(response).toMatchObject({ kind: "observations", data: { coverage: { availablePeriods: periods, availableYears: years } } });
    const result = boundedToolResult(selectedSnapshot, response);
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual(response);
    const text = result.content[0]!.text;
    expect(text).toContain(`availablePeriods ${JSON.stringify(periods)}`);
    expect(text).toContain(`availableYears ${JSON.stringify(years)}`);
    expect(text).toContain(periods === null ? "No available months" : "gaps and later starts may remain");
  });

  it("prints cumulative bases, derivation, sources, missingness and caveats with their structured values", () => {
    const response = queryInflationProducts(snapshot, { seriesIds: ["cpi.product.p0001", "cpi.product.p0051"], measure: "cumulative_pct", startYear: 2015, fromPeriod: "2026-08", toPeriod: "2026-08" });
    if (response.kind !== "observations") throw new Error("Expected product observations");
    const result = boundedToolResult(snapshot, response);
    expect(result.isError).toBe(false);
    const text = result.content[0]!.text;
    const coverage = (response.data as { coverage: { availablePeriods: [string, string] | null; availableYears: number[] } }).coverage;
    expect(text).toContain(`availablePeriods ${JSON.stringify(coverage.availablePeriods)}`);
    expect(text).toContain(`availableYears ${JSON.stringify(coverage.availableYears)}`);
    expect(text).toContain("calculationBasePeriod");
    expect(text).toContain("2014-12");
    expect(text).toContain("Fiscal.ge");
    for (const observation of (response.data as { observations: Observation[] }).observations) {
      expect(text).toContain(observation.seriesId);
      expect(text).toContain(observation.value === null ? "missing" : String(observation.value));
      if (observation.missingReasonEn) expect(text).toContain(observation.missingReasonEn);
      for (const id of [...observation.sourceIds, ...observation.documentIds, ...observation.caveatIds]) expect(text).toContain(id);
    }
    const ranked = rank(snapshot, { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "cumulative_pct", startYear: 2015, period: "2026-08" });
    if (ranked.kind !== "ranking") throw new Error("Expected product ranking");
    const rankedText = boundedToolResult(snapshot, ranked).content[0]!.text;
    expect(rankedText).toContain("calculationBasePeriod");
    for (const entry of (ranked.data as RankData).entries) expect(rankedText).toContain(`${entry.period}\t${entry.calculationBasePeriod}`);
  });

  it("fits the complete reviewed product catalogue and realistic rankings with exclusions", () => {
    const responses = [describeCoverage(snapshot, { datasetId: "inflation-products" }), ...["yoy_pct", "cumulative_pct"].map(measure => rank(snapshot, {
      datasetId: "inflation-products", dimension: "series", metric: "value", measure, period: "2026-08", limit: 100,
      ...(measure === "cumulative_pct" ? { startYear: 2015 } : {}),
    }))];
    if (responses.some(response => response.kind === "error")) throw new Error("Expected successful catalogue/rank responses");
    const catalogue = responses[0]!;
    const cumulative = responses[2]!;
    if (catalogue.kind !== "catalogue" || cumulative.kind !== "ranking") throw new Error("Expected catalogue and ranking");
    expect((catalogue.data as { series: unknown[] }).series).toHaveLength(305);
    expect((cumulative.data as RankData).universe).toMatchObject({ candidateCount: 305, eligibleCount: 287, returnedCount: 100 });
    for (const response of responses) {
      const result = boundedToolResult(snapshot, response);
      expect(result.isError).toBe(false);
      expect(result.structuredContent).toEqual(response);
      expect(LIMITS.resultBytes - size(result)).toBeGreaterThan(0);
    }
  });
  it("carries the envelope as structured content and an equivalent text twin", () => {
    const response = queryNational(snapshot, {
      side: "expenditure",
      seriesIds: ["expenditure.total"],
      years: [2024],
      measure: "amount_gel",
    });
    const result = toolResult(response);

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual(response);
    expect(result.content).toHaveLength(1);
    // A text-only client must be able to answer AND cite from this alone.
    expect(result.content[0]!.text).toContain("2024");
    expect(result.content[0]!.text).toContain(snapshot.dataVersion.slice(0, 12));
    expect(result.content[0]!.text).toContain("GEL");
    expect(result.content[0]!.text).toContain("CC BY 4.0");
  });

  it("marks an error envelope as an error and carries no structured payload", () => {
    const response = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.not_a_series"],
      years: [2024],
      measure: "amount_gel",
    });
    const result = toolResult(response);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0]!.text).toContain("unknown_series");
  });

  // Spec 11.3 sets BOTH "500 cells" and "512 KiB including both
  // representations". Measured on real municipal data they cannot both hold: a
  // compliant 495-cell request serializes to 517.0 KiB after Task 1's
  // narrowing (541.9 KiB before it), at roughly 936 bytes of JSON per municipal
  // observation. So the byte ceiling is the binding gate, and a request that
  // obeys the cell cap can still be refused for size.
  it("never returns a tool result over the serialized ceiling", () => {
    const codes = snapshot.municipal.municipalities.map((m) => m.code).slice(0, 45);
    const years = Array.from({ length: 11 }, (_, i) => 2015 + i);
    const response = queryMunicipal(snapshot, {
      entityIds: codes,
      seriesIds: ["municipal.total"],
      years,
      measure: "amount_gel",
    });
    if (response.kind === "error") throw new Error("expected 495 observations");
    expect((response.data as { observations: unknown[] }).observations).toHaveLength(495);

    const result = boundedToolResult(snapshot, response);

    expect(size(result)).toBeLessThanOrEqual(LIMITS.resultBytes);
    // It is refused, not silently truncated: a trimmed answer would be a wrong
    // answer wearing a correct one's shape.
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("result_too_large");
  });

  it("lets an ordinary answer through untouched", () => {
    const response = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.total"],
      years: [2024],
      measure: "amount_gel",
    });
    const result = boundedToolResult(snapshot, response);

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual(response);
    expect(size(result)).toBeLessThan(16 * 1024);
  });

  it("refuses an oversized result with narrowing guidance and a bulk link", () => {
    const response = tooLargeResponse(snapshot, { returned: 4200, bytes: 1_500_000 });
    if (response.kind !== "error") throw new Error("expected an error envelope");

    expect(response.error.code).toBe("result_too_large");
    expect(response.error.retryable).toBe(true);
    expect(response.error.messageKa.length).toBeGreaterThan(0);
    expect(response.error.messageEn).toContain("4200");

    // Guidance, not a bare refusal: say how to narrow, and where the bulk file is.
    const text = toolResult(response).content[0]!.text;
    expect(text).toContain("/downloads/data/");
  });

  it("rejects a result over the cell cap before it is serialized", () => {
    const codes = snapshot.municipal.municipalities.map((m) => m.code);
    const years = Array.from({ length: 11 }, (_, i) => 2015 + i);
    const response = queryMunicipal(snapshot, {
      entityIds: codes,
      seriesIds: ["municipal.total"],
      years,
      measure: "amount_gel",
    });
    if (response.kind === "error") throw new Error("expected observations");
    expect((response.data as { observations: unknown[] }).observations.length).toBeGreaterThan(LIMITS.cells);

    expect(boundedToolResult(snapshot, response).isError).toBe(true);
  });

  it("never trims sources or caveats to fit", () => {
    const response = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.total"],
      years: [2024],
      measure: "amount_gel",
    });
    if (response.kind === "error") throw new Error("expected data");
    const result = toolResult(response);

    expect((result.structuredContent as typeof response).meta.sources).toEqual(response.meta.sources);
    expect((result.structuredContent as typeof response).meta.caveats).toEqual(response.meta.caveats);
    // Khulo 2024 is the case spec 2.4 names: show_warning=false with a real
    // quality problem. Its caveat must survive into the text a model reads.
    expect(result.content[0]!.text).toContain("municipal_source_actual_missing");
  });

  // Khulo 2023->2024 carries a severe caveat (its 2024 total is a functional
  // fallback, because the workbook publishes a plan) alongside a note (the two
  // endpoints are measured differently). This previously used a plain two-year
  // query, whose only note was the retired nominal_gel boilerplate.
  it("puts severe caveats before notes in the text a model reads", () => {
    const response = compare(snapshot, {
      target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] },
      fromYear: 2023,
      toYear: 2024,
      measure: "amount_gel",
    });
    if (response.kind === "error") throw new Error("expected data");
    const severe = response.meta.caveats.filter((caveat) => caveat.severity === "severe");
    const notes = response.meta.caveats.filter((caveat) => caveat.severity === "note");
    // Asserted, not skipped: returning early here meant that a change which
    // dropped severe caveats from this response turned the test green rather
    // than red - the opposite of what it exists to catch.
    expect(severe.length, "severe caveats present").toBeGreaterThan(0);
    expect(notes.length, "note caveats present").toBeGreaterThan(0);

    // Scope to the caveat section: every code also appears in the table's own
    // `caveats` column, so a whole-text indexOf would compare row order, not
    // caveat order.
    const text = toolResult(response).content[0]!.text;
    const section = text.slice(text.indexOf("## შენიშვნები"));

    expect(section).not.toBe("");
    expect(section.indexOf(severe[0]!.code)).toBeLessThan(section.indexOf(notes[0]!.code));
  });
});
