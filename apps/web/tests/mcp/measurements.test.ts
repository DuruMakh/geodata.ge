import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
  availability: { sampleCount: number; requestedCells: number; timings: { median: number; samples: number[] } };
  memory: { distinctProductBaseKeys: number; supportedStartYears: number[]; stages: { phase: string; heapUsedBytes: number }[]; gcExposed: boolean };
  wire: { name: string; protocol: string; bytes: number; status: number; isError: boolean }[];
};

it("measures an unprimed complete query in five fresh processes with executing file identities", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "mcp-unprimed-"));
  try {
    const output = path.join(directory, "report.json");
    execFileSync(process.execPath, ["--import", "tsx", "scripts/measure-bilingual-mcp.ts", "--unprimed", "--implementation-state", "cached-test", "--output", output], {
      cwd: process.cwd(), encoding: "utf8", timeout: 60_000,
    });
    const report = JSON.parse(readFileSync(output, "utf8")) as {
      mode: string; implementationState: string; harnessSha256: string; implementationSha256: string; snapshotSha256: string;
      sampleCount: number; samples: { pid: number; dataVersion: string; input: { seriesIds: string[] }; resultBytes: number; resultSha256: string;
        harnessSha256: string; implementationSha256: string; snapshotSha256: string; readMs: number; parseMs: number; inputPreparationMs: number;
        firstQueryMs: number; shapingMs: number; serializationMs: number; queryThroughShapingMs: number; readThroughShapingMs: number; processElapsedMs: number }[];
    };
    const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
    expect(report.mode).toBe("unprimed-full-query");
    expect(report.implementationState).toBe("cached-test");
    expect(report.harnessSha256).toBe(hash("scripts/measure-bilingual-mcp.ts"));
    expect(report.implementationSha256).toBe(hash("lib/factQuery/inflationProductData.ts"));
    expect(report.snapshotSha256).toBe(hash("lib/factQuery/generated/snapshot.json"));
    expect(report.sampleCount).toBe(5);
    expect(new Set(report.samples.map(sample => sample.pid)).size).toBe(5);
    expect(new Set(report.samples.map(sample => sample.resultSha256)).size).toBe(1);
    for (const sample of report.samples) {
      expect(sample.harnessSha256).toBe(report.harnessSha256);
      expect(sample.implementationSha256).toBe(report.implementationSha256);
      expect(sample.snapshotSha256).toBe(report.snapshotSha256);
      expect(sample.input.seriesIds).toHaveLength(200);
      expect(sample.resultBytes).toBeLessThanOrEqual(524_288);
      for (const field of ["readMs", "parseMs", "inputPreparationMs", "firstQueryMs", "shapingMs", "serializationMs"] as const) expect(sample[field]).toBeGreaterThan(0);
      expect(sample.queryThroughShapingMs).toBeGreaterThanOrEqual(sample.firstQueryMs + sample.shapingMs + sample.serializationMs - 0.001);
      expect(sample.readThroughShapingMs).toBeGreaterThan(sample.queryThroughShapingMs);
      expect(sample.processElapsedMs).toBeGreaterThan(sample.readThroughShapingMs);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);

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
    const catalogue = report.measurements.find(sample => sample.name === "catalogue-inflation-products")!;
    for (const sample of report.cold.samples) {
      expect(sample.snapshotBytes).toBe(report.snapshotBytes);
      expect(sample.dataVersion).toBe(report.dataVersion);
      // Relations, not pinned counts, so a data refresh does not break the evidence check.
      expect(sample.productCount).toBe(catalogue.rowCount);
      for (const field of ["readMs", "parseMs", "indexMs", "totalMs", "processElapsedMs", "firstAvailabilityMs", "firstQueryMs", "firstShapingMs"] as const) expect((sample as unknown as Record<string, number>)[field]).toBeGreaterThan(0);
      expect(sample.totalMs).toBeGreaterThanOrEqual(sample.readMs + sample.parseMs + sample.indexMs);
    }
    const endpoints = report.measurements.find(sample => sample.name === "products-cumulative-endpoints")!;
    expect(endpoints.sampleCount).toBeGreaterThanOrEqual(21);
    expect(endpoints.warmupCount).toBe(1);
    expect(endpoints.requestedCells).toBe(200);
    expect(endpoints.returnedCount).toBe(200);
    expect(endpoints.timings.queryMs.max).toBeGreaterThanOrEqual(endpoints.timings.queryMs.median);
    expect(endpoints.timings.totalMs.max).toBeGreaterThan(0);
    expect(report.availability.sampleCount).toBeGreaterThanOrEqual(21);
    expect(report.availability.requestedCells).toBe(200);
    expect(report.availability.timings.samples).toHaveLength(report.availability.sampleCount);
    expect(report.memory.distinctProductBaseKeys).toBeGreaterThan(200);
    expect(report.memory.supportedStartYears.length).toBeGreaterThan(1);
    expect(report.memory.gcExposed).toBe(true);
    expect(report.memory.stages.map(stage => stage.phase)).toEqual(["loaded", "indexed", "representative-warm", "distinct-keys", "repeat-keys"]);
    for (const name of ["product-search-milk", "product-search-rice", "city-discovery-batumi", "catalogue-inflation-products", "products-500-output-cells"]) {
      const wire = report.wire.filter(sample => sample.name === name);
      expect(wire.map(sample => sample.protocol)).toEqual(["2025-11-25", "2026-07-28"]);
      expect(wire.every(sample => sample.status === 200 && sample.bytes <= 524_288)).toBe(true);
      if (name.startsWith("product-search")) expect(wire.every(sample => sample.bytes < 65_536 && !sample.isError)).toBe(true);
    }
  });

  it("retains full catalogue and ranking evidence and reports whole-result refusals", () => {
    const scenario = (name: string) => report.measurements.find(sample => sample.name === name)!;
    // Relations, not pinned counts, so a data refresh does not break the evidence check.
    const products = scenario("catalogue-inflation-products").rowCount;
    expect(products).toBeGreaterThan(100);
    expect(scenario("catalogue-inflation-products").limitOutcome).toBe("accepted");
    expect(scenario("products-single-history").rowCount).toBeGreaterThan(0);
    expect(scenario("products-single-history").rowCount).toBe(scenario("products-single-history").returnedCount);
    expect(scenario("products-annual-rank-100").universe).toMatchObject({ candidateCount: products, eligibleCount: products, returnedCount: 100 });
    for (const name of ["products-cumulative-rank-100", "products-missing-history-rank-100"]) {
      const { universe, excludedCount } = scenario(name);
      expect(universe, name).toMatchObject({ candidateCount: products, returnedCount: 100 });
      expect(excludedCount, name).toBeGreaterThan(0);
      expect(universe.eligibleCount, name).toBe(universe.candidateCount - excludedCount);
    }
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
