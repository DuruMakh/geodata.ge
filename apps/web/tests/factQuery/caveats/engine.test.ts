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
  municipalInputServedBy: {},
  gdpInputs: [],
  comparison: null,
  historicalJoinSeriesYears: [],
  adminCategoryYears: [],
};

describe("evaluateCaveats", () => {
  it("returns only rules whose predicate holds", () => {
    const rules: CaveatRule[] = [
      { code: "fires", severity: "note", comparisonEffect: "none", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => ["a"] },
      { code: "quiet", severity: "note", comparisonEffect: "none", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => false, affects: () => [] },
    ];
    expect(evaluateCaveats(BASE, rules).map((c) => c.code)).toEqual(["fires"]);
  });

  it("orders severe before note, then by code", () => {
    const rules: CaveatRule[] = [
      { code: "b_note", severity: "note", comparisonEffect: "none", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] },
      { code: "a_severe", severity: "severe", comparisonEffect: "none", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] },
    ];
    expect(evaluateCaveats(BASE, rules).map((c) => c.code)).toEqual(["a_severe", "b_note"]);
  });

  it("emits each code at most once", () => {
    const rule: CaveatRule = { code: "dup", severity: "note", comparisonEffect: "none", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] };
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

  // Spec section 9.2 names 22 codes. Two of them each cover two situations that
  // need different messages and different methodology documents, so each is split
  // in two here (caveats/index.ts documents the split): program_coverage_partial
  // keeps the major_program case and admin_category_not_yet_established takes the
  // admin_category one; program_historical_join keeps the join disclosure and
  // program_parent_category_modern_grouping takes the parent-attribution one.
  //
  // nominal_gel was retired on 2026-09-04: true of every GEL figure in every
  // year, so it qualified nothing in particular while crowding the caveats that
  // did. See rules.national.ts.
  // Plus four government-debt codes and two general-government-balance codes,
  // added on 2026-09-04 when those datasets began being served.
  it("registers spec section 9.2's codes, less nominal_gel, plus the two approved splits and the two new datasets", () => {
    expect(CAVEAT_RULES).toHaveLength(29);
    const codes = CAVEAT_RULES.map((rule) => rule.code);
    expect(codes).toContain("admin_category_not_yet_established");
    expect(codes).toContain("program_parent_category_modern_grouping");
  });
});
