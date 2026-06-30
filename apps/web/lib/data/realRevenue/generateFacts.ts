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

const receiptSortOrder = {
  "revenue.asset_decrease": 100,
  "revenue.increase_liabilities": 110,
} as const;

const sourceCodeFallbacks: Record<string, string[]> = {
  "1.1.4.1.1": ["11411"],
  "1.1.1.1.1": ["11111"],
  "1.1.1.2.1": ["11121"],
  "1.1.4.2": ["1142"],
  "1.1.5.1": ["1151"],
  "1.1.3": ["113"],
  "1.1.6": ["116"],
  "1.3": ["13"],
  "1.3.3": ["133"],
  "1.4": ["14"],
  "1.4.1.1.3": ["14111"],
};

const sourceCodeDisplayLabels: Record<string, string> = {
  "1.1.4.1.1": "დამატებული ღირებულების გადასახადი",
  "11411": "დამატებული ღირებულების გადასახადი",
  "1.1.1.1.1": "საშემოსავლო გადასახადი",
  "11111": "საშემოსავლო გადასახადი",
  "1.1.1.2.1": "მოგების გადასახადი",
  "11121": "მოგების გადასახადი",
  "1.1.4.2": "აქციზი",
  "1142": "აქციზი",
  "1.1.5.1": "იმპორტის გადასახადი",
  "1151": "იმპორტის გადასახადი",
  "1.1.3": "ქონების გადასახადი",
  "113": "ქონების გადასახადი",
  "1.1.6": "სხვა გადასახადები",
  "116": "სხვა გადასახადები",
  "1.3": "გრანტები",
  "13": "გრანტები",
  "1.3.3": "სხვა დონის სახელმწიფო ერთეულებიდან მიღებული გრანტები",
  "133": "სხვა დონის სახელმწიფო ერთეულებიდან მიღებული გრანტები",
  "1.4": "სხვა შემოსავლები",
  "14": "სხვა შემოსავლები",
  "1.4.1.1.3": "შიდა სამთავრობო სექტორიდან მიღებული სხვა შემოსავალი",
  "14111": "შიდა სამთავრობო სექტორიდან მიღებული სხვა შემოსავალი",
  "31": "არაფინანსური აქტივების კლება",
  "32": "ფინანსური აქტივების კლება",
  "33": "ვალდებულებების ზრდა",
};

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
  const sourceCodes = [mapping.sourceCode, ...(sourceCodeFallbacks[mapping.sourceCode] ?? [])];

  return rows.find((candidate) => sourceCodes.includes(candidate.sourceCode ?? ""))
    ?? (mapping.labelKa ? rows.find((candidate) => candidate.labelKa === mapping.labelKa) : undefined);
}

function sourceNote(row: OfficialRevenueRow): string {
  const sourceCode = row.sourceCode ?? "";
  const label = sourceCodeDisplayLabels[sourceCode] ?? row.labelKa;

  return `Source row ${sourceCode}: ${label}`.replace(/\s+:/, ":");
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
        mapping_notes: sourceNote(row),
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


const oldRevenueTaxTotalCode = "010000000000";
const oldRevenuePublicCodes = {
  incomeTax: "010100000000",
  profitTax: "010200000000",
  vat: "010300000000",
  exciseTax: "010400000000",
  importTax: "010500000000",
  propertyTax: ["010600000000", "013000000000"],
  grants: "040000000000",
  otherRevenue: "020000000000",
  assetDecrease: "030000000000",
  increaseLiabilities: "050000000000",
} as const;

const oldRevenueSortOrder = {
  "revenue.vat": 10,
  "revenue.income_tax": 20,
  "revenue.profit_tax": 30,
  "revenue.excise_tax": 40,
  "revenue.import_tax": 50,
  "revenue.property_tax": 60,
  "revenue.other_taxes": 70,
  "revenue.grants": 80,
  "revenue.other_revenue": 90,
  "revenue.asset_decrease": 100,
  "revenue.increase_liabilities": 110,
} as const;

function isOldRevenueRow(row: OfficialRevenueRow): boolean {
  return /^\d{12}$/.test(row.sourceCode ?? "");
}

function oldTopLevelTaxRows(rows: OfficialRevenueRow[]): OfficialRevenueRow[] {
  return rows.filter((row) => /^01\d{2}0{8}$/.test(row.sourceCode ?? "") && row.sourceCode !== oldRevenueTaxTotalCode);
}

function oldFactFromRows(rows: OfficialRevenueRow[], itemId: keyof typeof oldRevenueSortOrder): RealRevenueFactCsvRow {
  const amountGel = rows.reduce((sum, row) => sum + consolidatedGel(row), 0);
  const sourceIds = Array.from(new Set(rows.map((row) => row.sourceId)));
  const sourceCodes = rows.map((row) => row.sourceCode).filter(Boolean).join(" + ");

  return {
    year: rows[0]?.year ?? 0,
    side: "revenue",
    item_id: itemId,
    amount_gel: String(Math.round(amountGel)),
    basis: "actual",
    source_id: sourceIds.join("; "),
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: `Source rows ${sourceCodes}: old 12-digit revenue classification`,
  };
}

function generateOldCodeRevenueFacts(yearRows: OfficialRevenueRow[]): RealRevenueFactCsvRow[] {
  const propertyTaxRows = oldRevenuePublicCodes.propertyTax.map((code) => requiredRow(yearRows, code, yearRows[0]?.year ?? 0));
  const knownTaxCodes = new Set<string>([
    oldRevenuePublicCodes.incomeTax,
    oldRevenuePublicCodes.profitTax,
    oldRevenuePublicCodes.vat,
    oldRevenuePublicCodes.exciseTax,
    oldRevenuePublicCodes.importTax,
    ...oldRevenuePublicCodes.propertyTax,
  ]);
  const otherTaxRows = oldTopLevelTaxRows(yearRows).filter((row) => !knownTaxCodes.has(row.sourceCode ?? ""));

  return [
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.vat, yearRows[0]?.year ?? 0)], "revenue.vat"),
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.incomeTax, yearRows[0]?.year ?? 0)], "revenue.income_tax"),
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.profitTax, yearRows[0]?.year ?? 0)], "revenue.profit_tax"),
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.exciseTax, yearRows[0]?.year ?? 0)], "revenue.excise_tax"),
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.importTax, yearRows[0]?.year ?? 0)], "revenue.import_tax"),
    oldFactFromRows(propertyTaxRows, "revenue.property_tax"),
    oldFactFromRows(otherTaxRows, "revenue.other_taxes"),
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.grants, yearRows[0]?.year ?? 0)], "revenue.grants"),
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.otherRevenue, yearRows[0]?.year ?? 0)], "revenue.other_revenue"),
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.assetDecrease, yearRows[0]?.year ?? 0)], "revenue.asset_decrease"),
    oldFactFromRows([requiredRow(yearRows, oldRevenuePublicCodes.increaseLiabilities, yearRows[0]?.year ?? 0)], "revenue.increase_liabilities"),
  ];
}

export function generateRevenueFacts(officialRows: OfficialRevenueRow[]): RealRevenueFactCsvRow[] {
  const oldCodeYears = new Set(officialRows.filter(isOldRevenueRow).map((row) => row.year));
  const oldCodeFacts = Array.from(oldCodeYears).flatMap((year) => generateOldCodeRevenueFacts(officialRows.filter((row) => row.year === year)));
  const modernRows = officialRows.filter((row) => !oldCodeYears.has(row.year));
  const facts = generateFactsFromMappings(modernRows, publicRevenueMappings, (row, yearRows) => {
    if (row.sourceCode === "1.3" || row.sourceCode === "13") {
      return consolidatedGel(row) - consolidatedGel(requiredRow(yearRows, "1.3.3", row.year));
    }

    if (row.sourceCode === "1.4" || row.sourceCode === "14") {
      return consolidatedGel(row) - consolidatedGel(requiredRow(yearRows, "1.4.1.1.3", row.year));
    }

    return consolidatedGel(row);
  });
  const years = Array.from(new Set(facts.map((fact) => fact.year))).sort((a, b) => a - b);

  for (const year of years) {
    const yearRows = officialRows.filter((row) => row.year === year);
    const nonFinancialAssetDecrease = requiredRow(yearRows, "31", year);
    const financialAssetDecrease = requiredRow(yearRows, "32", year);
    const increaseLiabilities = requiredRow(yearRows, "33", year);
    const internalGrants = requiredRow(yearRows, "1.3.3", year);
    const internalOtherRevenue = requiredRow(yearRows, "1.4.1.1.3", year);

    for (const fact of facts) {
      if (fact.year === year && fact.item_id === "revenue.grants") {
        fact.mapping_notes = `${fact.mapping_notes}; net of ${sourceNote(internalGrants)}`;
      }

      if (fact.year === year && fact.item_id === "revenue.other_revenue") {
        fact.mapping_notes = `${fact.mapping_notes}; net of ${sourceNote(internalOtherRevenue)}`;
      }
    }

    facts.push({
      ...factFromRow(nonFinancialAssetDecrease, "revenue.asset_decrease", consolidatedGel(nonFinancialAssetDecrease) + consolidatedGel(financialAssetDecrease)),
      mapping_notes: `Source rows 31 + 32: ${sourceNote(nonFinancialAssetDecrease)}; ${sourceNote(financialAssetDecrease)}`,
    });
    facts.push(factFromRow(increaseLiabilities, "revenue.increase_liabilities", consolidatedGel(increaseLiabilities)));
  }

  return [...facts, ...oldCodeFacts].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return sortOrderForItem(a.item_id) - sortOrderForItem(b.item_id);
  });
}

export function generateLegacyAggregateRevenueFacts(officialRows: OfficialRevenueRow[]): RealRevenueFactCsvRow[] {
  return generateFactsFromMappings(officialRows, legacyAggregateMappings, (row) => row.actualThousandGel * 1000);
}

function requiredRow(rows: OfficialRevenueRow[], sourceCode: string, year: number): OfficialRevenueRow {
  const row = rowForMapping(rows, { sourceCode });
  if (!row) throw new Error(`Missing required revenue row for ${year}: ${sourceCode}`);
  return row;
}

function factFromRow(row: OfficialRevenueRow, itemId: string, amountGel: number): RealRevenueFactCsvRow {
  return {
    year: row.year,
    side: "revenue",
    item_id: itemId,
    amount_gel: String(Math.round(amountGel)),
    basis: "actual",
    source_id: row.sourceId,
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: sourceNote(row),
  };
}

function sortOrderForItem(itemId: string): number {
  return publicRevenueMappings.find((mapping) => mapping.itemId === itemId)?.sortOrder
    ?? receiptSortOrder[itemId as keyof typeof receiptSortOrder]
    ?? oldRevenueSortOrder[itemId as keyof typeof oldRevenueSortOrder]
    ?? 999;
}
