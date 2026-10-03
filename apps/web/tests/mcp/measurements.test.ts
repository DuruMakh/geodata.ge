import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

type Measurement = {
  name: string; sampleCount: number; warmupCount: number; requestedCells: number; returnedCount: number; rowCount: number;
  timings: Record<string, { median: number; max: number }>; universe: Record<string, number>; excludedCount: number;
  limitOutcome: string; completeBytes: number; boundedBytes: number; refusalText: string;
};
type Report = {
  snapshotBytes: number; dataVersion: string;
  cold: { samples: { pid: number; snapshotBytes: number; dataVersion: string; productCount: number; readMs: number; parseMs: number; indexMs: number; totalMs: number; processElapsedMs: number }[] };
  measurements: Measurement[];
};

describe("packaged MCP measurement CLI", () => {
  let report: Report;
  beforeAll(() => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "mcp-measurements-"));
    try {
      const output = path.join(directory, "report.json");
      execFileSync(process.execPath, ["--import", "tsx", "scripts/measure-bilingual-mcp.ts", "--output", output], {
        cwd: process.cwd(), encoding: "utf8", timeout: 60_000,
      });
      report = JSON.parse(readFileSync(output, "utf8"));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60_000);

  it("separates fresh-process read, parse and index samples from warm query costs", () => {
    expect(report.cold).toBeDefined();
    expect(report.cold.samples).toHaveLength(5);
    expect(new Set(report.cold.samples.map(sample => sample.pid)).size).toBe(5);
    for (const sample of report.cold.samples) {
      expect(sample.snapshotBytes).toBe(report.snapshotBytes);
      expect(sample.dataVersion).toBe(report.dataVersion);
      expect(sample.productCount).toBe(305);
      for (const field of ["readMs", "parseMs", "indexMs", "totalMs", "processElapsedMs"] as const) expect(sample[field]).toBeGreaterThan(0);
      expect(sample.totalMs).toBeGreaterThanOrEqual(sample.readMs + sample.parseMs + sample.indexMs);
    }
    const endpoints = report.measurements.find(sample => sample.name === "products-cumulative-endpoints")!;
    expect(endpoints.sampleCount).toBe(10);
    expect(endpoints.warmupCount).toBe(1);
    expect(endpoints.requestedCells).toBe(200);
    expect(endpoints.returnedCount).toBe(200);
    expect(endpoints.timings.queryMs.max).toBeGreaterThanOrEqual(endpoints.timings.queryMs.median);
    expect(endpoints.timings.totalMs.max).toBeGreaterThan(0);
  });

  it("retains full catalogue and ranking evidence and reports whole-result refusals", () => {
    const scenario = (name: string) => report.measurements.find(sample => sample.name === name)!;
    expect(scenario("catalogue-inflation-products").rowCount).toBe(305);
    expect(scenario("catalogue-inflation-products").limitOutcome).toBe("accepted");
    expect(scenario("products-single-history").rowCount).toBe(140);
    expect(scenario("products-annual-rank-100").universe).toMatchObject({ candidateCount: 305, eligibleCount: 305, returnedCount: 100 });
    expect(scenario("products-cumulative-rank-100").universe).toMatchObject({ candidateCount: 305, eligibleCount: 287, returnedCount: 100 });
    expect(scenario("products-missing-history-rank-100").excludedCount).toBe(18);
    expect(scenario("products-missing-history-rank-100").universe).toMatchObject({ candidateCount: 305, eligibleCount: 287, returnedCount: 100 });
    const oversized = scenario("products-500-output-cells");
    expect(oversized.requestedCells).toBe(500);
    expect(oversized.limitOutcome).toBe("byte_limit");
    expect(oversized.completeBytes).toBeGreaterThan(524_288);
    expect(oversized.boundedBytes).toBeLessThan(524_288);
    expect(oversized.refusalText).toContain("https://fiscal.ge/downloads/data/manifest.json");
    for (const sample of report.measurements) {
      expect(sample.boundedBytes).toBeLessThanOrEqual(524_288);
      if (sample.limitOutcome === "accepted") expect(sample.boundedBytes).toBe(sample.completeBytes);
    }
  });
});
