// apps/web/tests/factQuery/queryNational.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { queryNational } from "../../lib/factQuery/queryNational";
import { envelopeSchema, observationSchema } from "../../lib/factQuery/schemas";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

type ObservationRow = {
  observationId: string;
  datasetId: string;
  budgetScope: string;
  entityId: string;
  entityType: string;
  entityLabelKa: string;
  entitySlug: string | null;
  seriesId: string;
  seriesLabelKa: string;
  level: string;
  parentSeriesId: string | null;
  year: number;
  measure: string;
  unit: string;
  value: number | null;
  availability: string;
  missingReason: string | null;
  basis: string | null;
  valueDefinition: string;
  sourceIds: string[];
  documentIds: string[];
  caveatIds: string[];
};

type ObservationsData = {
  observations: ObservationRow[];
  coverage: {
    requestedYears: number[];
    availableYears: number[];
    returnedYears: number[];
    missingCells: { entityId: string; seriesId: string; year: number; reason: string }[];
    excludedEntities: { entityId: string; reason: string }[];
    returnedCount: number;
    expectedCount: number;
  };
};

const data = (result: ReturnType<typeof queryNational>) => (result as { data: ObservationsData }).data;
const errorOf = (result: ReturnType<typeof queryNational>) =>
  (result as { error: { code: string; validChoices?: string[] } }).error;

describe("queryNational", () => {
  it("returns a conforming observations envelope with per-observation schema validity", () => {
    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [2020], measure: "amount_gel" });
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("observations");

    for (const observation of data(result).observations) {
      expect(observationSchema.parse(observation)).toBeTruthy();
    }
  });

  it("serves revenue.vat for a known year at the snapshot's exact fact amount", () => {
    const fact = snapshot.national.facts.find((f) => f.side === "revenue" && f.itemId === "revenue.vat" && f.year === 2020);
    expect(fact).toBeDefined();

    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [2020], measure: "amount_gel" });
    const observation = data(result).observations.find((o) => o.seriesId === "revenue.vat" && o.year === 2020);

    expect(observation?.value).toBe(fact?.amountGel);
    expect(observation?.availability).toBe("available");
    expect(observation?.unit).toBe("GEL");
  });

  it("gives revenue and expenditure different budgetScope values", () => {
    const revenue = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [2020], measure: "amount_gel" });
    const expenditure = queryNational(snapshot, {
      side: "expenditure",
      seriesIds: ["spending.other_unclassified"],
      years: [2020],
      measure: "amount_gel",
    });

    const revenueScope = data(revenue).observations[0]?.budgetScope;
    const expenditureScope = data(expenditure).observations[0]?.budgetScope;

    expect(revenueScope).toBeTruthy();
    expect(expenditureScope).toBeTruthy();
    expect(revenueScope).not.toBe(expenditureScope);
  });

  it("returns 2004 increase-in-liabilities as missing, never zero", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.increase_liabilities"],
      years: [2004],
      measure: "amount_gel",
    });
    const observation = data(result).observations[0];

    expect(observation?.availability).toBe("missing");
    expect(observation?.value).toBeNull();
    expect(observation?.value).not.toBe(0);
    expect(observation?.missingReason).toBeTruthy();
    expect(observation?.basis).toBeNull();
  });

  it("distinguishes a genuine zero from a missing value", () => {
    const zeroFact = snapshot.national.facts.find((f) => f.amountGel === 0);

    if (zeroFact) {
      const result = queryNational(snapshot, {
        side: zeroFact.side,
        seriesIds: [zeroFact.itemId],
        years: [zeroFact.year],
        measure: "amount_gel",
      });
      const observation = data(result).observations[0];

      expect(observation?.availability).toBe("available");
      expect(observation?.value).toBe(0);
    } else {
      const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [2020], measure: "amount_gel" });
      for (const observation of data(result).observations) {
        if (observation.availability === "available") expect(observation.value).not.toBeNull();
      }
    }
  });

  it("computes revenue.total as the sum of that year's component facts", () => {
    const year = 2020;
    const expected = snapshot.national.facts
      .filter((f) => f.side === "revenue" && f.year === year)
      .reduce((sum, f) => sum + f.amountGel, 0);

    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.total"], years: [year], measure: "amount_gel" });
    const observation = data(result).observations[0];

    expect(observation?.availability).toBe("available");
    expect(observation?.value).toBeCloseTo(expected, 2);
    expect(observation?.level).toBe("total");
  });

  it("rejects the other side's total under a given side, never blending revenue and expenditure", () => {
    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["expenditure.total"], years: [2020], measure: "amount_gel" });

    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("unknown_series");
  });

  it("rejects revenue.taxes_total as unknown_series, not a queryable total", () => {
    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.taxes_total"], years: [2020], measure: "amount_gel" });

    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("unknown_series");
  });

  it("rejects a year outside dataset coverage without clamping", () => {
    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [1999], measure: "amount_gel" });

    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("year_out_of_range");
    expect("data" in result).toBe(false);
  });

  it("computes share_of_gdp_pct as amount / gdp * 100 on a 0-100 scale", () => {
    const year = 2020;
    const fact = snapshot.national.facts.find((f) => f.side === "revenue" && f.itemId === "revenue.vat" && f.year === year);
    const gdp = snapshot.gdpFacts.find((f) => f.year === year);
    expect(fact).toBeDefined();
    expect(gdp).toBeDefined();

    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [year], measure: "share_of_gdp_pct" });
    const observation = data(result).observations[0];
    const expected = (fact!.amountGel / gdp!.gdpCurrentPricesGel) * 100;

    expect(observation?.availability).toBe("available");
    expect(observation?.value).toBe(expected);
    expect(observation?.value as number).toBeGreaterThan(0);
    expect(observation?.value as number).toBeLessThan(100);
    expect(observation?.unit).toBe("percent");
  });

  it("uses the applicable total as the share_of_total_pct denominator, not the selected series' own sum", () => {
    const year = 2020;
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.vat", "revenue.income_tax"],
      years: [year],
      measure: "share_of_total_pct",
    });

    const vat = data(result).observations.find((o) => o.seriesId === "revenue.vat");
    const incomeTax = data(result).observations.find((o) => o.seriesId === "revenue.income_tax");

    expect(vat?.value).not.toBeNull();
    expect(incomeTax?.value).not.toBeNull();
    expect((vat!.value as number) + (incomeTax!.value as number)).not.toBeCloseTo(100, 5);
    for (const value of [vat!.value, incomeTax!.value]) {
      expect(value as number).toBeGreaterThan(0);
      expect(value as number).toBeLessThan(100);
    }
  });

  it("keeps a negative revenue correction visible and unclamped in share_of_total_pct", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.other_taxes"],
      years: [2020],
      measure: "share_of_total_pct",
    });
    const observation = data(result).observations[0];

    expect(observation?.availability).toBe("available");
    expect(observation?.value as number).toBeLessThan(0);
  });

  it("warns that revenue and expenditure totals do not form a deficit when a total is requested", () => {
    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.total"], years: [2020], measure: "amount_gel" });
    expect(result.meta.caveats.map((c) => c.code)).toContain("budget_scopes_differ");
  });

  it("carries revenue_2004_total_scope for a 2004 total but not a 2004 VAT-only request", () => {
    const total = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.total"], years: [2004], measure: "amount_gel" });
    const vat = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [2004], measure: "amount_gel" });

    expect(total.meta.caveats.map((c) => c.code)).toContain("revenue_2004_total_scope");
    expect(vat.meta.caveats.map((c) => c.code)).not.toContain("revenue_2004_total_scope");
  });

  it("attaches revenue_2004_total_scope only to the total observation, not a VAT observation requested alongside it", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.total", "revenue.vat"],
      years: [2004],
      measure: "amount_gel",
    });

    const total = data(result).observations.find((o) => o.seriesId === "revenue.total");
    const vat = data(result).observations.find((o) => o.seriesId === "revenue.vat");

    expect(total?.caveatIds).toContain("revenue_2004_total_scope");
    expect(vat?.caveatIds).not.toContain("revenue_2004_total_scope");
  });

  it("attaches revenue_2004_total_scope to every requested series under share_of_total_pct, since all of them divide by the narrower total", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.vat"],
      years: [2004],
      measure: "share_of_total_pct",
    });

    const vat = data(result).observations.find((o) => o.seriesId === "revenue.vat");
    expect(vat?.caveatIds).toContain("revenue_2004_total_scope");
  });

  it("does not attach revenue_internal_flows_netted to a pre-2008 observation of a netted series requested alongside a post-2008 one", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.grants"],
      years: [2005, 2020],
      measure: "amount_gel",
    });

    const y2005 = data(result).observations.find((o) => o.year === 2005);
    const y2020 = data(result).observations.find((o) => o.year === 2020);

    expect(y2005?.caveatIds).not.toContain("revenue_internal_flows_netted");
    expect(y2020?.caveatIds).toContain("revenue_internal_flows_netted");
    // The caveat is still relevant to the request as a whole - it correctly
    // affects part of it - so it still belongs in the request-level list.
    expect(result.meta.caveats.map((c) => c.code)).toContain("revenue_internal_flows_netted");
  });

  it("reports requested, available and returned years plus missing cells", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.increase_liabilities"],
      years: [2004, 2005],
      measure: "amount_gel",
    });

    const coverage = data(result).coverage;
    expect(coverage.requestedYears).toEqual([2004, 2005]);
    expect(coverage.availableYears).toContain(2004);
    expect(coverage.availableYears).toContain(2025);
    expect(coverage.returnedYears).toEqual([2005]);
    expect(coverage.expectedCount).toBe(2);
    expect(coverage.returnedCount).toBe(1);
    expect(coverage.missingCells).toEqual([
      { entityId: "country.georgia", seriesId: "revenue.increase_liabilities", year: 2004, reason: expect.any(String) },
    ]);
    expect(result.status).toBe("partial");
  });

  it("returns non-empty, fully resolvable sources for a served figure", () => {
    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [2020], measure: "amount_gel" });
    expect(result.meta.sources.length).toBeGreaterThan(0);

    const observation = data(result).observations[0];
    expect(observation?.sourceIds.length).toBeGreaterThan(0);
    const resolvedIds = new Set(result.meta.sources.map((s) => s.sourceId));
    for (const sourceId of observation?.sourceIds ?? []) {
      expect(resolvedIds.has(sourceId)).toBe(true);
    }
    expect(observation?.documentIds.length).toBeGreaterThan(0);
  });

  it("rejects gel_per_resident at parse time: national data has no per-resident measure", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.vat"],
      years: [2020],
      measure: "gel_per_resident",
    });

    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("invalid_parameters");
  });

  it("rejects a stale expectedDataVersion", () => {
    const result = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.vat"],
      years: [2020],
      measure: "amount_gel",
      expectedDataVersion: "0".repeat(64),
    });

    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("data_version_changed");
  });

  it("status is ok only when every requested cell is available, and empty when none are", () => {
    const full = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.vat"], years: [2020], measure: "amount_gel" });
    expect(full.status).toBe("ok");

    const empty = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.increase_liabilities"],
      years: [2004],
      measure: "amount_gel",
    });
    expect(empty.status).toBe("empty");
  });
});
