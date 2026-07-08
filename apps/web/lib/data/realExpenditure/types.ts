export type RealExpenditureSource = {
  year: number;
  sourceId: string;
  workbookPath: string;
  preferredSheetNames: string[];
};

export type OfficialExpenditureRow = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  rowNumber: number;
  code: string | null;
  parentCode: string | null;
  depth: number | null;
  institutionCode: string | null;
  institutionLabelKa: string | null;
  programCode: string | null;
  programLabelKa: string | null;
  subprogramCode: string | null;
  subprogramLabelKa: string | null;
  isTotal: boolean;
  isCodedRow: boolean;
  isLeafCode: boolean;
  labelKa: string;
  approvedPlanThousandGel: number | null;
  revisedPlanThousandGel: number | null;
  actualThousandGel: number;
  executionPercent: number | null;
  /**
   * Set only on synthetic pre-2012 rows injected by the admin-spending pipeline
   * (adminSpending/legacyProgramJoins.ts): the modern program series the row's amount joins.
   * Regular extracted rows never carry it.
   */
  legacyProgramJoin?: {
    targetCode: string;
    targetParentItemId: string;
    note: string;
  };
};

export type MappingConfidence = "high" | "medium" | "low" | "unclassified";

export type CandidateSpendingMapping = {
  year: number;
  code: string;
  parentCode: string | null;
  depth: number;
  institutionCode: string | null;
  institutionLabelKa: string | null;
  programCode: string | null;
  programLabelKa: string | null;
  subprogramCode: string | null;
  subprogramLabelKa: string | null;
  labelKa: string;
  actualGel: number;
  suggestedPublicSpendingFieldId: string;
  mappingConfidence: MappingConfidence;
  mappingReason: string;
  reviewedPublicSpendingFieldId: string;
  reviewNotes: string;
};

export type RealExpenditureValidationReport = {
  importLabel: string;
  years: number[];
  sourceRows: number;
  leafRows: number;
  generatedFactRows: number;
  officialTotalGelByYear: Record<number, number>;
  generatedTotalGelByYear: Record<number, number>;
  unclassifiedAmountGelByYear: Record<number, number>;
  unclassifiedShareByYear: Record<number, number>;
  reconciliationStatusByYear: Record<number, "passed" | "failed">;
  warnings: string[];
};
