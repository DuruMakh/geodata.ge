import { describe, expect, it } from "vitest";
import { loadServedExplorerData, loadServedMunicipalData } from "../../lib/data/servedData";
import { formatInUnit, unitFor, UNIT_BN, UNIT_MLN, type ValueUnit } from "../../lib/explorer/format";

// A funded budget line must never render the same as an unfunded one. The unit
// formatters are the last step before a reviewed amount reaches a table cell or
// a chart axis, so the guard belongs on the real corpus rather than on
// hand-picked constants: the failure this catches (ონი 2025 health, 133,333 GEL
// displayed as "0") was invisible to every fixture-based assertion in
// format.test.ts.
//
// Each case derives its unit the way the surface does — once, from every value
// that surface can show — so the assertion covers the format a reader actually
// sees rather than a corpus-wide worst case.

const RENDERS_AS_ZERO = /^[−-]?0(?:[.,]0+)?$/;

function vanishing<T>(rows: readonly T[], amountOf: (row: T) => number, base: ValueUnit): T[] {
  const unit = unitFor(rows.map(amountOf), base);
  return rows.filter((row) => amountOf(row) !== 0 && RENDERS_AS_ZERO.test(formatInUnit(amountOf(row), unit)));
}

describe("no reviewed amount ever renders as zero", () => {
  it("keeps every non-zero function value visible on each municipality page", async () => {
    const { functionFacts } = await loadServedMunicipalData();
    const byMunicipality = new Map<string, typeof functionFacts>();
    for (const fact of functionFacts) {
      byMunicipality.set(fact.municipalityCode, [...(byMunicipality.get(fact.municipalityCode) ?? []), fact]);
    }

    const vanished = [...byMunicipality.values()].flatMap((rows) =>
      vanishing(rows, (fact) => fact.amountGel, UNIT_MLN),
    );

    expect(
      vanished.slice(0, 5).map((fact) => `${fact.municipalityCode} ${fact.year} ${fact.categoryId} = ${fact.amountGel}`),
    ).toEqual([]);
    expect(vanished).toHaveLength(0);
  });

  it("keeps every non-zero value visible on the Georgia roll-up page", async () => {
    const { countryFunctionFacts, countryTotalFacts } = await loadServedMunicipalData();

    expect(vanishing(countryFunctionFacts, (fact) => fact.amountGel, UNIT_MLN)).toHaveLength(0);
    expect(vanishing(countryTotalFacts, (row) => row.publicTotalGel, UNIT_MLN)).toHaveLength(0);
  });

  it("keeps every non-zero value visible on each national scope", async () => {
    const { facts, adminFacts } = await loadServedExplorerData();
    type ScopeRow = { year: number; itemId: string; amountGel: number };
    const scopes: Array<{ scope: string; rows: readonly ScopeRow[] }> = [
      { scope: "expenditure", rows: facts.filter((fact) => fact.side === "expenditure") },
      { scope: "revenue", rows: facts.filter((fact) => fact.side === "revenue") },
      { scope: "ministries", rows: adminFacts },
    ];

    for (const { scope, rows } of scopes) {
      const vanished = vanishing(rows, (fact) => fact.amountGel, UNIT_BN);
      expect(
        vanished.slice(0, 5).map((fact) => `${scope} ${fact.year} ${fact.itemId} = ${fact.amountGel}`),
      ).toEqual([]);
    }
  });
});
