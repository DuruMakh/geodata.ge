import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare } from "../../lib/factQuery/compare";
import { getSources } from "../../lib/factQuery/getSources";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import type { Comparison } from "../../lib/factQuery/compare";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-02T00:00:00.000Z" });
});

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

describe("response meta carries only the evidence behind the answer", () => {
  // Measured before the fix: this exact call returned 80.0 KiB, of which 77.9 KiB
  // was meta.sources - one source carrying all 75 municipal workbooks, when the
  // single returned row cites 2 of them. Narrowing takes it to 4.4 KiB.
  it("narrows meta.sources[].documents to the documents the rows cite", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.total"],
      years: [2024],
      measure: "amount_gel",
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const cited = new Set(
      (result.data as { observations: { documentIds: string[] }[] }).observations.flatMap((o) => o.documentIds),
    );
    const carried = result.meta.sources.flatMap((source) => source.documents.map((d) => d.documentId));

    expect(carried.length).toBeGreaterThan(0);
    expect([...new Set(carried)].sort()).toEqual([...cited].sort());
    expect(bytes(result)).toBeLessThan(8 * 1024);
  });

  // Narrowing points at the right original; it never hides provenance. Same
  // contract resolveDocumentIds states: a cited source must always show
  // something a reader can open.
  it("never leaves a cited source with zero documents", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: ["region.adjara"],
      seriesIds: ["municipal.total"],
      years: [2016, 2020, 2024],
      measure: "amount_gel",
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    for (const source of result.meta.sources) {
      const archived = snapshot.sources.find((s) => s.sourceId === source.sourceId);
      if (archived === undefined || archived.documents.length === 0) continue;
      expect(source.documents.length, `${source.sourceId} was narrowed to nothing`).toBeGreaterThan(0);
    }
  });

  it("narrows a comparison to the documents behind its two endpoints", () => {
    const result = compare(snapshot, {
      target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] },
      fromYear: 2016,
      toYear: 2024,
      measure: "amount_gel",
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const comparisons = (result.data as { comparisons: Comparison[] }).comparisons;
    const cited = new Set(comparisons.flatMap((c) => [...c.from.documentIds, ...c.to.documentIds]));
    const carried = new Set(result.meta.sources.flatMap((source) => source.documents.map((d) => d.documentId)));

    expect(carried.size).toBeGreaterThan(0);
    expect([...carried].sort()).toEqual([...cited].sort());
  });

  // getSources' whole purpose is to return documents. Narrowing must not touch it.
  it("leaves getSources' own document listing intact", () => {
    const sourceId = "source.municipal_mof_annual_and_history_workbooks";
    const result = getSources(snapshot, { sourceIds: [sourceId] });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const archived = snapshot.sources.find((s) => s.sourceId === sourceId);
    expect(archived).toBeDefined();
    expect(result.meta.sources[0]!.documents.length).toBe(archived!.documents.length);
  });
});
