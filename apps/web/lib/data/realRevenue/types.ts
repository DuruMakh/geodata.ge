export type RealRevenueSource = {
  year: number;
  sourceId: string;
  workbookPath: string;
  preferredSheetNames: string[];
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
  labelKa: string;
  section: RevenueMatrixSection;
  approvedPlanThousandGel: number | null;
  revisedPlanThousandGel: number | null;
  actualThousandGel: number;
  executionPercent: number | null;
};

export type RealRevenueValidationReport = {
  importLabel: string;
  years: number[];
  sourceRows: number;
  generatedFactRows: number;
  officialRevenueTotalGelByYear: Record<number, number>;
  generatedRevenueTotalGelByYear: Record<number, number>;
  reconciliationStatusByYear: Record<number, "passed" | "failed">;
  warnings: string[];
};
