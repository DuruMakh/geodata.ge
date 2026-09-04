import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare } from "../../lib/factQuery/compare";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { queryNational } from "../../lib/factQuery/queryNational";
import { LIMITS, boundedToolResult, toolResult, tooLargeResponse } from "../../lib/mcp/result";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-02T00:00:00.000Z" });
});

const size = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

describe("MCP tool results", () => {
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
