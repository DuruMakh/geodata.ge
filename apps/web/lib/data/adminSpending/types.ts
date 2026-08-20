import type { MappingConfidence } from "../realExpenditure/types";

export type AdminSpendingCategory = {
  id: string;
  kaLabel: string;
  enLabel: string;
  sortOrder: number;
};

export type AdminSpendingFactLevel = "admin_category" | "major_program";

export type AdminSpendingFact = {
  year: number;
  itemId: string;
  parentItemId: string | null;
  level: AdminSpendingFactLevel;
  amountGel: number;
  basis: "actual";
  sourceId: string;
  officialCode: string | null;
  officialLabelKa: string | null;
  officialInstitutionCode: string | null;
  officialInstitutionLabelKa: string | null;
  mappingConfidence: MappingConfidence;
  mappingNotes: string;
};

export type AdminSpendingReport = {
  years: number[];
  sourceRows: number;
  categoryFactRows: number;
  majorProgramFactRows: number;
  majorProgramThresholdGel: number;
  majorProgramUniqueItems: number;
  reconciliationToleranceGel: number;
  sourceTotalGelByYear: Record<number, number>;
  categoryTotalGelByYear: Record<number, number>;
  reconciliationDifferenceGelByYear: Record<number, number>;
  reconciliationStatusByYear: Record<number, "passed" | "failed">;
};
