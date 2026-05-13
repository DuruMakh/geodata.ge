import type { OfficialRevenueRow } from "./types";

export type RealRevenueFactCsvRow = {
  year: number;
  side: "revenue";
  item_id: string;
  amount_gel: string;
  basis: "actual";
  source_id: string;
  official_institution: "";
  official_program: "";
  official_subprogram: "";
  public_spending_field_id: "";
  mapping_confidence: "";
  mapping_notes: string;
};

const rowMappings = [
  { labelKa: "გადასახადები", itemId: "revenue.taxes_total", sortOrder: 5 },
  { labelKa: "გრანტები", itemId: "revenue.grants", sortOrder: 80 },
  { labelKa: "სხვა შემოსავლები", itemId: "revenue.other_revenue", sortOrder: 90 },
] as const;

function gelFromThousandGel(value: number): string {
  return String(Math.round(value * 1000));
}

export function generateRevenueFacts(officialRows: OfficialRevenueRow[]): RealRevenueFactCsvRow[] {
  const revenueRows = officialRows.filter((row) => row.section === "revenues");
  const years = Array.from(new Set(revenueRows.map((row) => row.year))).sort((a, b) => a - b);
  const generated: RealRevenueFactCsvRow[] = [];

  for (const year of years) {
    const yearRows = revenueRows.filter((row) => row.year === year);

    for (const mapping of rowMappings) {
      const row = yearRows.find((candidate) => candidate.labelKa === mapping.labelKa);
      if (!row) throw new Error(`Missing required revenue row for ${year}: ${mapping.labelKa}`);

      generated.push({
        year,
        side: "revenue",
        item_id: mapping.itemId,
        amount_gel: gelFromThousandGel(row.actualThousandGel),
        basis: "actual",
        source_id: row.sourceId,
        official_institution: "",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "",
        mapping_confidence: "",
        mapping_notes: `Source row: ${row.labelKa}`,
      });
    }
  }

  return generated.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const left = rowMappings.find((mapping) => mapping.itemId === a.item_id)?.sortOrder ?? 999;
    const right = rowMappings.find((mapping) => mapping.itemId === b.item_id)?.sortOrder ?? 999;
    return left - right;
  });
}
