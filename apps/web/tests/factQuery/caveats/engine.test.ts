// apps/web/tests/factQuery/caveats/engine.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext, type CaveatRule } from "../../../lib/factQuery/caveats/engine";
import { CAVEAT_RULES } from "../../../lib/factQuery/caveats";

const BASE: CaveatContext = {
  datasetId: "national-revenue",
  measure: "amount_gel",
  years: [2020],
  seriesIds: [],
  entityIds: [],
  observations: [],
  municipalTotalInputs: [],
  gdpInputs: [],
  comparison: null,
  historicalJoinSeriesIds: [],
};

describe("evaluateCaveats", () => {
  it("returns only rules whose predicate holds", () => {
    const rules: CaveatRule[] = [
      { code: "fires", severity: "note", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => ["a"] },
      { code: "quiet", severity: "note", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => false, affects: () => [] },
    ];
    expect(evaluateCaveats(BASE, rules).map((c) => c.code)).toEqual(["fires"]);
  });

  it("orders severe before note, then by code", () => {
    const rules: CaveatRule[] = [
      { code: "b_note", severity: "note", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] },
      { code: "a_severe", severity: "severe", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] },
    ];
    expect(evaluateCaveats(BASE, rules).map((c) => c.code)).toEqual(["a_severe", "b_note"]);
  });

  it("emits each code at most once", () => {
    const rule: CaveatRule = { code: "dup", severity: "note", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] };
    expect(evaluateCaveats(BASE, [rule, rule])).toHaveLength(1);
  });
});

describe("CAVEAT_RULES registry", () => {
  it("has unique codes and non-empty bilingual messages", () => {
    const codes = CAVEAT_RULES.map((rule) => rule.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const rule of CAVEAT_RULES) {
      expect(rule.messageKa.length).toBeGreaterThan(0);
      expect(rule.messageEn.length).toBeGreaterThan(0);
      expect(rule.methodologyRef.length).toBeGreaterThan(0);
    }
  });
});
