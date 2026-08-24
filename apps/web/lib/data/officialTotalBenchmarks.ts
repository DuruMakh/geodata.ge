// Officially evidenced headline totals kept as machine-checkable reconciliation
// fixtures. These are NOT shipped rows: nothing here is injected into any CSV.
// They exist so a test can assert that the detailed facts the app does ship sum
// back to the number the official document prints.
//
// The 2006 revenue total previously lived in lib/data/totalOnlyBudgetFacts.ts as
// part of a total-only fallback path. That path could not fire — every consumer
// filtered it to zero rows — so the plumbing was removed and the evidenced
// number was rehomed here, where its actual job is visible.

export type OfficialTotalBenchmark = {
  year: number;
  side: "revenue" | "expenditure";
  itemId: string;
  amountGel: number;
  sourceId: string;
  sourceUnit: "GEL" | "thousand_gel";
  evidence: string;
  notes: string;
};

export const OFFICIAL_TOTAL_BENCHMARKS: readonly OfficialTotalBenchmark[] = [
  {
    year: 2006,
    side: "revenue",
    itemId: "revenue.total",
    amountGel: 4537916325,
    sourceId: "source.mof_2006_revenue_form1_pdf",
    sourceUnit: "GEL",
    evidence:
      "docs/Raw Data/Revenue/2006-jan-dec-consolidated-revenue.pdf page 22 row sul consolidated column",
    notes: "Consolidated receipts total; rounded to whole GEL.",
  },
];

export function officialTotalBenchmark(
  year: number,
  side: "revenue" | "expenditure",
  itemId: string,
): OfficialTotalBenchmark {
  const benchmark = OFFICIAL_TOTAL_BENCHMARKS.find(
    (row) => row.year === year && row.side === side && row.itemId === itemId,
  );

  if (!benchmark) {
    throw new Error(`No official total benchmark for ${year} ${side} ${itemId}`);
  }

  return benchmark;
}
