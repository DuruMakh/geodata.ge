import { describe, expect, it } from "vitest";
import { officialTotalBenchmark, OFFICIAL_TOTAL_BENCHMARKS } from "../../lib/data/officialTotalBenchmarks";

describe("official total benchmarks", () => {
  it("preserves the 2006 consolidated revenue total with its evidence", () => {
    const benchmark = officialTotalBenchmark(2006, "revenue", "revenue.total");

    expect(benchmark.amountGel).toBe(4537916325);
    expect(benchmark.sourceId).toBe("source.mof_2006_revenue_form1_pdf");
    expect(benchmark.sourceUnit).toBe("GEL");
    expect(benchmark.evidence).toContain("2006-jan-dec-consolidated-revenue.pdf");
  });

  it("throws rather than returning undefined for an unknown benchmark", () => {
    expect(() => officialTotalBenchmark(1999, "revenue", "revenue.total")).toThrow(
      "No official total benchmark for 1999 revenue revenue.total",
    );
  });

  it("keeps every benchmark uniquely keyed", () => {
    const keys = OFFICIAL_TOTAL_BENCHMARKS.map((row) => `${row.year}:${row.side}:${row.itemId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
