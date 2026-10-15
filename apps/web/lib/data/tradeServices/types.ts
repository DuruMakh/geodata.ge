import type { TradeOverviewIndicator } from "../tradeOverview/types";

export const TRADE_SERVICES_SOURCES = {
  export: "geostat_services_georgian-exports-of-services-by-types",
  import: "geostat_services_georgian-imports-of-services-by-types",
} as const;
export const TRADE_SERVICES_COUNTRY_SOURCES = {
  export: "geostat_services_georgian-exports-of-services-by-countries",
  import: "geostat_services_georgian-imports-of-services-by-countries",
} as const;
export const TRADE_SERVICES_RESIDUAL_IDS: Record<string, string> = {
  "Other countries": "services.other_countries",
  "International Organization": "services.international_organizations",
  "Country is not defined": "services.undefined_export_country",
  "Unknown": "services.unknown_import_country",
};
// These two published comparisons remain unresolved. Country views explicitly use the country-total files.
export const TRADE_SERVICES_JOINT_HOLDS_SHA256 = "95473c512e6458a7da8491806ca318bde18b423e302da5756322d61248f6d8c2";
export const TRADE_SERVICES_DOCUMENT_IDS: Record<string, string> = {
  [TRADE_SERVICES_SOURCES.export]: "source.geostat_services_georgian_exports_of_services_by_types",
  [TRADE_SERVICES_SOURCES.import]: "source.geostat_services_georgian_imports_of_services_by_types",
  [TRADE_SERVICES_COUNTRY_SOURCES.export]: "source.geostat_services_georgian_exports_of_services_by_countries",
  [TRADE_SERVICES_COUNTRY_SOURCES.import]: "source.geostat_services_georgian_imports_of_services_by_countries",
};
export const TRADE_SERVICE_IDS = ["services.total", "services.manufacturing", "services.maintenance_repair", "services.transport", "services.travel", "services.construction", "services.insurance_pension", "services.financial", "services.intellectual_property", "services.telecommunications_computer_information", "services.other_business", "services.personal_cultural_recreational", "services.government"] as const;
export const TRADE_SERVICES_RESEARCH = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
export const TRADE_SERVICES_INPUT_FILES = ["independent-verification.json", "prepared-validation.json", "full-source-manifest.json", "source-layouts.json", "expected-observation-inventory.json", "unresolved-source-issues.json", "prepared-reconciliation.csv", "coverage.csv", "services-annual.csv", ...Object.keys(TRADE_SERVICES_DOCUMENT_IDS).map(id => `source-observations/${id}-01-2020-2024.csv`)];
export type TradeServiceEntity = { id: string; kind: "national" | "service_type" | "country" | "residual"; labelKa: string; labelEn: string };
export type TradeServiceFact = {
  entityId: string; year: number; indicatorId: TradeOverviewIndicator; valueUsd: string | null;
  unit: "usd"; basis: "actual"; valueStatus: "numeric" | "not_applicable"; publicationStatus: "unspecified";
  role: "total" | "detail" | "residual" | "derived"; sourceId: string | null; sourceRefs: string;
  sourceValue: string | null; sourceUnit: string | null; sourceLabel: string | null;
  sourceNumberFormat: string | null; sourceBlock: string | null; lastReviewedAt: string;
};
export type TradeServicesData = { entities: TradeServiceEntity[]; facts: TradeServiceFact[] };
export type TradeServicesAcceptance = {
  status: "passed"; scope: "annual_services_types_and_countries"; years: number[]; countrySourcePolicy: "published_country_totals";
  countryControlObservations: number;
  primaryObservations: number; numericObservations: number; unavailableObservations: number; derivedObservations: number;
  canonicalSha256: string; catalogueSha256: string; englishLabelsSha256: string;
  inputSha256: Record<string, string>; sourceSha256: Record<string, string>;
  researchPackageStatus: string; outsideScopeHoldCount: number; outsideScopeHolds: Record<string, string>[]; reviewedAt: string;
};
export const tradeServicesFactKey = (fact: Pick<TradeServiceFact, "entityId" | "year" | "indicatorId">) => `${fact.entityId}:${fact.year}:${fact.indicatorId}`;
export const TRADE_SERVICES_FIELDS = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];
