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

  it("canonicalizes null normally", () => {
    expect(canonicalize(null)).toBe("null");
  });

  it("sorts keys of nested objects at depth >= 2", () => {
    expect(canonicalize({ outer: { b: 1, a: 2 } })).toBe('{"outer":{"a":2,"b":1}}');
    expect(canonicalize([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it("preserves array order at depth >= 2", () => {
    expect(canonicalize({ list: [2, 1] })).toBe('{"list":[2,1]}');
    expect(canonicalize([[2, 1], [3, 4]])).toBe("[[2,1],[3,4]]");
  });

  it("filters undefined object properties instead of throwing", () => {
    expect(() => canonicalize({ a: 1, b: undefined })).not.toThrow();
    expect(canonicalize({ a: 1, b: undefined })).toBe(canonicalize({ a: 1 }));
  });

  it("rejects NaN", () => {
    expect(() => canonicalize(NaN)).toThrow(/cannot hash a non-finite number \(NaN\)/);
  });

  it("rejects Infinity", () => {
    expect(() => canonicalize(Infinity)).toThrow(/cannot hash a non-finite number \(Infinity\)/);
  });

  it("rejects -Infinity", () => {
    expect(() => canonicalize(-Infinity)).toThrow(/cannot hash a non-finite number \(-Infinity\)/);
  });

  it("rejects undefined reaching the value position directly", () => {
    expect(() => canonicalize(undefined)).toThrow(/cannot hash undefined/);
    expect(() => canonicalize([undefined])).toThrow(/cannot hash undefined/);
  });

  it("rejects bigint", () => {
    expect(() => canonicalize(BigInt(1))).toThrow(/cannot hash a bigint/);
  });

  it("rejects function", () => {
    expect(() => canonicalize(() => {})).toThrow(/cannot hash a function/);
  });

  it("rejects symbol", () => {
    expect(() => canonicalize(Symbol("x"))).toThrow(/cannot hash a symbol/);
  });

  it("rejects Map", () => {
    expect(() => canonicalize(new Map([["a", 1]]))).toThrow(/cannot hash a non-plain object \(Map\)/);
  });

  it("rejects Set", () => {
    expect(() => canonicalize(new Set([1, 2]))).toThrow(/cannot hash a non-plain object \(Set\)/);
  });

  it("rejects Date", () => {
    expect(() => canonicalize(new Date())).toThrow(/cannot hash a non-plain object \(Date\)/);
  });

  it("rejects RegExp", () => {
    expect(() => canonicalize(/abc/)).toThrow(/cannot hash a non-plain object \(RegExp\)/);
  });

  it("rejects arbitrary class instances", () => {
    class Point {
      constructor(
        public x: number,
        public y: number,
      ) {}
    }
    expect(() => canonicalize(new Point(1, 2))).toThrow(/cannot hash a non-plain object \(Point\)/);
  });

  it("rejects a non-finite number nested inside an object", () => {
    expect(() => canonicalize({ ratio: Infinity })).toThrow(/cannot hash a non-finite number \(Infinity\)/);
  });

  it("rejects a Map nested inside an array", () => {
    expect(() => canonicalize([new Map()])).toThrow(/cannot hash a non-plain object \(Map\)/);
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
