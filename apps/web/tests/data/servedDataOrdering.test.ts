import { describe, expect, it } from "vitest";
import {
  orderExplorerDataForServing,
  orderMunicipalDataForServing,
  type LoadedExplorerData,
  type MunicipalData,
} from "../../lib/data/servedData";

// Only `year` matters to the ordering contract; the rest of each row shape is
// irrelevant here, so these fixtures stay deliberately thin.
function yearsOf(rows: Array<{ year: number }>): number[] {
  return rows.map((row) => row.year);
}

function explorerDataWithYears(years: number[]): LoadedExplorerData {
  return {
    facts: [],
    glossary: new Map(),
    sourceDocuments: [],
    adminFacts: years.map((year) => ({ year })),
    adminCategories: [],
    gdpFacts: years.map((year) => ({ year })),
  } as unknown as LoadedExplorerData;
}

function municipalDataWithYears(years: number[]): MunicipalData {
  const rows = years.map((year) => ({ year }));
  return {
    functions: [],
    regions: [],
    municipalities: [],
    functionFacts: [...rows],
    totalFacts: [...rows],
    countryFunctionFacts: [...rows],
    countryTotalFacts: [...rows],
    adjaraBudgetAdjustments: [...rows],
    populationFacts: [...rows],
  } as unknown as MunicipalData;
}

describe("served data ordering contract", () => {
  // The explorer model keeps the LAST fact per item so each series carries its
  // most recent official name (lib/explorer/explorerData.ts). Parity compares by
  // key and is order-insensitive, so nothing else would catch a lost ORDER BY.
  it("sorts admin and GDP facts year-ascending regardless of input order", () => {
    const ordered = orderExplorerDataForServing(explorerDataWithYears([2020, 2004, 2025, 2012]));

    expect(yearsOf(ordered.adminFacts)).toEqual([2004, 2012, 2020, 2025]);
    expect(yearsOf(ordered.gdpFacts)).toEqual([2004, 2012, 2020, 2025]);
  });

  it("sorts every year-bearing municipal dataset", () => {
    const ordered = orderMunicipalDataForServing(municipalDataWithYears([2025, 2015, 2019]));

    for (const rows of [
      ordered.functionFacts,
      ordered.totalFacts,
      ordered.countryFunctionFacts,
      ordered.countryTotalFacts,
      ordered.adjaraBudgetAdjustments,
      ordered.populationFacts,
    ]) {
      expect(yearsOf(rows)).toEqual([2015, 2019, 2025]);
    }
  });

  it("does not mutate the caller's arrays", () => {
    const input = explorerDataWithYears([2025, 2004]);
    const originalOrder = yearsOf(input.adminFacts);

    orderExplorerDataForServing(input);

    expect(yearsOf(input.adminFacts)).toEqual(originalOrder);
  });
});
