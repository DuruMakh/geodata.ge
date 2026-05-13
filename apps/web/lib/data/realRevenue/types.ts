export type RealRevenueSource = {
  year: number;
  sourceId: string;
  workbookPath: string;
  preferredSheetNames: string[];
};

export type RealRevenuePdfSource = {
  year: number;
  sourceId: string;
  pdfPath: string;
};

export type RevenueMatrixSection =
  | "revenues"
  | "expenditures"
  | "non_financial_assets"
  | "financial_assets"
  | "liabilities"
  | "other";

export type OfficialRevenueRow = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  rowNumber: number;
  sourceCode?: string;
  labelKa: string;
  section: RevenueMatrixSection;
  approvedPlanThousandGel: number | null;
  revisedPlanThousandGel: number | null;
  actualThousandGel: number;
  executionPercent: number | null;
  stateBudgetActualGel?: number;
  territorialBudgetActualGel?: number;
  consolidatedActualGel?: number;
};

export type RealRevenueValidationReport = {
  importLabel: string;
  years: number[];
  sourceRows: number;
  generatedFactRows: number;
  grossOfficialRevenueTotalGelByYear?: Record<number, number>;
  internalRevenueFlowGelByYear?: Record<number, number>;
  officialRevenueTotalGelByYear: Record<number, number>;
  generatedRevenueTotalGelByYear: Record<number, number>;
  reconciliationStatusByYear: Record<number, "passed" | "failed">;
  warnings: string[];
};
