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
  sourceDataset: "IMF.RES:WEO(9.0.0)";
  sourceVintage: "2026-04";
  sourceSheet: "Countries";
  sourceCountryId: "GEO";
  sourcePercentSeriesCode: "GEO.GGXCNL_NGDP.A";
  sourceNominalSeriesCode: "GEO.GGXCNL.A";
  sourceUnit: "billion GEL";
  transformation: string;
  lastReviewedAt: "2026-09-04";
};

export type GeneralGovernmentBalanceValidationSummary = {
  maximumReconciliationDifferencePercentagePoints: number;
  reconciliationFailureYears: number[];
};

export type GeneralGovernmentBalanceValidationReport =
  GeneralGovernmentBalanceValidationSummary & {
    status: "PASS";
    dataset: "IMF.RES:WEO(9.0.0)";
    sourceBytes: 5585205;
    sourceSha256: string;
    sourceFactCount: 111;
    canonicalFactCount: 37;
    canonicalYearMin: 1995;
    canonicalYearMax: 2031;
    latestActualYear: 2025;
    firstProjectionYear: 2026;
    reconciliationTolerancePercentagePoints: 0.02;
  };

export type GeneralGovernmentBalancePreparationResult = {
  sourceFacts: GeneralGovernmentBalanceSourceFact[];
  canonicalFacts: GeneralGovernmentBalanceFact[];
  validation: GeneralGovernmentBalanceValidationReport;
};
