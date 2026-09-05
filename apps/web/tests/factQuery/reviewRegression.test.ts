import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare } from "../../lib/factQuery/compare";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { getSources } from "../../lib/factQuery/getSources";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { queryNational } from "../../lib/factQuery/queryNational";
import { rank } from "../../lib/factQuery/rank";
import { renderText } from "../../lib/mcp/result";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-05T00:00:00Z" });
});

describe("MCP review regressions", () => {
  it("does not claim 2004 components have the same scope as later receipts", () => {
    const result = compare(snapshot, {
      target: { dataset: "national", side: "revenue", seriesIds: ["revenue.asset_decrease", "revenue.other_taxes"] },
      fromYear: 2004, toYear: 2005, measure: "amount_gel",
    });
    expect(result.kind).toBe("comparisons");
    if (result.kind === "error") throw new Error(result.error.messageEn);
    const rows = (result.data as { comparisons: { comparability: string; percentageChange: number | null }[] }).comparisons;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.comparability).toBe("not_comparable");
      expect(row.percentageChange).toBeNull();
    }
  });

  it("narrows the dataset and the citations to Batumi's original workbook", () => {
    const result = getSources(snapshot, {
      sourceIds: ["source.municipal_mof_annual_and_history_workbooks"],
      datasetId: "municipal-expenditure", entityIds: ["06"], years: [2025],
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);
    const source = (result.data as { sources: { narrowingOutcome: string; documents: { documentId: string; sha256: string }[] }[] }).sources[0];
    expect(source.narrowingOutcome).toBe("applied");
    expect(source.documents).toHaveLength(1);
    expect(result.meta.sources[0].documents.map((d) => d.documentId)).toEqual(source.documents.map((d) => d.documentId));
    expect(renderText(result)).toContain(source.documents[0].sha256);
  });

  it("resolves a region's source filter to its member municipalities", () => {
    const result = getSources(snapshot, {
      sourceIds: ["source.municipal_mof_annual_and_history_workbooks"],
      entityIds: ["region.adjara"], years: [2025],
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);
    const source = (result.data as { sources: { narrowingOutcome: string; documents: { documentId: string }[] }[] }).sources[0];
    const members = snapshot.municipal.municipalities.filter((m) => m.regionId === "region.adjara");
    expect(source.narrowingOutcome).toBe("applied");
    expect(source.documents).toHaveLength(members.length);
    expect(source.documents.every((d) => members.some((m) => d.documentId.endsWith(`_${m.code}`)))).toBe(true);
  });
  it("recognizes Georgia as the country of national source documents", () => {
    const result = getSources(snapshot, { sourceIds: ["source.mof_2017_revenue_form1_pdf"], datasetId: "national-revenue", entityIds: ["country.georgia"], years: [2017] });
    if (result.kind === "error") throw new Error(result.error.messageEn);
    expect((result.data as { sources: { narrowingOutcome: string }[] }).sources[0].narrowingOutcome).toBe("applied");
  });

  it("does not silently ignore a region filter on regional rankings", () => {
    expect(rank(snapshot, {
      datasetId: "municipal-expenditure", dimension: "entities", entityType: "region",
      withinRegionId: "region.adjara", seriesId: "municipal.total", year: 2025, measure: "amount_gel", metric: "value",
    }).kind).toBe("error");
  });

  it("does not ignore a ministry filter on national rankings", () => {
    expect(rank(snapshot, {
      datasetId: "national-expenditure", dimension: "series", parentSeriesId: "does_not_exist",
      year: 2025, measure: "amount_gel", metric: "value",
    }).kind).toBe("error");
  });

  it("rejects an unsupported basis argument instead of answering actual figures", () => {
    expect(queryNational(snapshot, {
      side: "expenditure", seriesIds: ["spending.education"], years: [2025], measure: "amount_gel", basis: "planned",
    }).kind).toBe("error");
  });

  it("counts excluded requests and marks the answer partial", () => {
    const result = queryMunicipal(snapshot, { entityIds: ["06", "05"], seriesIds: ["municipal.total"], years: [2025], measure: "amount_gel" });
    expect(result.status).toBe("partial");
    if (result.kind === "error") throw new Error(result.error.messageEn);
    expect((result.data as { coverage: { expectedCount: number } }).coverage.expectedCount).toBe(2);
    expect(renderText(result)).toContain("05");
  });

  it("carries named exclusions into comparisons", () => {
    const result = compare(snapshot, {
      target: { dataset: "municipal", entityIds: ["06", "05"], seriesIds: ["municipal.total"] },
      fromYear: 2024, toYear: 2025, measure: "amount_gel",
    });
    expect(result.status).toBe("partial");
    if (result.kind === "error") throw new Error(result.error.messageEn);
    expect((result.data as { coverage: { excludedEntities: { entityId: string }[] } }).coverage.excludedEntities).toEqual([
      expect.objectContaining({ entityId: "05" }),
    ]);
    expect(renderText(result)).toContain("05");
  });

  it.each(["დღგ", "pension"])("finds the reviewed alias %s", (search) => {
    const result = describeCoverage(snapshot, { search });
    expect(result.status).toBe("ok");
    if (result.kind === "error") throw new Error(result.error.messageEn);
    expect((result.data as { series: unknown[] }).series.length).toBeGreaterThan(0);
  });

  it.each(["constructor", "__proto__"])("treats %s as ordinary search text", (search) => {
    const result = describeCoverage(snapshot, { search });
    expect(result.status).toBe("empty");
    if (result.kind === "error") throw new Error(result.error.messageEn);
    expect((result.data as { series: unknown[]; entities: unknown[] }).series).toEqual([]);
    expect((result.data as { entities: unknown[] }).entities).toEqual([]);
  });
});
