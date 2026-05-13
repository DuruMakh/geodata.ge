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

const publicRevenueMappings = [
  { sourceCode: "1.1.4.1.1", itemId: "revenue.vat", sortOrder: 10 },
  { sourceCode: "1.1.1.1.1", itemId: "revenue.income_tax", sortOrder: 20 },
  { sourceCode: "1.1.1.2.1", itemId: "revenue.profit_tax", sortOrder: 30 },
  { sourceCode: "1.1.4.2", itemId: "revenue.excise_tax", sortOrder: 40 },
  { sourceCode: "1.1.5.1", itemId: "revenue.import_tax", sortOrder: 50 },
  { sourceCode: "1.1.3", itemId: "revenue.property_tax", sortOrder: 60 },
  { sourceCode: "1.1.6", itemId: "revenue.other_taxes", sortOrder: 70 },
  { sourceCode: "1.3", itemId: "revenue.grants", sortOrder: 80 },
  { sourceCode: "1.4", itemId: "revenue.other_revenue", sortOrder: 90 },
] as const;

const legacyAggregateMappings = [
  { sourceCode: "1.1", labelKa: "გადასახადები", itemId: "revenue.taxes_total", sortOrder: 5 },
  { sourceCode: "1.3", labelKa: "გრანტები", itemId: "revenue.grants", sortOrder: 80 },
  { sourceCode: "1.4", labelKa: "სხვა შემოსავლები", itemId: "revenue.other_revenue", sortOrder: 90 },
] as const;

function consolidatedGel(row: OfficialRevenueRow): number {
  return row.consolidatedActualGel ?? row.actualThousandGel * 1000;
}

function rowForMapping(
  rows: OfficialRevenueRow[],
  mapping: { sourceCode: string; labelKa?: string },
): OfficialRevenueRow | undefined {
  return rows.find((candidate) => candidate.sourceCode === mapping.sourceCode)
    ?? (mapping.labelKa ? rows.find((candidate) => candidate.labelKa === mapping.labelKa) : undefined);
}

function generateFactsFromMappings(
  officialRows: OfficialRevenueRow[],
  mappings: readonly { sourceCode: string; labelKa?: string; itemId: string; sortOrder: number }[],
  amountForRow: (row: OfficialRevenueRow, yearRows: OfficialRevenueRow[]) => number,
): RealRevenueFactCsvRow[] {
  const revenueRows = officialRows.filter((row) => row.section === "revenues");
  const years = Array.from(new Set(revenueRows.map((row) => row.year))).sort((a, b) => a - b);
  const generated: RealRevenueFactCsvRow[] = [];

  for (const year of years) {
    const yearRows = revenueRows.filter((row) => row.year === year);

    for (const mapping of mappings) {
      const row = rowForMapping(yearRows, mapping);
      if (!row) throw new Error(`Missing required revenue row for ${year}: ${mapping.sourceCode}`);

      generated.push({
        year,
        side: "revenue",
        item_id: mapping.itemId,
        amount_gel: String(Math.round(amountForRow(row, yearRows))),
        basis: "actual",
        source_id: row.sourceId,
        official_institution: "",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "",
        mapping_confidence: "",
        mapping_notes: `Source row ${row.sourceCode ?? ""}: ${row.labelKa}`.replace(/\s+:/, ":"),
      });
    }
  }

  return generated.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const left = mappings.find((mapping) => mapping.itemId === a.item_id)?.sortOrder ?? 999;
    const right = mappings.find((mapping) => mapping.itemId === b.item_id)?.sortOrder ?? 999;
    return left - right;
  });
}

export function generateRevenueFacts(officialRows: OfficialRevenueRow[]): RealRevenueFactCsvRow[] {
  return generateFactsFromMappings(officialRows, publicRevenueMappings, (row, yearRows) => {
    if (row.sourceCode === "1.3") {
      return consolidatedGel(row) - consolidatedGel(requiredRow(yearRows, "1.3.3", row.year));
    }

    if (row.sourceCode === "1.4") {
      return consolidatedGel(row) - consolidatedGel(requiredRow(yearRows, "1.4.1.1.3", row.year));
    }

    return consolidatedGel(row);
  });
}

export function generateLegacyAggregateRevenueFacts(officialRows: OfficialRevenueRow[]): RealRevenueFactCsvRow[] {
  return generateFactsFromMappings(officialRows, legacyAggregateMappings, (row) => row.actualThousandGel * 1000);
}

function requiredRow(rows: OfficialRevenueRow[], sourceCode: string, year: number): OfficialRevenueRow {
  const row = rows.find((candidate) => candidate.sourceCode === sourceCode);
  if (!row) throw new Error(`Missing required revenue row for ${year}: ${sourceCode}`);
  return row;
}
