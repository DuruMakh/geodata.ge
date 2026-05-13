export type BudgetFactCsvRow = {
  year: number;
  side: "revenue" | "expenditure";
  item_id: string;
  amount_gel: string;
  basis: "actual" | "planned";
  source_id: string;
  official_institution: string;
  official_program: string;
  official_subprogram: string;
  public_spending_field_id: string;
  mapping_confidence: string;
  mapping_notes: string;
};

export const budgetFactHeaders = [
  "year",
  "side",
  "item_id",
  "amount_gel",
  "basis",
  "source_id",
  "official_institution",
  "official_program",
  "official_subprogram",
  "public_spending_field_id",
  "mapping_confidence",
  "mapping_notes",
] as const;

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function budgetFactsToCsv(rows: BudgetFactCsvRow[]): string {
  return [
    budgetFactHeaders.join(","),
    ...rows.map((row) => budgetFactHeaders.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}
