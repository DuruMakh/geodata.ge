// apps/web/tests/factQuery/queryDebt.test.ts
import { describe, expect, it } from "vitest";
import { queryDebt } from "../../lib/factQuery/queryDebt";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

const snapshot = loadPackagedSnapshot();

function observations(response: ReturnType<typeof queryDebt>) {
  if (response.kind !== "observations") throw new Error(`expected observations, got ${response.kind}`);
  return (response.data as { observations: { year: number; value: number | null; unit: string; basis: string | null; availability: string; seriesId: string }[] }).observations;
}

describe("queryDebt", () => {
  it("serves a stock year in GEL with an actual basis", () => {
    const response = queryDebt(snapshot, { seriesIds: ["debt.stock.total"], years: [2024], measure: "amount_gel" });
    const cell = observations(response)[0]!;

    expect(cell.unit).toBe("GEL");
    expect(cell.basis).toBe("actual");
    expect(cell.value).toBeGreaterThan(0);
  });

  it("marks a future service year as a projection, never as planned", () => {
    const response = queryDebt(snapshot, { seriesIds: ["debt.service.total"], years: [2027], measure: "amount_gel" });

    // "planned" would say a government approved this as a budget. It did not:
    // this is what the debt already outstanding is scheduled to cost.
    expect(observations(response)[0]!.basis).toBe("projection");
  });

  it("returns a published rate as percent and an unpublished one as missing, never zero", () => {
    const response = queryDebt(snapshot, {
      seriesIds: ["debt.rate.external"],
      years: [2016, 2024],
      measure: "rate_percent",
    });
    const byYear = new Map(observations(response).map((o) => [o.year, o]));

    expect(byYear.get(2024)!.unit).toBe("percent");
    expect(byYear.get(2024)!.value).toBeGreaterThan(0);
    expect(byYear.get(2016)!.availability).toBe("missing");
    expect(byYear.get(2016)!.value).toBeNull();
  });

  it("rejects a measure the series family does not carry", () => {
    // Rejected rather than answered empty: an empty result would read as "no
    // data for that year", which is false - the data exists, the measure does
    // not apply to it.
    const response = queryDebt(snapshot, { seriesIds: ["debt.stock.total"], years: [2024], measure: "rate_percent" });

    expect(response.kind).toBe("error");
    if (response.kind !== "error") throw new Error("unreachable");
    expect(response.error.code).toBe("invalid_parameters");
  });

  it("lets a service projection year through even though stock stops earlier", () => {
    // Coverage is per requested family. Taking the whole dataset's range would
    // be wrong in the other direction; taking stock's would refuse a real
    // service row.
    const response = queryDebt(snapshot, { seriesIds: ["debt.service.principal"], years: [2029], measure: "amount_gel" });

    expect(response.kind).toBe("observations");
    expect(observations(response)[0]!.value).toBeGreaterThan(0);
  });
});
