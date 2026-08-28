import { describe, expect, it } from "vitest";
import { canonicalize, hashDataVersion } from "../../lib/factQuery/canonical";

describe("canonicalize", () => {
  it("orders object keys so key order cannot change the hash", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("preserves array order, which is meaningful", () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it("distinguishes null from absent", () => {
    expect(canonicalize({ a: null })).not.toBe(canonicalize({}));
  });
});

describe("hashDataVersion", () => {
  it("is stable across rebuilds that change only volatile fields", () => {
    const first = hashDataVersion({ generatedAt: "2026-01-01T00:00:00Z", releaseCommit: "aaa", dataVersion: "x", rows: [1] });
    const second = hashDataVersion({ generatedAt: "2027-06-06T12:00:00Z", releaseCommit: "bbb", dataVersion: "y", rows: [1] });
    expect(first).toBe(second);
  });

  it("changes when any published value changes", () => {
    const before = hashDataVersion({ rows: [1] });
    const after = hashDataVersion({ rows: [2] });
    expect(before).not.toBe(after);
  });

  it("returns a 64-character lowercase hex digest", () => {
    expect(hashDataVersion({ rows: [] })).toMatch(/^[0-9a-f]{64}$/);
  });
});
