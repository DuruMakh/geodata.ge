import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
// apps/web/tests/factQuery/caveats/debt.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { CAVEAT_RULES } from "../../../lib/factQuery/caveats";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { DEBT_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.debt";

let snapshot: FactQuerySnapshot;
beforeAll(async () => { snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-05T00:00:00Z" }); });

function context(overrides: Partial<CaveatContext>): CaveatContext {
  return {
    datasetId: "government-debt",
    measure: "amount_gel",
    years: [2024],
    seriesIds: ["debt.stock.total"],
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

function observation(overrides: Partial<CaveatContext["observations"][number]>) {
  return {
    entityId: "country.georgia",
    seriesId: "debt.stock.total",
    level: "stock",
    parentSeriesId: null,
    year: 2024,
    value: 1 as number | null,
    basis: "actual" as CaveatContext["observations"][number]["basis"],
    valueDefinitionId: "government-debt:stock:amount_gel",
    ...overrides,
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(snapshot, ctx, DEBT_CAVEAT_RULES).map((c) => c.code);

describe("debt_not_budget_scope", () => {
  it("states the boundary on every debt answer", () => {
    expect(codes(context({}))).toContain("debt_not_budget_scope");
  });

  it("does not leak onto another dataset", () => {
    // The rule fires unconditionally WITHIN its dataset, so the datasetId gate
    // is the only thing keeping it off national and municipal answers.
    expect(codes(context({ datasetId: "national-revenue" }))).not.toContain("debt_not_budget_scope");
  });
});

describe("debt_service_projection", () => {
  it("is severe and names the projected cells", () => {
    const result = evaluateCaveats(snapshot,
      context({
        seriesIds: ["debt.service.total"],
        years: [2027],
        observations: [
          observation({ seriesId: "debt.service.total", level: "service", year: 2027, basis: "projection" }),
        ],
      }),
      DEBT_CAVEAT_RULES,
    );
    const caveat = result.find((c) => c.code === "debt_service_projection");

    expect(caveat?.severity).toBe("severe");
    expect(caveat?.affects).toContain("debt.service.total:2027");
  });

  it("stays silent when every served year is recorded", () => {
    expect(codes(context({ observations: [observation({})] }))).not.toContain("debt_service_projection");
  });
});

describe("debt_rate_not_published", () => {
  it("explains an unpublished rate rather than leaving the gap bare", () => {
    expect(
      codes(
        context({
          measure: "rate_percent",
          seriesIds: ["debt.rate.external"],
          years: [2016],
          observations: [
            observation({ seriesId: "debt.rate.external", level: "rate", year: 2016, value: null, basis: null }),
          ],
        }),
      ),
    ).toContain("debt_rate_not_published");
  });

  it("does not fire for a missing amount, which has its own reason", () => {
    expect(codes(context({ observations: [observation({ value: null, basis: null })] }))).not.toContain(
      "debt_rate_not_published",
    );
  });
});

describe("debt_gdp_share_vintage", () => {
  it("names the denominator only when a GDP share was asked for", () => {
    expect(codes(context({ measure: "share_of_gdp_pct" }))).toContain("debt_gdp_share_vintage");
    expect(codes(context({ measure: "amount_gel" }))).not.toContain("debt_gdp_share_vintage");
  });
});

describe("the registry", () => {
  it("carries every debt rule", () => {
    const registered = new Set(CAVEAT_RULES.map((rule) => rule.code));

    for (const rule of DEBT_CAVEAT_RULES) expect(registered).toContain(rule.code);
  });
});
