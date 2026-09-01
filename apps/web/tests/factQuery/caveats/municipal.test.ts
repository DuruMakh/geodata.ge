// apps/web/tests/factQuery/caveats/municipal.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { MUNICIPAL_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.municipal";
import type { MunicipalTotalFact } from "../../../lib/data/municipal/types";

function total(overrides: Partial<MunicipalTotalFact>): MunicipalTotalFact {
  return {
    year: 2024,
    municipalityCode: "11",
    publicTotalGel: 30969077.43,
    publicTotalMeasure: "functional_total_fallback_missing_payment_actual",
    totalPaymentsGel: null,
    expensesGel: null,
    nonfinancialAssetGrowthGel: null,
    financialAssetGrowthGel: null,
    liabilityDecreaseGel: null,
    functionalSumGel: 30969077.43,
    reconciliationDifferenceGel: null,
    warningAmountGel: null,
    showWarning: false,
    warningType: "source_actual_missing",
    basis: "actual",
    sourceId: "source.example",
    ...overrides,
  };
}

function context(overrides: Partial<CaveatContext>): CaveatContext {
  return {
    datasetId: "municipal-expenditure",
    measure: "amount_gel",
    years: [2024],
    seriesIds: ["municipal.total"],
    entityIds: ["11"],
    observations: [],
    municipalTotalInputs: [],
    gdpInputs: [],
    comparison: null,
    historicalJoinSeriesYears: [],
    adminCategoryYears: [],
    ...overrides,
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(ctx, MUNICIPAL_CAVEAT_RULES).map((c) => c.code);

describe("municipal_source_actual_missing — the Khulo 2024 regression", () => {
  it("fires even though showWarning is false", () => {
    const ctx = context({ municipalTotalInputs: [total({})] });
    expect(codes(ctx)).toContain("municipal_source_actual_missing");
  });

  it("does not fire for an ordinary clean total", () => {
    const ctx = context({
      entityIds: ["06"],
      municipalTotalInputs: [
        total({ municipalityCode: "06", warningType: "none", publicTotalMeasure: "total_payments_actual", totalPaymentsGel: 1 }),
      ],
    });
    expect(codes(ctx)).not.toContain("municipal_source_actual_missing");
  });
});

describe("other quality-state rules", () => {
  it("municipal_source_version_difference fires on that warning type", () => {
    const ctx = context({ municipalTotalInputs: [total({ warningType: "source_version_difference", showWarning: true })] });
    expect(codes(ctx)).toContain("municipal_source_version_difference");
  });
  it("municipal_source_version_difference does not fire for a different warning type (no cross-contamination)", () => {
    const ctx = context({ municipalTotalInputs: [total({ warningType: "financing_outside_functional", showWarning: true })] });
    expect(codes(ctx)).not.toContain("municipal_source_version_difference");
  });

  it("municipal_financing_outside_functional fires on that warning type", () => {
    const ctx = context({ municipalTotalInputs: [total({ warningType: "financing_outside_functional", showWarning: true })] });
    expect(codes(ctx)).toContain("municipal_financing_outside_functional");
  });
  it("municipal_financing_outside_functional does not fire for a different warning type (no cross-contamination)", () => {
    const ctx = context({ municipalTotalInputs: [total({ warningType: "source_version_difference", showWarning: true })] });
    expect(codes(ctx)).not.toContain("municipal_financing_outside_functional");
  });
});

describe("municipality_not_territorial", () => {
  it("fires when an excluded code is named", () => {
    expect(codes(context({ entityIds: ["05"] }))).toContain("municipality_not_territorial");
  });
  it("does not fire for an ordinary municipality", () => {
    expect(codes(context({ entityIds: ["11"] }))).not.toContain("municipality_not_territorial");
  });
});

describe("scope rules", () => {
  it("municipal_country_scope fires for the georgia aggregate", () => {
    expect(codes(context({ entityIds: ["country.georgia"] }))).toContain("municipal_country_scope");
  });
  it("municipal_country_scope does not fire for an ordinary region total (a naive implementation might conflate region and country aggregates)", () => {
    expect(codes(context({ entityIds: ["region.adjara"], seriesIds: ["municipal.total"] }))).not.toContain("municipal_country_scope");
  });

  it("adjara_consolidation_applied fires for the adjara region total", () => {
    expect(codes(context({ entityIds: ["region.adjara"], seriesIds: ["municipal.total"] }))).toContain("adjara_consolidation_applied");
  });
  it("adjara_consolidation_applied fires for an adjara functional category's share of total, because the denominator is the consolidated total", () => {
    expect(
      codes(context({ entityIds: ["region.adjara"], seriesIds: ["municipal.education"], measure: "share_of_total_pct" })),
    ).toContain("adjara_consolidation_applied");
  });
  it("adjara_consolidation_applied does NOT fire for a plain adjara functional-category amount (the numerator itself was never adjusted)", () => {
    expect(
      codes(context({ entityIds: ["region.adjara"], seriesIds: ["municipal.education"], measure: "amount_gel" })),
    ).not.toContain("adjara_consolidation_applied");
  });

  it("municipal_functions_no_republican_crosswalk does NOT attach to an ordinary municipality's functional query", () => {
    expect(codes(context({ entityIds: ["11"], seriesIds: ["municipal.education"] }))).not.toContain(
      "municipal_functions_no_republican_crosswalk",
    );
  });
  it("municipal_functions_no_republican_crosswalk fires for an adjara functional query", () => {
    expect(codes(context({ entityIds: ["region.adjara"], seriesIds: ["municipal.education"] }))).toContain(
      "municipal_functions_no_republican_crosswalk",
    );
  });
});

describe("national-shaped requests never trigger municipal country-scope rules", () => {
  // MUNICIPAL_COUNTRY_ID ("country.georgia") is the exact entityId spec 7.2
  // assigns every national observation (queryNational.ts). municipal_country_scope
  // and municipal_functions_no_republican_crosswalk key on that literal id with
  // no other dataset-independent condition, so without the datasetId gate a
  // national-shaped context populating entityIds with its own entity id would
  // spuriously inherit a caveat about the municipal Georgia aggregate.
  it("municipal_country_scope and municipal_functions_no_republican_crosswalk do not fire for datasetId national-revenue, even with entityIds including country.georgia", () => {
    const ctx = context({
      datasetId: "national-revenue",
      seriesIds: ["revenue.vat"],
      entityIds: ["country.georgia"],
    });
    const fired = codes(ctx);

    expect(fired).not.toContain("municipal_country_scope");
    expect(fired).not.toContain("municipal_functions_no_republican_crosswalk");
  });
});

describe("municipal_functional_total_gap", () => {
  it("fires for a share-of-total query when the functional sum leaves a reconciliation gap", () => {
    const ctx = context({
      measure: "share_of_total_pct",
      seriesIds: ["municipal.education"],
      municipalTotalInputs: [
        total({
          warningType: "financing_outside_functional",
          showWarning: true,
          publicTotalMeasure: "total_payments_actual",
          totalPaymentsGel: 1_050_000,
          functionalSumGel: 1_000_000,
          publicTotalGel: 1_050_000,
          reconciliationDifferenceGel: 50_000,
        }),
      ],
    });
    expect(codes(ctx)).toContain("municipal_functional_total_gap");
  });
  it("does not fire when the functional sum fully reconciles to the public total (a naive implementation might fire on any total row present)", () => {
    const ctx = context({
      measure: "share_of_total_pct",
      seriesIds: ["municipal.education"],
      municipalTotalInputs: [
        total({
          warningType: "none",
          showWarning: false,
          publicTotalMeasure: "total_payments_actual",
          totalPaymentsGel: 1_000_000,
          functionalSumGel: 1_000_000,
          publicTotalGel: 1_000_000,
          reconciliationDifferenceGel: 0,
        }),
      ],
    });
    expect(codes(ctx)).not.toContain("municipal_functional_total_gap");
  });
});

describe("per_resident_coverage_limited", () => {
  it("fires for a non-2025 per-resident request", () => {
    expect(codes(context({ measure: "gel_per_resident", years: [2020] }))).toContain("per_resident_coverage_limited");
  });
  it("fires for a 2025 per-resident request against a functional category, not the total", () => {
    expect(codes(context({ measure: "gel_per_resident", years: [2025], seriesIds: ["municipal.education"] }))).toContain(
      "per_resident_coverage_limited",
    );
  });
  it("fires for a 2025 total per-resident request against the country aggregate, which has no territorial population", () => {
    expect(
      codes(
        context({
          measure: "gel_per_resident",
          years: [2025],
          seriesIds: ["municipal.total"],
          entityIds: ["country.georgia"],
        }),
      ),
    ).toContain("per_resident_coverage_limited");
  });
  it("does not fire for a 2025 municipal total per-resident request", () => {
    expect(codes(context({ measure: "gel_per_resident", years: [2025], seriesIds: ["municipal.total"] }))).not.toContain(
      "per_resident_coverage_limited",
    );
  });
  it("does not fire for a 2025 region total per-resident request", () => {
    expect(
      codes(
        context({
          measure: "gel_per_resident",
          years: [2025],
          seriesIds: ["municipal.total"],
          entityIds: ["region.adjara"],
        }),
      ),
    ).not.toContain("per_resident_coverage_limited");
  });
});

describe("municipal_total_definition_changed", () => {
  it("fires when comparison endpoints use different total definitions", () => {
    const ctx = context({
      comparison: { fromYear: 2015, toYear: 2024, fromDefinition: "functional_total_fallback", toDefinition: "total_payments_actual" },
    });
    expect(codes(ctx)).toContain("municipal_total_definition_changed");
  });
  it("does not fire when both endpoints share a definition", () => {
    const ctx = context({
      comparison: { fromYear: 2020, toYear: 2024, fromDefinition: "total_payments_actual", toDefinition: "total_payments_actual" },
    });
    expect(codes(ctx)).not.toContain("municipal_total_definition_changed");
  });
});
