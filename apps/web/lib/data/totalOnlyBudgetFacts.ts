import type { BudgetFactCsvRow } from "./factCsv";

export type TotalOnlyBudgetFact = BudgetFactCsvRow & {
  evidence: string;
  sourceUnit: "GEL" | "thousand_gel";
};

const totalOnlyRows = [
  {
    year: 2006,
    side: "revenue",
    item_id: "revenue.total",
    amount_gel: "4537916325",
    basis: "actual",
    source_id: "source.mof_2006_revenue_form1_pdf",
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "Total-only fallback. Source row: consolidated receipts total; rounded to whole GEL.",
    sourceUnit: "GEL",
    evidence: "docs/Raw Data/Revenue/2006-jan-dec-consolidated-revenue.pdf page 22 row sul consolidated column",
  },
] satisfies TotalOnlyBudgetFact[];

export const TOTAL_ONLY_BUDGET_FACTS: BudgetFactCsvRow[] = totalOnlyRows.map(({ evidence: _evidence, sourceUnit: _sourceUnit, ...row }) => row);

export const TOTAL_ONLY_BUDGET_FACT_REPORT = {
  importLabel: "total-only-budget-facts",
  rows: totalOnlyRows.map((row) => ({
    year: row.year,
    side: row.side,
    itemId: row.item_id,
    amountGel: Number(row.amount_gel),
    sourceId: row.source_id,
    sourceUnit: row.sourceUnit,
    evidence: row.evidence,
    notes: row.mapping_notes,
  })),
  notes: [
    "Explicit total rows are used only where detailed old-year parsing is not source-safe enough for public categories.",
    "2004 expenditure is now detailed via the complete state-budget execution annex; 2005 and 2006 are detailed via the old 14-group classification (see the old-classification review CSVs). The 2005 series uses the broader payments total 2,626,507.3 thousand GEL.",
  ],
} as const;

