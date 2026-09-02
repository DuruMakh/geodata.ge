// apps/web/tests/factQuery/caveats/national.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { NATIONAL_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.national";

function context(overrides: Partial<CaveatContext>): CaveatContext {
  return {
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
    ...overrides,
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(ctx, NATIONAL_CAVEAT_RULES).map((c) => c.code);

describe("nominal_gel", () => {
  it("fires for a multi-year GEL request", () => {
    expect(codes(context({ years: [2018, 2020] }))).toContain("nominal_gel");
  });
  it("does not fire for a single year", () => {
    expect(codes(context({ years: [2020] }))).not.toContain("nominal_gel");
  });
  it("does not fire for a percentage measure", () => {
    expect(codes(context({ years: [2018, 2020], measure: "share_of_gdp_pct" }))).not.toContain("nominal_gel");
  });
});

describe("revenue_2004_total_scope", () => {
  it("fires when a 2004 revenue total is requested", () => {
    expect(codes(context({ years: [2004], seriesIds: ["revenue.total"] }))).toContain("revenue_2004_total_scope");
  });
  it("does NOT fire for an individual 2004 tax category", () => {
    expect(codes(context({ years: [2004], seriesIds: ["revenue.vat"] }))).not.toContain("revenue_2004_total_scope");
  });
  it("does NOT fire for a 2004 expenditure total", () => {
    expect(
      codes(context({ datasetId: "national-expenditure", years: [2004], seriesIds: ["expenditure.total"] })),
    ).not.toContain("revenue_2004_total_scope");
  });
  it("fires for a 2004 revenue category as share_of_total_pct (the total is its denominator)", () => {
    expect(
      codes(context({ years: [2004], seriesIds: ["revenue.vat"], measure: "share_of_total_pct" })),
    ).toContain("revenue_2004_total_scope");
  });
  it("does NOT fire for a 2004 expenditure share_of_total_pct (different total, no gap)", () => {
    expect(
      codes(
        context({
          datasetId: "national-expenditure",
          years: [2004],
          seriesIds: ["expenditure.total"],
          measure: "share_of_total_pct",
        }),
      ),
    ).not.toContain("revenue_2004_total_scope");
  });
});

describe("revenue_2004_liabilities_unavailable", () => {
  it("fires when 2004 liabilities are requested", () => {
    expect(codes(context({ years: [2004], seriesIds: ["revenue.increase_liabilities"] }))).toContain(
      "revenue_2004_liabilities_unavailable",
    );
  });
  it("does not fire for 2005 liabilities", () => {
    expect(codes(context({ years: [2005], seriesIds: ["revenue.increase_liabilities"] }))).not.toContain(
      "revenue_2004_liabilities_unavailable",
    );
  });
  it("does not fire for 2004 when liabilities are not the requested series", () => {
    expect(codes(context({ years: [2004], seriesIds: ["revenue.vat"] }))).not.toContain(
      "revenue_2004_liabilities_unavailable",
    );
  });
});

describe("budget_scopes_differ", () => {
  it("fires for a national total on either side", () => {
    expect(codes(context({ seriesIds: ["revenue.total"] }))).toContain("budget_scopes_differ");
    expect(codes(context({ datasetId: "national-expenditure", seriesIds: ["expenditure.total"] }))).toContain("budget_scopes_differ");
  });
  it("does not fire for a category", () => {
    expect(codes(context({ seriesIds: ["revenue.vat"] }))).not.toContain("budget_scopes_differ");
  });
});

describe("revenue_internal_flows_netted", () => {
  it("fires for 2008, the first netted year", () => {
    expect(codes(context({ years: [2008], seriesIds: ["revenue.grants"] }))).toContain(
      "revenue_internal_flows_netted",
    );
  });
  it("does not fire for 2007, the last un-netted (old-code) year", () => {
    expect(codes(context({ years: [2007], seriesIds: ["revenue.other_revenue"] }))).not.toContain(
      "revenue_internal_flows_netted",
    );
  });
  it("does not fire for 2004, the reviewed-panel year (also unnetted, different reason)", () => {
    expect(codes(context({ years: [2004], seriesIds: ["revenue.grants"] }))).not.toContain(
      "revenue_internal_flows_netted",
    );
  });
  it("does not fire for a netted year when the series is not grants/other_revenue", () => {
    expect(codes(context({ years: [2020], seriesIds: ["revenue.vat"] }))).not.toContain(
      "revenue_internal_flows_netted",
    );
  });
});

describe("gdp caveats", () => {
  it("gdp_sna_break_2010 fires across the standard change", () => {
    const ctx = context({
      measure: "share_of_gdp_pct",
      years: [2009, 2010],
      gdpInputs: [
        { year: 2009, gdpCurrentPricesGel: 1, accountingStandard: "sna_1993", status: "final_as_published", sourceId: "s" },
        { year: 2010, gdpCurrentPricesGel: 1, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "s" },
      ],
    });
    expect(codes(ctx)).toContain("gdp_sna_break_2010");
  });

  it("gdp_sna_break_2010 does NOT fire for 2010 alone", () => {
    const ctx = context({
      measure: "share_of_gdp_pct",
      years: [2010],
      gdpInputs: [{ year: 2010, gdpCurrentPricesGel: 1, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "s" }],
    });
    expect(codes(ctx)).not.toContain("gdp_sna_break_2010");
  });

  it("gdp_preliminary fires when a denominator is preliminary", () => {
    const ctx = context({
      measure: "share_of_gdp_pct",
      years: [2025],
      gdpInputs: [{ year: 2025, gdpCurrentPricesGel: 1, accountingStandard: "sna_2008", status: "preliminary", sourceId: "s" }],
    });
    expect(codes(ctx)).toContain("gdp_preliminary");
  });

  it("gdp_preliminary does NOT fire when the denominator is final", () => {
    const ctx = context({
      measure: "share_of_gdp_pct",
      years: [2020],
      gdpInputs: [{ year: 2020, gdpCurrentPricesGel: 1, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "s" }],
    });
    expect(codes(ctx)).not.toContain("gdp_preliminary");
  });
});

describe("value-driven rules", () => {
  it("negative_revenue_correction fires on a negative observation", () => {
    const ctx = context({ observations: [{ entityId: "country.georgia", seriesId: "revenue.other_revenue", level: "public_field", parentSeriesId: null, year: 2020, value: -5, basis: "actual", valueDefinitionId: "national-revenue:amount_gel:component" }] });
    expect(codes(ctx)).toContain("negative_revenue_correction");
  });
  it("does not fire when all values are non-negative", () => {
    const ctx = context({ observations: [{ entityId: "country.georgia", seriesId: "revenue.vat", level: "public_field", parentSeriesId: null, year: 2020, value: 5, basis: "actual", valueDefinitionId: "national-revenue:amount_gel:component" }] });
    expect(codes(ctx)).not.toContain("negative_revenue_correction");
  });
  it("planned_values fires when any returned basis is planned", () => {
    const ctx = context({ observations: [{ entityId: "country.georgia", seriesId: "revenue.vat", level: "public_field", parentSeriesId: null, year: 2026, value: 5, basis: "planned", valueDefinitionId: "national-revenue:amount_gel:component" }] });
    expect(codes(ctx)).toContain("planned_values");
  });
  it("planned_values does not fire when all returned bases are actual", () => {
    const ctx = context({ observations: [{ entityId: "country.georgia", seriesId: "revenue.vat", level: "public_field", parentSeriesId: null, year: 2020, value: 5, basis: "actual", valueDefinitionId: "national-revenue:amount_gel:component" }] });
    expect(codes(ctx)).not.toContain("planned_values");
  });
});
