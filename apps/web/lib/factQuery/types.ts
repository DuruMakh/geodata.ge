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

export type PublicDocument = {
  documentId: string;
  title: string;
  publisher: string;
  officialUrl: string | null;
  archiveUrl: string | null;
  /** Years the document covers, so a grouped source can be narrowed (spec section 6.8). */
  years: number[];
  datasetId: string | null;
  sha256: string;
  byteSize: number;
  mediaType: string;
  retrievedAt: string;
  /**
   * Null for the two package manifests (GDP, Geostat municipal population),
   * whose schema carries no licence or attribution column. Reported as absent
   * rather than filled with a guess.
   */
  licenceId: string | null;
  attribution: string | null;
};

export type ResolvedSource = {
  sourceId: string;
  name: string;
  lastReviewedAt: string;
  /**
   * Non-null when the figures behind this source are fiscal.ge's own reviewed
   * calculation rather than a published document. The text states how they
   * were derived, and `documents` then carries the UPSTREAM originals rather
   * than a document of the derived figures themselves — there is none.
   */
  derivation: string | null;
  documents: PublicDocument[];
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
    /**
     * `${seriesId}:${year}` cells actually served through an approved join, from
     * PROGRAM_SUCCESSIONS and LEGACY_PROGRAM_JOINS. Per CELL, not per series: a joined
     * series serves most of its years from its own official code, and only the years
     * inside a succession's `startYear..endYear` or a legacy join's `year` came in
     * through the join. A bare series id cannot express that, and pinned
     * `program_historical_join` to every year of a joined series.
     */
    historicalJoinSeriesYears: string[];
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
