export type SectorMeasure = "nominal" | "share_of_gdp" | "real_growth";
export type SectorStatus = "published" | "preliminary";
export type SectorDefinition = {
  id: string;
  classificationCode: string | null;
  sortOrder: number;
  officialName: string;
  labelKa: string;
  labelEn: string;
};

export type SectorObservation = {
  seriesId: string;
  year: number;
  measure: SectorMeasure;
  value: string;
  unit: "gel" | "percent";
  // For shares this describes the numerator; the denominator is market-price GDP.
  valuation: "basic_prices" | "market_prices";
  priceBasis: "current_prices" | "volume_change";
  calculation: "published" | "ratio_to_gdp" | "year_over_year" | "index_to_growth";
  status: SectorStatus;
  sourceId: string;
  // Calculated observations join contributing locators, in input order, with "; ".
  // GDP shares use numerator then denominator, including GDP / GDP itself.
  sourceLocator: string;
  lastReviewedAt: string;
};
export type ServedSectorObservation = Omit<SectorObservation, "value"> & {
  value: number;
};
export type SectorValidationReport = {
  missingCells: { seriesId: string; year: number; measure: SectorMeasure }[];
};
