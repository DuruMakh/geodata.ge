export type RegionalEconomyMeasure = "nominal" | "share_of_region_gdp";
export type RegionalEconomyStatus = "published";
export const REGIONAL_GDP_TOTAL = "economy.regional_gdp_total" as const;

export type RegionalEconomyObservation = {
  regionId: string;
  seriesId: string;
  year: number;
  measure: RegionalEconomyMeasure;
  value: string;
  unit: "gel" | "percent";
  valuation: "basic_prices" | "market_prices";
  priceBasis: "current_prices";
  calculation: "published" | "ratio_to_region_gdp";
  status: RegionalEconomyStatus;
  sourceId: string;
  sourceLocator: string;
  lastReviewedAt: string;
};

export type ServedRegionalEconomyObservation = Omit<RegionalEconomyObservation, "value"> & {
  value: number;
};

export type RegionalEconomyValidationReport = {
  counts: {
    regions: number;
    years: number;
    selectableSeries: number;
    nominal: number;
    shareOfRegionGdp: number;
    total: number;
  };
  uniqueKeys: number;
};
