export type GeneralGovernmentBalanceStatus = "actual" | "projection";
export type GeneralGovernmentBalanceIndicatorId = "GGXCNL_NGDP" | "GGXCNL" | "NGDP_FY";

export type GeneralGovernmentBalanceSourceFact = {
  year: number;
  indicatorId: GeneralGovernmentBalanceIndicatorId;
  seriesCode: string;
  value: number;
  unit: "Percent" | "Domestic currency";
  scale: "Units" | "Billions";
  status: GeneralGovernmentBalanceStatus;
  sourceId: string;
  sourceSheet: "Countries";
  sourceCell: string;
};

export type GeneralGovernmentBalanceFact = {
  year: number;
  generalGovernmentBalancePctGdp: number;
  generalGovernmentBalanceGel: number;
  status: GeneralGovernmentBalanceStatus;
  sourceId: string;
  sourceDataset: string;
  sourceVintage: string;
  sourceSheet: "Countries";
  sourceCountryId: "GEO";
  sourcePercentSeriesCode: "GEO.GGXCNL_NGDP.A";
  sourceNominalSeriesCode: "GEO.GGXCNL.A";
  sourceUnit: "billion GEL";
  transformation: string;
  lastReviewedAt: string;
};

export type GeneralGovernmentBalanceValidationSummary = {
  maximumReconciliationDifferencePercentagePoints: number;
  reconciliationFailureYears: number[];
};

export type GeneralGovernmentBalanceValidationReport =
  GeneralGovernmentBalanceValidationSummary & {
    status: "PASS";
    dataset: string;
    sourceBytes: number;
    sourceSha256: string;
    sourceFactCount: number;
    canonicalFactCount: number;
    canonicalYearMin: number;
    canonicalYearMax: number;
    latestActualYear: number;
    firstProjectionYear: number;
    reconciliationTolerancePercentagePoints: 0.02;
  };

export type GeneralGovernmentBalancePreparationResult = {
  sourceFacts: GeneralGovernmentBalanceSourceFact[];
  canonicalFacts: GeneralGovernmentBalanceFact[];
  validation: GeneralGovernmentBalanceValidationReport;
};
