import { serviceMessage } from "../../../lib/factQuery/localization";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
// apps/web/tests/factQuery/caveats/engine.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext, type CaveatRule } from "../../../lib/factQuery/caveats/engine";
import { CAVEAT_RULES } from "../../../lib/factQuery/caveats";

let snapshot: FactQuerySnapshot;
beforeAll(async () => { snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-05T00:00:00Z" }); });

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
      { code: "fires", severity: "note", comparisonEffect: "none", messageKey: "caveats.planned_values", methodologyRef: "x", methodologyRefEn: "/en/methodology/expenditure", applies: () => true, affects: () => ["a"] },
      { code: "quiet", severity: "note", comparisonEffect: "none", messageKey: "caveats.planned_values", methodologyRef: "x", methodologyRefEn: "/en/methodology/expenditure", applies: () => false, affects: () => [] },
    ];
    expect(evaluateCaveats(snapshot, BASE, rules).map((c) => c.code)).toEqual(["fires"]);
  });

  it("orders severe before note, then by code", () => {
    const rules: CaveatRule[] = [
      { code: "b_note", severity: "note", comparisonEffect: "none", messageKey: "caveats.planned_values", methodologyRef: "x", methodologyRefEn: "/en/methodology/expenditure", applies: () => true, affects: () => [] },
      { code: "a_severe", severity: "severe", comparisonEffect: "none", messageKey: "caveats.planned_values", methodologyRef: "x", methodologyRefEn: "/en/methodology/expenditure", applies: () => true, affects: () => [] },
    ];
    expect(evaluateCaveats(snapshot, BASE, rules).map((c) => c.code)).toEqual(["a_severe", "b_note"]);
  });

  it("emits each code at most once", () => {
    const rule: CaveatRule = { code: "dup", severity: "note", comparisonEffect: "none", messageKey: "caveats.planned_values", methodologyRef: "x", methodologyRefEn: "/en/methodology/expenditure", applies: () => true, affects: () => [] };
    expect(evaluateCaveats(snapshot, BASE, [rule, rule])).toHaveLength(1);
  });
});

describe("CAVEAT_RULES registry", () => {
  it("has unique codes and non-empty bilingual messages", () => {
    const codes = CAVEAT_RULES.map((rule) => rule.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const rule of CAVEAT_RULES) {
      expect(serviceMessage(snapshot, "ka", rule.messageKey).length).toBeGreaterThan(0);
      expect(serviceMessage(snapshot, "en", rule.messageKey).length).toBeGreaterThan(0);
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
  // added on 2026-09-04 when those datasets began being served, and two GDP
  // overview codes and one economic-sectors code, registered on 2026-09-14 after
  // those datasets shipped them inline.
  it("registers spec section 9.2's codes, less nominal_gel, plus the approved splits, new datasets and 2004 component guard", () => {
    expect(CAVEAT_RULES).toHaveLength(33);
    const codes = CAVEAT_RULES.map((rule) => rule.code);
    expect(codes).toContain("admin_category_not_yet_established");
    expect(codes).toContain("program_parent_category_modern_grouping");
    expect(codes).toContain("gdp_historical_method");
    expect(codes).toContain("gdp_world_bank_history");
    expect(codes).toContain("sectors_preliminary");
  });
});
