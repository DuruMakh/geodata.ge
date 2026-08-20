import type { RealRevenueFactCsvRow } from "./generateFacts";

const SOURCE_ID = "source.mof_2004_revenue_annual_execution_report";
const SOURCE_NOTE = "Source: 2004 annual budget execution report, page 19";

function fact(itemId: string, amountGel: number, sourceLabel: string): RealRevenueFactCsvRow {
  return {
    year: 2004,
    side: "revenue",
    item_id: itemId,
    amount_gel: String(amountGel),
    basis: "actual",
    source_id: SOURCE_ID,
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: `${SOURCE_NOTE}: ${sourceLabel}`,
  };
}

// Reviewed handoff from the official consolidated-budget revenue-and-grants
// table. The report does not provide a comparable consolidated liabilities row,
// so 2004 intentionally has no revenue.increase_liabilities fact.
export const YEAR_2004_REVENUE_FACTS: RealRevenueFactCsvRow[] = [
  fact("revenue.vat", 628_158_100, "VAT"),
  fact("revenue.income_tax", 268_649_900, "income tax"),
  fact("revenue.profit_tax", 161_589_700, "profit tax"),
  fact("revenue.excise_tax", 163_771_500, "excise tax"),
  fact("revenue.import_tax", 100_138_000, "import tax"),
  fact("revenue.property_tax", 29_107_500, "property tax"),
  fact("revenue.other_taxes", 459_781_200, "other taxes, derived as official tax total less named tax categories"),
  fact("revenue.grants", 124_704_300, "grants"),
  fact("revenue.other_revenue", 274_395_800, "other non-tax revenue"),
  fact("revenue.asset_decrease", 72_739_800, "capital revenue"),
];
