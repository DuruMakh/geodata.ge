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
