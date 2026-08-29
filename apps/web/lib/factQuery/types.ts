// apps/web/lib/factQuery/types.ts
import type { ServedAdminFact, ServedBudgetFact, ServedNationalGdpFact } from "../servedRows";
import type { AdminSpendingCategory } from "../data/adminSpending/types";
import type {
  AdjaraBudgetAdjustment,
  Municipality,
  MunicipalFunction,
  MunicipalFunctionFact,
  MunicipalPopulationFact,
  MunicipalRegion,
  MunicipalTotalFact,
} from "../data/municipal/types";

// Re-exported so the caveat engine (and other factQuery modules) can import
// these from "./types" instead of reaching into ../servedRows or
// ../data/municipal/types directly.
export type { MunicipalTotalFact } from "../data/municipal/types";
export type { ServedNationalGdpFact } from "../servedRows";

export const SCHEMA_VERSION = "1.0.0" as const;

/** Municipal codes whose budgets are not territorially attributable (spec section 5.4). */
export const AGGREGATE_ONLY_MUNICIPAL_CODES = ["05", "42", "43", "46", "64"] as const;

export type DatasetId =
  | "national-revenue"
  | "national-expenditure"
  | "ministries"
  | "municipal-expenditure";

export type Measure = "amount_gel" | "share_of_total_pct" | "share_of_gdp_pct" | "gel_per_resident";
export type Unit = "GEL" | "percent" | "GEL_per_resident";
export type Severity = "severe" | "note";
export type Availability = "available" | "missing";

export type BudgetItemMeta = {
  id: string;
  side: "revenue" | "expenditure";
  kaLabel: string;
  sortOrder: number;
};

export type Caveat = {
  code: string;
  severity: Severity;
  messageKa: string;
  messageEn: string;
  methodologyRef: string;
  affects: string[];
};

export type Coverage = {
  requestedYears: number[];
  availableYears: number[];
  returnedYears: number[];
  missingCells: { entityId: string; seriesId: string; year: number; reason: string }[];
  excludedEntities: { entityId: string; reason: string }[];
  returnedCount: number;
  expectedCount: number;
};

export type ResolvedSource = {
  sourceId: string;
  name: string;
  lastReviewedAt: string;
  documents: {
    documentId: string;
    title: string;
    officialUrl: string | null;
    archiveUrl: string | null;
  }[];
};

export type FactQuerySnapshot = {
  schemaVersion: typeof SCHEMA_VERSION;
  dataVersion: string;
  releaseCommit: string;
  generatedAt: string;
  national: { facts: ServedBudgetFact[]; items: BudgetItemMeta[] };
  ministries: {
    facts: ServedAdminFact[];
    categories: AdminSpendingCategory[];
    /** Series with an approved join, from PROGRAM_SUCCESSIONS and LEGACY_PROGRAM_JOINS. */
    historicalJoinSeriesIds: string[];
  };
  municipal: {
    functions: MunicipalFunction[];
    regions: MunicipalRegion[];
    municipalities: Municipality[];
    functionFacts: MunicipalFunctionFact[];
    totalFacts: MunicipalTotalFact[];
    countryFunctionFacts: MunicipalFunctionFact[];
    countryTotalFacts: MunicipalTotalFact[];
    adjaraBudgetAdjustments: AdjaraBudgetAdjustment[];
    populationFacts: MunicipalPopulationFact[];
    slugByCode: Record<string, string>;
  };
  gdpFacts: ServedNationalGdpFact[];
  sources: ResolvedSource[];
};

export type FactQueryError = {
  code: string;
  messageKa: string;
  messageEn: string;
  retryable: boolean;
  validChoices?: string[];
};

export type FactQueryResponse =
  | { kind: "catalogue" | "observations" | "comparisons" | "ranking" | "sources"; status: "ok" | "partial" | "empty"; data: unknown; meta: ResponseMeta }
  | { kind: "error"; status: "error"; error: FactQueryError; meta: ResponseMeta };

/** Fields every snapshot-derived response repeats. */
export type ResponseMeta = {
  schemaVersion: string;
  dataVersion: string;
  releaseCommit: string;
  generatedAt: string;
  licence: "CC BY 4.0";
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/";
  sources: ResolvedSource[];
  caveats: Caveat[];
};
