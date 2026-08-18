// Row shapes for the municipal dataset. No logic here — every loader in
// lib/data/municipal/ returns one of these, and lib/db/mirrorRows.ts returns
// the identical shapes so parity compares like with like.

export const MUNICIPAL_COUNTRY_ID = "country.georgia" as const;
export const ADJARA_REGION_ID = "region.adjara" as const;

export type AdjaraBudgetAdjustment = {
  year: number;
  scopeId: typeof ADJARA_REGION_ID;
  republicPaymentsGel: number;
  municipalTransfersGel: number;
  netRepublicPaymentsGel: number;
  basis: "actual";
  republicSourceId: string;
  transferSourceId: string;
};

export type MunicipalFunction = {
  id: string;
  kaLabel: string;
  functionalCode: string;
  sortOrder: number;
};

export type MunicipalRegion = {
  id: string;
  kaLabel: string;
  sortOrder: number;
};

export type Municipality = {
  code: string;
  sortId: number;
  nameKa: string;
  displayNameKa: string;
  regionId: string;
  isSelfGoverningCity: boolean;
};

export type MunicipalPopulationFact = {
  year: 2025;
  municipalityCode: string;
  populationThousand: number;
  populationPersons: number;
  referenceDate: "2025-01-01";
  sourceId: "source.geostat_municipal_population";
  sourceSheet: string;
  sourceCell: string;
  sourceUnit: "(thousands)";
  transformation: string;
  lastReviewedAt: string;
};

export type MunicipalFunctionFact = {
  year: number;
  municipalityCode: string;
  categoryId: string;
  functionalCode: string;
  amountGel: number;
  basis: "actual";
  sourceId: string;
};

// warning_type mirrors the methodology's four states. "none" is the explicit
// no-warning value; source_actual_missing is a state, not a warning (it never
// trips the GEL 1M rule because there is no official total to compare against).
export type MunicipalWarningType =
  | "none"
  | "source_version_difference"
  | "financing_outside_functional"
  | "reconciliation_review_required"
  | "source_actual_missing";

export type MunicipalTotalFact = {
  year: number;
  municipalityCode: string;
  publicTotalGel: number;
  publicTotalMeasure: string;
  totalPaymentsGel: number | null;
  expensesGel: number | null;
  nonfinancialAssetGrowthGel: number | null;
  financialAssetGrowthGel: number | null;
  liabilityDecreaseGel: number | null;
  functionalSumGel: number;
  reconciliationDifferenceGel: number | null;
  warningAmountGel: number | null;
  showWarning: boolean;
  warningType: MunicipalWarningType;
  basis: "actual";
  sourceId: string;
};
