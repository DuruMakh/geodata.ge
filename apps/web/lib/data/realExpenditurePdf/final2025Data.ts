import { csvEscape } from "../csvEscape";
import { budgetFactHeaders, budgetFactsToCsv, type BudgetFactCsvRow } from "../factCsv";
import type { MappingConfidence } from "../realExpenditure/types";
import type { CompactPdfSpendingMappingRow } from "./publicMapping";

export const financialAssetsGrowthLabelKa = "ფინანსური აქტივების ზრდა";
export const liabilitiesDecreaseLabelKa = "ვალდებულებების კლება";

export function finalExpenditureOutputFiles(year: number) {
  return {
    factsCsv: `data/imports/expenditure-facts-${year}-final.csv`,
    supplementCsv: `data/staging/expenditure-${year}-financial-assets-liabilities-supplement.csv`,
    reportJson: `data/reports/expenditure-final-${year}-report.json`,
  } as const;
}

export const final2025ExpenditureOutputFiles = finalExpenditureOutputFiles(2025);

export type WorkbookStagingRow = {
  year: number;
  sourceId: string;
  code: string | null;
  isCodedRow: boolean;
  isLeafCode?: boolean;
  labelKa: string;
  actualGel: number;
};

export type SupplementMapping = {
  publicSpendingFieldId: string;
  mappingConfidence: MappingConfidence;
  labelKa: string;
  mappingNotes: string;
};

export type FinalExpenditureSupplementRow = {
  year: number;
  sourceId: string;
  code: string;
  labelKa: string;
  economicLabelKa: string;
  amountGel: number;
  publicSpendingFieldId: string;
  mappingConfidence: MappingConfidence;
  mappingNotes: string;
};

export type FinalExpenditureCompositionReport = {
  year: number;
  pdfMappedTotalGel: number;
  supplementTotalGel: number;
  supplementTotalByEconomicLabelGel: Record<string, number>;
  finalTotalGel: number;
  workbookTotalGel: number;
  differenceGel: number;
  categoryCount: number;
  sources: string[];
  notes: string[];
};

export type FinalExpenditureCompositionResult = {
  facts: BudgetFactCsvRow[];
  report: FinalExpenditureCompositionReport;
};

export type Final2025SupplementRow = FinalExpenditureSupplementRow;
export type Final2025CompositionReport = FinalExpenditureCompositionReport & { year: 2025 };
export type Final2025CompositionResult = FinalExpenditureCompositionResult & {
  report: Final2025CompositionReport;
};

const final2025SourceId = "source.mof_2025_expenditure_pdf_e11_plus_tavi6_supplement_actual";
const final2025SourceFiles = [
  "docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf",
  "docs/Raw Data/Expenditure/mof.ge/2025.xlsx",
  "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
];

function worstConfidence(current: MappingConfidence, next: MappingConfidence): MappingConfidence {
  const order: Record<MappingConfidence, number> = {
    unclassified: 0,
    low: 1,
    medium: 2,
    high: 3,
  };

  return order[next] < order[current] ? next : current;
}

export function extractFinancialAssetAndLiabilitySupplements(input: {
  rows: WorkbookStagingRow[];
  mappingsByCode: Map<string, SupplementMapping>;
}): FinalExpenditureSupplementRow[] {
  let currentCode: string | null = null;
  let currentLabel = "";
  const supplements: FinalExpenditureSupplementRow[] = [];

  for (const row of input.rows) {
    if (row.isCodedRow && row.code) {
      currentCode = row.isLeafCode === false ? null : row.code;
      currentLabel = row.isLeafCode === false ? "" : row.labelKa;
      continue;
    }

    if (row.labelKa !== financialAssetsGrowthLabelKa && row.labelKa !== liabilitiesDecreaseLabelKa) continue;
    if (!currentCode || row.actualGel === 0) continue;

    const mapping = input.mappingsByCode.get(currentCode);
    if (!mapping) continue;

    supplements.push({
      year: row.year,
      sourceId: row.sourceId,
      code: currentCode,
      labelKa: mapping.labelKa || currentLabel,
      economicLabelKa: row.labelKa,
      amountGel: Math.round(row.actualGel),
      publicSpendingFieldId: mapping.publicSpendingFieldId,
      mappingConfidence: mapping.mappingConfidence,
      mappingNotes: mapping.mappingNotes,
    });
  }

  return supplements;
}

export function composeFinalExpenditureFacts(input: {
  year: number;
  finalSourceId: string;
  sourceFiles: string[];
  pdfMappings: CompactPdfSpendingMappingRow[];
  supplements: FinalExpenditureSupplementRow[];
  spendingFieldIds: string[];
  workbookTotalGel: number;
}): FinalExpenditureCompositionResult {
  const aggregated = new Map<
    string,
    {
      amountGel: number;
      pdfRows: number;
      supplementRows: number;
      mappingConfidence: MappingConfidence;
    }
  >();

  for (const fieldId of input.spendingFieldIds) {
    aggregated.set(fieldId, {
      amountGel: 0,
      pdfRows: 0,
      supplementRows: 0,
      mappingConfidence: "high",
    });
  }

  for (const row of input.pdfMappings.filter((candidate) => candidate.includeInPublicFact)) {
    const existing = aggregated.get(row.publicSpendingFieldId);
    if (!existing) continue;
    existing.amountGel += row.amountGel;
    existing.pdfRows += 1;
    existing.mappingConfidence = worstConfidence(existing.mappingConfidence, row.mappingConfidence);
  }

  for (const row of input.supplements) {
    const existing = aggregated.get(row.publicSpendingFieldId);
    if (!existing) continue;
    existing.amountGel += row.amountGel;
    existing.supplementRows += 1;
    existing.mappingConfidence = worstConfidence(existing.mappingConfidence, row.mappingConfidence);
  }

  const facts = input.spendingFieldIds.map((fieldId) => {
    const row = aggregated.get(fieldId);
    const pdfRows = row?.pdfRows ?? 0;
    const supplementRows = row?.supplementRows ?? 0;

    return {
      year: input.year,
      side: "expenditure",
      item_id: fieldId,
      amount_gel: String(Math.round(row?.amountGel ?? 0)),
      basis: "actual",
      source_id: input.finalSourceId,
      official_institution: "Multiple official rows",
      official_program: "",
      official_subprogram: "",
      public_spending_field_id: fieldId,
      mapping_confidence: row?.mappingConfidence ?? "high",
      mapping_notes: `PDF mapped rows: ${pdfRows}; workbook financial-asset/liability supplement rows: ${supplementRows}`,
    } satisfies BudgetFactCsvRow;
  });

  const pdfMappedTotalGel = Math.round(
    input.pdfMappings.filter((row) => row.includeInPublicFact).reduce((sum, row) => sum + row.amountGel, 0),
  );
  const supplementTotalGel = input.supplements.reduce((sum, row) => sum + row.amountGel, 0);
  const finalTotalGel = facts.reduce((sum, row) => sum + Number(row.amount_gel), 0);
  const supplementTotalByEconomicLabelGel = input.supplements.reduce<Record<string, number>>((totals, row) => {
    totals[row.economicLabelKa] = (totals[row.economicLabelKa] ?? 0) + row.amountGel;
    return totals;
  }, {});

  return {
    facts,
    report: {
      year: input.year,
      pdfMappedTotalGel,
      supplementTotalGel,
      supplementTotalByEconomicLabelGel,
      finalTotalGel,
      workbookTotalGel: input.workbookTotalGel,
      differenceGel: Math.abs(input.workbookTotalGel - finalTotalGel),
      categoryCount: input.spendingFieldIds.length,
      sources: input.sourceFiles,
      notes: [
        "The PDF E11 functional source covers expenses plus non-financial assets growth.",
        `The final ${input.year} data supplements PDF E11 with financial assets growth and liabilities decrease from the workbook/program source.`,
        "Financial assets decrease is revenue-side and is not added to expenditure facts.",
      ],
    },
  };
}

export function composeFinal2025ExpenditureFacts(input: {
  pdfMappings: CompactPdfSpendingMappingRow[];
  supplements: Final2025SupplementRow[];
  spendingFieldIds: string[];
  workbookTotalGel: number;
}): Final2025CompositionResult {
  return composeFinalExpenditureFacts({
    year: 2025,
    finalSourceId: final2025SourceId,
    sourceFiles: final2025SourceFiles,
    ...input,
  }) as Final2025CompositionResult;
}

export function final2025ExpenditureFactsToCsv(rows: BudgetFactCsvRow[]): string {
  return `\ufeff${budgetFactsToCsv(rows)}`;
}

export function final2025SupplementsToCsv(rows: FinalExpenditureSupplementRow[]): string {
  const headers = [
    "year",
    "source_id",
    "code",
    "label_ka",
    "economic_label_ka",
    "amount_gel",
    "public_spending_field_id",
    "mapping_confidence",
    "mapping_notes",
  ];

  return `\ufeff${[
    headers.join(","),
    ...rows.map((row) =>
      [
        row.year,
        row.sourceId,
        row.code,
        row.labelKa,
        row.economicLabelKa,
        row.amountGel,
        row.publicSpendingFieldId,
        row.mappingConfidence,
        row.mappingNotes,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n")}`;
}

export { budgetFactHeaders };
