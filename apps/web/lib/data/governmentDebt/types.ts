export const GOVERNMENT_DEBT_SOURCE_IDS = [
  "mof_public_debt_bulletin_n7",
  "mof_public_debt_bulletin_n13",
  "mof_public_debt_bulletin_n19",
  "mof_public_debt_bulletin_n25",
  "mof_monthly_debt_report_2026_07",
  "mof_debt_strategy_2019_2021",
  "mof_debt_strategy_2022_2025",
  "mof_debt_strategy_2023_2026",
  "mof_debt_strategy_2025_2029",
  "mof_central_government_liabilities_control",
] as const;

export type GovernmentDebtSourceId =
  (typeof GOVERNMENT_DEBT_SOURCE_IDS)[number];

export type DebtScope = "total" | "domestic" | "external";

export type AvailabilityStatus =
  | "available"
  | "not_published_in_reviewed_source"
  | "not_found_in_reviewed_sources";

export type SourceRole =
  | "canonical_stock"
  | "canonical_actual_service"
  | "canonical_interest_rate"
  | "canonical_forecast"
  | "control_only";

export type SourceManifestRow = {
  source_id: GovernmentDebtSourceId;
  dataset_title: string;
  publisher: "Ministry of Finance of Georgia";
  roles: string;
  document_date: string;
  source_page_url: string;
  retrieved_file_url: string;
  retrieved_at: string;
  local_file: string;
  sha256: string;
  bytes: string;
  source_period_min: string;
  source_period_max: string;
  used_period_min: string;
  used_period_max: string;
  notes: string;
};

export type MethodologyNoteRow = {
  methodology_note_id: string;
  effective_date: string;
  affected_dataset: string;
  affected_scope: "domestic";
  note_ka: string;
  note_en: string;
  source_id: GovernmentDebtSourceId;
};

export type GovernmentDebtStockRow = {
  year: number;
  debt_scope: DebtScope;
  amount_million_gel: number;
  amount_gel: number;
  observation_date: string;
  status: "actual";
  source_id: GovernmentDebtSourceId;
  source_table: string;
  source_row_label: string;
  source_unit: "Million GEL";
  transformation: string;
  methodology_note_id: string;
  last_reviewed_at: string;
};

export type GovernmentDebtActualServiceRow = {
  year: number;
  debt_scope: DebtScope;
  principal_paid_million_gel: number;
  interest_paid_million_gel: number;
  principal_paid_gel: number;
  interest_paid_gel: number;
  status: "actual";
  source_id: GovernmentDebtSourceId;
  source_table: string;
  source_row_label: string;
  source_unit: "Million GEL";
  transformation: string;
  methodology_note_id: string;
  last_reviewed_at: string;
};

export type GovernmentDebtInterestRateRow = {
  year: number;
  debt_scope: DebtScope;
  weighted_average_interest_rate_percent: number | null;
  observation_date: string;
  portfolio_scope: string;
  rate_definition: "Year-end weighted-average annual interest rate";
  availability_status: AvailabilityStatus;
  source_id: GovernmentDebtSourceId;
  source_table: string;
  source_row_label: string;
  source_unit: "% p.a.";
  transformation: string;
  last_reviewed_at: string;
};

export type GovernmentDebtForecastRow = {
  snapshot_date: "2025-12-31";
  payment_year: number;
  debt_scope: DebtScope;
  principal_source_amount: number;
  interest_source_amount: number;
  source_currency: "GEL" | "USD";
  published_exchange_rate: number;
  published_exchange_rate_definition: string;
  source_exchange_rate_to_gel: number;
  principal_million_gel: number;
  interest_million_gel: number;
  total_service_million_gel: number;
  status: "projection_existing_portfolio";
  coverage_note: string;
  source_id: GovernmentDebtSourceId;
  source_table: string;
  source_row_label: string;
  transformation: string;
  last_reviewed_at: string;
};

export type ControlYearComparison = {
  year: 2019 | 2022;
  total_million_gel: number;
  domestic_million_gel: number;
  external_million_gel: number;
  source_cells: string;
};

export type GovernmentDebtRateGap = {
  year: number;
  debt_scope: DebtScope;
  availability_status: Exclude<AvailabilityStatus, "available">;
  reason: string;
};

export type GovernmentDebtGdpShareCheck = {
  year: number;
  debt_total_million_gel: number;
  gdp_million_gel: number;
  calculated_share_percent: number;
  published_share_percent: number;
  difference_percentage_points: number;
  comparison_status: "rounding_match" | "possible_gdp_vintage_difference";
};

export type GovernmentDebtControlComparison = {
  year: 2019 | 2022;
  canonical_total_million_gel: number;
  canonical_domestic_million_gel: number;
  canonical_external_million_gel: number;
  control_total_million_gel: number;
  control_domestic_million_gel: number;
  control_external_million_gel: number;
  source_cells: string;
};

export type GovernmentDebtStockOverlapComparison = {
  control_source_id:
    | "mof_public_debt_bulletin_n13"
    | "mof_public_debt_bulletin_n19";
  year: number;
  debt_scope: DebtScope;
  canonical_amount_million_gel: number;
  control_amount_million_gel: number;
  difference_million_gel: number;
  comparison_status: "exact_match" | "revision";
};

export type GovernmentDebtValidationReport = {
  status: "complete_with_documented_rate_gaps" | "failed";
  review_date: "2026-09-01";
  sources: {
    rowCount: number;
    sourceIds: GovernmentDebtSourceId[];
  };
  stock: {
    rowCount: number;
    observedYears: number[];
    overlapComparisons: GovernmentDebtStockOverlapComparison[];
  };
  actualService: { rowCount: number; observedYears: number[] };
  interestRates: {
    rowCount: number;
    availableCount: number;
    gaps: GovernmentDebtRateGap[];
  };
  forecast: {
    rowCount: number;
    paymentYears: number[];
    snapshotDate: "2025-12-31";
  };
  gdpShareChecks: GovernmentDebtGdpShareCheck[];
  controlComparisons: GovernmentDebtControlComparison[];
  estimates_created: 0;
  source_hashes_match: true;
  normalized_values_reconcile: true;
};

export type GovernmentDebtPackageBuild = {
  stockRows: GovernmentDebtStockRow[];
  actualServiceRows: GovernmentDebtActualServiceRow[];
  interestRateRows: GovernmentDebtInterestRateRow[];
  forecastRows: GovernmentDebtForecastRow[];
  validation: GovernmentDebtValidationReport;
};
