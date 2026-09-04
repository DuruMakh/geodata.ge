// apps/web/tests/factQuery/caveats/deficit.test.ts
import { describe, expect, it } from "vitest";
import { CAVEAT_RULES } from "../../../lib/factQuery/caveats";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { DEFICIT_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.deficit";
import { DEFICIT_SERIES_ID } from "../../../lib/factQuery/types";

function context(years: number[], basis: "actual" | "projection"): CaveatContext {
  return {
    datasetId: "general-government-balance",
    measure: "share_of_gdp_pct",
    years,
    seriesIds: [DEFICIT_SERIES_ID],
    entityIds: [],
    observations: years.map((year) => ({
      entityId: "country.georgia",
      seriesId: DEFICIT_SERIES_ID,
      level: "total",
      parentSeriesId: null,
      year,
      value: -2,
      basis,
      valueDefinitionId: "general-government-balance:share_of_gdp_pct",
    })),
    municipalTotalInputs: [],
    municipalInputServedBy: {},
    gdpInputs: [],
    comparison: null,
    historicalJoinSeriesYears: [],
    adminCategoryYears: [],
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(ctx, DEFICIT_CAVEAT_RULES).map((c) => c.code);

describe("deficit_general_government_scope", () => {
  it("says on every answer that this is not the served budget series' difference", () => {
    expect(codes(context([2020], "actual"))).toContain("deficit_general_government_scope");
  });

  it("does not leak onto another dataset", () => {
    expect(codes({ ...context([2020], "actual"), datasetId: "national-revenue" })).not.toContain(
      "deficit_general_government_scope",
    );
  });
});

describe("deficit_projection", () => {
  it("is severe and says WHY it is a projection", () => {
    const caveat = evaluateCaveats(context([2028], "projection"), DEFICIT_CAVEAT_RULES).find(
      (c) => c.code === "deficit_projection",
    );

    expect(caveat?.severity).toBe("severe");
    // A separate code from debt_service_projection on purpose: a forecast of an
    // economy is not the same kind of estimate as a schedule of obligations
    // already incurred, and the message has to carry that difference.
    expect(caveat?.messageEn).toContain("IMF");
    expect(caveat?.affects).toContain(`${DEFICIT_SERIES_ID}:2028`);
  });

  it("stays silent on a recorded year", () => {
    expect(codes(context([2020], "actual"))).not.toContain("deficit_projection");
  });
});

describe("the registry", () => {
  it("carries every deficit rule", () => {
    const registered = new Set(CAVEAT_RULES.map((rule) => rule.code));

    for (const rule of DEFICIT_CAVEAT_RULES) expect(registered).toContain(rule.code);
  });
});
