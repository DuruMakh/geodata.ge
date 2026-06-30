import type { BudgetFactCsvRow } from "./factCsv";

export type TotalOnlyBudgetFact = BudgetFactCsvRow & {
  evidence: string;
  sourceUnit: "GEL" | "thousand_gel";
};

const totalOnlyRows = [
  {
    year: 2004,
    side: "expenditure",
    item_id: "expenditure.total",
    amount_gel: "1513216526",
    basis: "actual",
    source_id: "source.mof_2004_expenditure_pdf_form_e11_actual",
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "Total-only fallback. Source row: sul sakaso xarjebi.",
    sourceUnit: "GEL",
    evidence: "docs/Raw Data/Expenditure/treasury.ge/2004-12-month-state-budget-functional-expenditure.pdf page 1 row sul sakaso xarjebi",
  },
  {
    year: 2005,
    side: "expenditure",
    item_id: "expenditure.total",
    amount_gel: "2626507300",
    basis: "actual",
    source_id: "source.mof_2005_expenditure_pdf_form_e11_actual",
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "Total-only fallback. Source row: sul saxelmwifo biujetis gadasaxdelebi da xarjebi; value 2,626,507.3 thousand GEL.",
    sourceUnit: "thousand_gel",
    evidence: "docs/Raw Data/Expenditure/treasury.ge/2005-12-month-state-budget-functional-expenditure.pdf page 3 row sul saxelmwifo biujetis gadasaxdelebi da xarjebi",
  },
  {
    year: 2005,
    side: "revenue",
    item_id: "revenue.total",
    amount_gel: "3289223826",
    basis: "actual",
    source_id: "source.mof_2005_revenue_form1_pdf",
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "Total-only fallback. Source row: consolidated receipts total; rounded to whole GEL.",
    sourceUnit: "GEL",
    evidence: "docs/Raw Data/Revenue/2005-jan-dec-consolidated-revenue.pdf page 23 row sul consolidated column",
  },
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
  {
    year: 2007,
    side: "revenue",
    item_id: "revenue.total",
    amount_gel: "6356421170",
    basis: "actual",
    source_id: "source.mof_2007_revenue_form1_pdf",
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "Total-only fallback. Source row: consolidated receipts total; rounded to whole GEL.",
    sourceUnit: "GEL",
    evidence: "docs/Raw Data/Revenue/2007-jan-dec-consolidated-revenue.pdf page 15 row sul consolidated column",
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
    "2005 expenditure uses the broader payments-and-expenditures total 2,626,507.3 thousand GEL; the same source row also contains a narrower 12-month expenditure column of 2,618,557.0 thousand GEL.",
  ],
} as const;


