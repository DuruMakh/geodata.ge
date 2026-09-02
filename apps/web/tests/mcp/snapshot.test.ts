import { describe, expect, it } from "vitest";
import { hashDataVersion } from "../../lib/factQuery/canonical";
import { queryNational } from "../../lib/factQuery/queryNational";
import { SCHEMA_VERSION } from "../../lib/factQuery/types";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

describe("packaged snapshot", () => {
  it("loads, and its content still hashes to its own dataVersion", () => {
    const snapshot = loadPackagedSnapshot();

    expect(snapshot.schemaVersion).toBe(SCHEMA_VERSION);
    expect(snapshot.dataVersion).toMatch(/^[0-9a-f]{64}$/);
    // Proves the JSON round trip lost nothing: the digest is computed over the
    // parsed object, so any dropped or coerced value would change it.
    expect(hashDataVersion(snapshot)).toBe(snapshot.dataVersion);
  });

  it("is memoized, not re-read per call", () => {
    expect(loadPackagedSnapshot()).toBe(loadPackagedSnapshot());
  });

  it("answers a real query", () => {
    const result = queryNational(loadPackagedSnapshot(), {
      side: "expenditure",
      seriesIds: ["expenditure.total"],
      years: [2024],
      measure: "amount_gel",
    });

    expect(result.kind).toBe("observations");
  });

  it("is traced into the /mcp function bundle", async () => {
    // The artifact is written by prebuild and read at request time rather than
    // imported, so Next cannot see it statically. Without this entry the
    // deployed function has no data to answer from and every call fails.
    const { readFile } = await import("node:fs/promises");
    const config = await readFile("next.config.ts", "utf8");

    expect(config).toContain("outputFileTracingIncludes");
    expect(config).toMatch(/"\/mcp":\s*\[\s*"\.\/lib\/factQuery\/generated\/snapshot\.json"\s*\]/);
  });
});
