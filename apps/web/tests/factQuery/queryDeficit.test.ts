// apps/web/tests/factQuery/queryDeficit.test.ts
import { describe, expect, it } from "vitest";
import { queryDeficit } from "../../lib/factQuery/queryDeficit";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

const snapshot = loadPackagedSnapshot();

function observations(response: ReturnType<typeof queryDeficit>) {
  if (response.kind !== "observations") throw new Error(`expected observations, got ${response.kind}`);
  return (response.data as { observations: { year: number; value: number | null; unit: string; basis: string | null; valueDefinition: string }[] }).observations;
}

describe("queryDeficit", () => {
  it("keeps the sign: a deficit year is negative, never an absolute value", () => {
    const response = queryDeficit(snapshot, { years: [2020], measure: "share_of_gdp_pct" });
    const cell = observations(response)[0]!;

    expect(cell.value).toBeLessThan(0);
    expect(cell.unit).toBe("percent");
    expect(cell.basis).toBe("actual");
    // The sign convention travels with the number, so a client repeating the
    // definition cannot silently drop it.
    expect(cell.valueDefinition).toContain("დეფიციტი");
  });

  it("marks an IMF forecast year as a projection", () => {
    const response = queryDeficit(snapshot, { years: [2028], measure: "share_of_gdp_pct" });

    expect(observations(response)[0]!.basis).toBe("projection");
  });

  it("serves the published GEL amount rather than deriving one", () => {
    const response = queryDeficit(snapshot, { years: [2020], measure: "amount_gel" });
    const cell = observations(response)[0]!;

    expect(cell.unit).toBe("GEL");
    expect(cell.value).toBe(snapshot.deficit.facts.find((fact) => fact.year === 2020)!.generalGovernmentBalanceGel);
  });

  it("covers years no other dataset here reaches", () => {
    const response = queryDeficit(snapshot, { years: [1995], measure: "share_of_gdp_pct" });

    expect(observations(response)[0]!.value).not.toBeNull();
  });

  it("refuses a year outside coverage rather than truncating the request", () => {
    const response = queryDeficit(snapshot, { years: [1990], measure: "share_of_gdp_pct" });

    expect(response.kind).toBe("error");
    if (response.kind !== "error") throw new Error("unreachable");
    expect(response.error.code).toBe("year_out_of_range");
  });
});
