export type GdpAccountingStandard = "sna_1993" | "sna_2008";
export type GdpStatus = "final_as_published" | "preliminary";

export type NationalGdpSourceFact = {
  year: number;
  gdpCurrentPricesMillionGel: number;
  accountingStandard: GdpAccountingStandard;
  status: GdpStatus;
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  sourceUnit: "mil. GEL";
};

export type NationalGdpFact = NationalGdpSourceFact & {
  gdpCurrentPricesGel: number;
  transformation: string;
  lastReviewedAt: string;
};

export type NationalGdpValidationReport = {
  status: "PASS";
  sourceHashesMatch: true;
  sourceBytes: {
    sna1993: number;
    sna2008: number;
  };
  sourceHashes: {
    sna1993: string;
    sna2008: string;
  };
  sourceFactCount: number;
  canonicalFactCount: number;
  canonicalYearMin: number;
  canonicalYearMax: number;
  overlapYears: number[];
};

export type NationalGdpPreparationResult = {
  sourceFacts: NationalGdpSourceFact[];
  canonicalFacts: NationalGdpFact[];
  validation: NationalGdpValidationReport;
};
