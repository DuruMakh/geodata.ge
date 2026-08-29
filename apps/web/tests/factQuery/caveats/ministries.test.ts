// apps/web/tests/factQuery/caveats/ministries.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { MINISTRIES_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.ministries";

function context(overrides: Partial<CaveatContext>): CaveatContext {
  return {
    datasetId: "ministries",
    measure: "amount_gel",
    years: [2020],
    seriesIds: [],
    entityIds: ["country.georgia"],
    observations: [],
    municipalTotalInputs: [],
    gdpInputs: [],
    comparison: null,
    historicalJoinSeriesIds: [],
    ...overrides,
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(ctx, MINISTRIES_CAVEAT_RULES).map((c) => c.code);

describe("program_coverage_partial", () => {
  it("fires when a requested program year is missing", () => {
    const ctx = context({
      years: [2015, 2020],
      observations: [
        { entityId: "country.georgia", seriesId: "p1", year: 2015, value: null, basis: null },
        { entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" },
      ],
    });
    expect(codes(ctx)).toContain("program_coverage_partial");
  });

  it("does not fire when every requested year is present", () => {
    const ctx = context({
      years: [2020],
      observations: [{ entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" }],
    });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
  });

  it("treats a genuine zero as present, not missing", () => {
    const ctx = context({
      years: [2020],
      observations: [{ entityId: "country.georgia", seriesId: "p1", year: 2020, value: 0, basis: "actual" }],
    });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
  });

  it("does not fire outside the ministries dataset even with a missing-shaped observation (a naive implementation that only checks observations, with no dataset gate, would fire here and mislabel a national gap as a 'program series' gap)", () => {
    const ctx = context({
      datasetId: "national-revenue",
      years: [2015, 2020],
      observations: [
        { entityId: "country.georgia", seriesId: "revenue.vat", year: 2015, value: null, basis: null },
        { entityId: "country.georgia", seriesId: "revenue.vat", year: 2020, value: 10, basis: "actual" },
      ],
    });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
  });
});

describe("program_historical_join", () => {
  it("fires when a requested series carries an approved historical join", () => {
    const ctx = context({
      seriesIds: ["admin_program.27 02.abcd1234"],
      historicalJoinSeriesIds: ["admin_program.27 02.abcd1234"],
    });
    expect(codes(ctx)).toContain("program_historical_join");
  });

  it("does not fire for a pre-2012 ministries query whose series carries no join (an earlier draft keyed on datasetId === 'ministries' && years.some(y => y < 2012) alone, which would fire here even though nothing requested is joined)", () => {
    const ctx = context({
      years: [2010],
      seriesIds: ["admin_spending.health_social_affairs"],
      historicalJoinSeriesIds: ["admin_program.27 02.abcd1234"],
    });
    expect(codes(ctx)).not.toContain("program_historical_join");
  });
});

describe("non_positive_comparison_base", () => {
  it("fires when the earlier endpoint is zero", () => {
    const ctx = context({
      comparison: { fromYear: 2019, toYear: 2020, fromDefinition: "x", toDefinition: "x" },
      observations: [
        { entityId: "country.georgia", seriesId: "p1", year: 2019, value: 0, basis: "actual" },
        { entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" },
      ],
    });
    expect(codes(ctx)).toContain("non_positive_comparison_base");
  });

  it("fires when the earlier endpoint is negative", () => {
    const ctx = context({
      comparison: { fromYear: 2019, toYear: 2020, fromDefinition: "x", toDefinition: "x" },
      observations: [
        { entityId: "country.georgia", seriesId: "p1", year: 2019, value: -3, basis: "actual" },
        { entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" },
      ],
    });
    expect(codes(ctx)).toContain("non_positive_comparison_base");
  });

  it("does not fire for a positive base", () => {
    const ctx = context({
      comparison: { fromYear: 2019, toYear: 2020, fromDefinition: "x", toDefinition: "x" },
      observations: [
        { entityId: "country.georgia", seriesId: "p1", year: 2019, value: 5, basis: "actual" },
        { entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" },
      ],
    });
    expect(codes(ctx)).not.toContain("non_positive_comparison_base");
  });

  it("does not fire on a percentage measure with a zero base (percentage-point change is a subtraction that never divides by the base; a naive implementation with no measure gate would fire here)", () => {
    const ctx = context({
      measure: "share_of_total_pct",
      comparison: { fromYear: 2019, toYear: 2020, fromDefinition: "x", toDefinition: "x" },
      observations: [
        { entityId: "country.georgia", seriesId: "p1", year: 2019, value: 0, basis: "actual" },
        { entityId: "country.georgia", seriesId: "p1", year: 2020, value: 5, basis: "actual" },
      ],
    });
    expect(codes(ctx)).not.toContain("non_positive_comparison_base");
  });
});
