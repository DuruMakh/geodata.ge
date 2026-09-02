// apps/web/tests/factQuery/caveats/ministries.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { MINISTRIES_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.ministries";

type ContextObservation = CaveatContext["observations"][number];

function context(overrides: Partial<CaveatContext>): CaveatContext {
  return {
    datasetId: "ministries",
    measure: "amount_gel",
    years: [2020],
    seriesIds: [],
    entityIds: ["country.georgia"],
    observations: [],
    municipalTotalInputs: [],
    municipalInputServedBy: {},
    gdpInputs: [],
    comparison: null,
    historicalJoinSeriesYears: [],
    adminCategoryYears: [],
    ...overrides,
  };
}

function observation(overrides: Partial<ContextObservation>): ContextObservation {
  return {
    entityId: "country.georgia",
    seriesId: "p1",
    level: "major_program",
    parentSeriesId: null,
    valueDefinitionId: "ministries:amount_gel:major_program",
    year: 2020,
    value: 10,
    basis: "actual",
    ...overrides,
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(ctx, MINISTRIES_CAVEAT_RULES).map((c) => c.code);
const affectsOf = (ctx: CaveatContext, code: string) =>
  evaluateCaveats(ctx, MINISTRIES_CAVEAT_RULES).find((c) => c.code === code)?.affects;

describe("program_coverage_partial", () => {
  it("fires when a requested program year is missing", () => {
    const ctx = context({
      years: [2015, 2020],
      observations: [observation({ year: 2015, value: null, basis: null }), observation({ year: 2020 })],
    });
    expect(codes(ctx)).toContain("program_coverage_partial");
  });

  it("does not fire when every requested year is present", () => {
    const ctx = context({ years: [2020], observations: [observation({})] });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
  });

  it("treats a genuine zero as present, not missing", () => {
    const ctx = context({ years: [2020], observations: [observation({ value: 0 })] });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
  });

  it("does not fire outside the ministries dataset even with a missing-shaped observation (a naive implementation that only checks observations, with no dataset gate, would fire here and mislabel a national gap as a 'program series' gap)", () => {
    const ctx = context({
      datasetId: "national-revenue",
      years: [2015, 2020],
      observations: [
        observation({ seriesId: "revenue.vat", level: "public_field", year: 2015, value: null, basis: null }),
        observation({ seriesId: "revenue.vat", level: "public_field", year: 2020 }),
      ],
    });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
  });

  // Both of this rule's messages say "the requested PROGRAM series", and its
  // methodologyRef is the programs document, so an admin_category gap is not its case:
  // admin_spending.regional_development_infrastructure has no row before 2009, and this
  // severe caveat used to land on that cell with no program anywhere in the request.
  it("does not fire on a missing admin_category cell: that is a different code's case", () => {
    const ctx = context({
      years: [2004],
      seriesIds: ["admin_spending.regional_development_infrastructure"],
      observations: [
        observation({
          seriesId: "admin_spending.regional_development_infrastructure",
          level: "admin_category",
          year: 2004,
          value: null,
          basis: null,
        }),
      ],
    });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
    expect(codes(ctx)).toContain("admin_category_not_yet_established");
  });
});

describe("admin_category_not_yet_established", () => {
  it("fires on a missing admin_category cell and pins to that cell only", () => {
    const ctx = context({
      years: [2004, 2020],
      seriesIds: ["admin_spending.regional_development_infrastructure"],
      observations: [
        observation({
          seriesId: "admin_spending.regional_development_infrastructure",
          level: "admin_category",
          year: 2004,
          value: null,
          basis: null,
        }),
        observation({ seriesId: "admin_spending.regional_development_infrastructure", level: "admin_category", year: 2020 }),
      ],
    });
    expect(codes(ctx)).toContain("admin_category_not_yet_established");
    expect(affectsOf(ctx, "admin_category_not_yet_established")).toEqual([
      "admin_spending.regional_development_infrastructure:2004",
    ]);
  });

  it("does not fire on a missing major_program cell: that is program_coverage_partial's case", () => {
    const ctx = context({ years: [2004], observations: [observation({ year: 2004, value: null, basis: null })] });
    expect(codes(ctx)).not.toContain("admin_category_not_yet_established");
    expect(codes(ctx)).toContain("program_coverage_partial");
  });

  it("does not fire outside the ministries dataset", () => {
    const ctx = context({
      datasetId: "national-revenue",
      observations: [observation({ seriesId: "revenue.vat", level: "admin_category", value: null, basis: null })],
    });
    expect(codes(ctx)).not.toContain("admin_category_not_yet_established");
  });
});

describe("program_historical_join", () => {
  const JOINED = "admin_program.09_01.f5bec61a";
  const JOIN_YEARS = [2006, 2007, 2008, 2009, 2010, 2011].map((year) => `${JOINED}:${year}`);

  it("fires when a requested series carries an approved historical join", () => {
    const ctx = context({
      years: [2011],
      seriesIds: [JOINED],
      historicalJoinSeriesYears: JOIN_YEARS,
      observations: [observation({ seriesId: JOINED, year: 2011 })],
    });
    expect(codes(ctx)).toContain("program_historical_join");
  });

  it("does not fire for a pre-2012 ministries query whose series carries no join (an earlier draft keyed on datasetId === 'ministries' && years.some(y => y < 2012) alone, which would fire here even though nothing requested is joined)", () => {
    const ctx = context({
      years: [2010],
      seriesIds: ["admin_spending.health_social_affairs"],
      historicalJoinSeriesYears: JOIN_YEARS,
    });
    expect(codes(ctx)).not.toContain("program_historical_join");
  });

  // The defect this rule shipped with: affects() returned the bare seriesId, so the
  // note pinned to every year of a joined series, including the years it serves from
  // its own official code.
  it("pins to the joined years only, never to the same series' native years", () => {
    const ctx = context({
      years: [2011, 2020],
      seriesIds: [JOINED],
      historicalJoinSeriesYears: JOIN_YEARS,
      observations: [observation({ seriesId: JOINED, year: 2011 }), observation({ seriesId: JOINED, year: 2020 })],
    });

    expect(codes(ctx)).toContain("program_historical_join");
    expect(affectsOf(ctx, "program_historical_join")).toEqual([`${JOINED}:2011`]);
  });

  it("never pins to a missing cell: a preserved scope and label describe a value that was returned", () => {
    const ctx = context({
      years: [2006],
      seriesIds: [JOINED],
      historicalJoinSeriesYears: JOIN_YEARS,
      observations: [observation({ seriesId: JOINED, year: 2006, value: null, basis: null })],
    });

    expect(codes(ctx)).toContain("program_historical_join");
    expect(affectsOf(ctx, "program_historical_join")).toEqual([]);
  });
});

describe("program_parent_category_modern_grouping", () => {
  const ROADS = "admin_program.25_02.4cffd876";
  const REGIONAL = "admin_spending.regional_development_infrastructure";

  it("fires when a served program's parent category has no row of its own that year", () => {
    const ctx = context({
      years: [2006, 2020],
      seriesIds: [ROADS],
      adminCategoryYears: [`${REGIONAL}:2020`],
      observations: [
        observation({ seriesId: ROADS, parentSeriesId: REGIONAL, year: 2006 }),
        observation({ seriesId: ROADS, parentSeriesId: REGIONAL, year: 2020 }),
      ],
    });

    expect(codes(ctx)).toContain("program_parent_category_modern_grouping");
    expect(affectsOf(ctx, "program_parent_category_modern_grouping")).toEqual([`${ROADS}:2006`]);
  });

  it("does not fire when the parent category is served in the same year", () => {
    const ctx = context({
      years: [2020],
      seriesIds: [ROADS],
      adminCategoryYears: [`${REGIONAL}:2020`],
      observations: [observation({ seriesId: ROADS, parentSeriesId: REGIONAL, year: 2020 })],
    });
    expect(codes(ctx)).not.toContain("program_parent_category_modern_grouping");
  });

  it("does not fire on a missing program cell, which asserts no parent attribution at all", () => {
    const ctx = context({
      years: [2005],
      seriesIds: [ROADS],
      adminCategoryYears: [],
      observations: [observation({ seriesId: ROADS, parentSeriesId: REGIONAL, year: 2005, value: null, basis: null })],
    });
    expect(codes(ctx)).not.toContain("program_parent_category_modern_grouping");
  });

  it("does not fire for an admin_category observation, which names no parent", () => {
    const ctx = context({
      years: [2020],
      seriesIds: [REGIONAL],
      adminCategoryYears: [],
      observations: [observation({ seriesId: REGIONAL, level: "admin_category", year: 2020 })],
    });
    expect(codes(ctx)).not.toContain("program_parent_category_modern_grouping");
  });
});

describe("non_positive_comparison_base", () => {
  it("fires when the earlier endpoint is zero", () => {
    const ctx = context({
      comparison: { fromYear: 2019, toYear: 2020 },
      observations: [observation({ year: 2019, value: 0 }), observation({ year: 2020 })],
    });
    expect(codes(ctx)).toContain("non_positive_comparison_base");
  });

  it("fires when the earlier endpoint is negative", () => {
    const ctx = context({
      comparison: { fromYear: 2019, toYear: 2020 },
      observations: [observation({ year: 2019, value: -3 }), observation({ year: 2020 })],
    });
    expect(codes(ctx)).toContain("non_positive_comparison_base");
  });

  it("does not fire for a positive base", () => {
    const ctx = context({
      comparison: { fromYear: 2019, toYear: 2020 },
      observations: [observation({ year: 2019, value: 5 }), observation({ year: 2020 })],
    });
    expect(codes(ctx)).not.toContain("non_positive_comparison_base");
  });

  it("does not fire on a percentage measure with a zero base (percentage-point change is a subtraction that never divides by the base; a naive implementation with no measure gate would fire here)", () => {
    const ctx = context({
      measure: "share_of_total_pct",
      comparison: { fromYear: 2019, toYear: 2020 },
      observations: [observation({ year: 2019, value: 0 }), observation({ year: 2020, value: 5 })],
    });
    expect(codes(ctx)).not.toContain("non_positive_comparison_base");
  });
});
