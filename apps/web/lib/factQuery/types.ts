// apps/web/lib/factQuery/types.ts
import type {
  ServedAdminFact,
  ServedBudgetFact,
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
  ServedNationalGdpFact,
} from "../servedRows";
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

export const SCHEMA_VERSION = "1.1.0" as const;

/** Municipal codes whose budgets are not territorially attributable (spec section 5.4). */
export const AGGREGATE_ONLY_MUNICIPAL_CODES = ["05", "42", "43", "46", "64"] as const;

export type DatasetId =
  | "national-revenue"
  | "national-expenditure"
  | "ministries"
  | "municipal-expenditure"
  | "government-debt"
  | "general-government-balance"
  | "gdp-overview"
  | "economic-sectors";

// rate_percent is a rate per annum, NOT a share of anything. Reusing
// share_of_gdp_pct or share_of_total_pct for a weighted-average interest rate
// would mislabel the number.
export type Measure =
  | "amount_gel"
  | "share_of_total_pct"
  | "share_of_gdp_pct"
  | "gel_per_resident"
  | "rate_percent"
  | "value"
  | "real_growth_pct";

/**
 * `planned` means a budget a government approved. `projection` means neither an
 * outcome nor a plan: a schedule of what the EXISTING debt portfolio will cost
 * (debt service after the last actual year), or an IMF forecast of the economy
 * (the general government balance after the last actual year). Both source
 * datasets already use the literal string "projection" for their own status, so
 * this name is taken from the data rather than invented here.
 */
export type Basis = "actual" | "planned" | "projection" | "published" | "preliminary";
export type Unit = "GEL" | "percent" | "GEL_per_resident" | "USD" | "USD_2015" | "GEL_per_person" | "USD_per_person";
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
  methodologyRefEn: string;
  affects: string[];
};

export type Coverage = {
  requestedYears: number[];
  availableYears: number[];
  returnedYears: number[];
  missingCells: { entityId: string; seriesId: string; year: number; reason: string; reasonEn: string }[];
  excludedEntities: { entityId: string; reason: string; reasonEn: string }[];
  returnedCount: number;
  expectedCount: number;
};

export type PublicDocument = {
  documentId: string;
  title: string;
  publisher: string;
  titleKa: string;
  titleEn: string;
  publisherKa: string;
  publisherEn: string;
  attributionKa: string | null;
  attributionEn: string | null;
  documentLanguage: "ka" | "en" | "mul" | null;
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
  /**
   * What this document IS to the source that cites it.
   *
   * "primary" - the publication of these figures.
   * "derivation_upstream" - an INPUT to a calculation fiscal.ge performed. The
   *   derived figures themselves have no publication; this document does not
   *   contain them.
   *
   * Without this the two carried an identical field set, and the only
   * discriminant was the sibling `derivation` field on the source. Any consumer
   * rendering `documents` without checking that first would present the Adjara
   * republican-payments PDF as the publication of the consolidated total, which
   * is exactly the "dressed up as a primary publication" failure the
   * non-negotiable warns about.
   */
  role: "primary" | "derivation_upstream";
};

/**
 * Document fields a source may state once for all of its documents.
 *
 * These describe the source rather than the individual file - who published it,
 * under what licence, when it was retrieved - so a source whose documents agree
 * on them is repeating itself once per document. Sixty-five municipal workbooks
 * carried seven identical values each, 25 KiB of a 69 KiB evidence block.
 *
 * Fields NOT in this list never hoist: documentId, title, years and the two
 * URLs identify the specific document, and the point of the block is to name
 * documents.
 */
export const HOISTABLE_DOCUMENT_FIELDS = [
  "publisher",
  "publisherKa",
  "publisherEn",
  "attribution",
  "attributionKa",
  "attributionEn",
  "licenceId",
  "mediaType",
  "retrievedAt",
  "datasetId",
  "role",
] as const;

export type HoistableDocumentField = (typeof HOISTABLE_DOCUMENT_FIELDS)[number];

export type DocumentDefaults = Partial<Pick<PublicDocument, HoistableDocumentField>>;

/**
 * A document as a RESPONSE carries it, which is not how the snapshot stores it.
 *
 * `sha256` and `byteSize` are absent: they answer "do these bytes match what
 * was reviewed", which is get_sources' question, not "what should I cite".
 * get_sources' own `data` and the published sources.json both keep them.
 *
 * A hoistable field is absent when its source states it in `documentDefaults`.
 */
export type ResponseDocument = Omit<PublicDocument, "sha256" | "byteSize" | HoistableDocumentField> & DocumentDefaults;

export type ResponseSource = Omit<ResolvedSource, "documents"> & {
  /**
   * Values shared by every document below. A field absent from a document takes
   * its value from here; a field that differs between documents is not here and
   * appears on each document instead.
   */
  documentDefaults?: DocumentDefaults;
  documents: ResponseDocument[];
};

export type ResolvedSource = {
  sourceId: string;
  name: string;
  nameKa: string;
  nameEn: string;
  derivationKa: string | null;
  derivationEn: string | null;
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

export type RawPublicDocument = Omit<PublicDocument, "titleKa" | "titleEn" | "publisherKa" | "publisherEn" | "attributionKa" | "attributionEn" | "documentLanguage">;
export type RawResolvedSource = Omit<ResolvedSource, "nameKa" | "nameEn" | "derivationKa" | "derivationEn" | "documents"> & { documents: RawPublicDocument[] };

export type ServiceLocalization = {
  labelsEn: Record<string, string>;
  programmeHistoryEn: Record<string, Record<string, string>>;
  messages: { ka: Record<string, string>; en: Record<string, string> };
};

export type FactQuerySnapshot = {
  localization: ServiceLocalization;
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
  debt: { facts: ServedGovernmentDebtFact[] };
  deficit: { facts: ServedGeneralGovernmentBalanceFact[] };
  gdpOverview: { facts: import("../data/gdpOverview/types").GdpObservation[]; series: typeof import("./gdpSeries").GDP_QUERY_SERIES };
  economicSectors: { facts: import("../data/economicSectors/types").SectorObservation[]; registry: import("../data/economicSectors/types").SectorDefinition[]; definitions: typeof import("./economicSectorsSeries").SECTOR_DEFINITIONS };
  gdpFacts: ServedNationalGdpFact[];
  sources: ResolvedSource[];
};

/**
 * The nine debt series and their Georgian labels, in publication order.
 *
 * One map, consumed by queryDebt (an observation's seriesLabelKa),
 * describeCoverage (the catalogue's labelKa) and publications (which series go
 * in which file). They were three separate copies, which meant an observation
 * and the catalogue entry describing it could drift apart with nothing to catch
 * it - the same hazard the budgetScope constants carry a comment about.
 */
export const DEBT_SERIES_LABELS_KA: Readonly<Record<string, string>> = {
  "debt.stock.total": "მთლიანი ვალი",
  "debt.stock.domestic": "საშინაო ვალი",
  "debt.stock.external": "საგარეო ვალი",
  "debt.service.total": "ვალის მომსახურება — ჯამი",
  "debt.service.principal": "ძირითადი თანხის გადახდა",
  "debt.service.interest": "პროცენტის გადახდა",
  "debt.rate.total": "საშუალო შეწონილი განაკვეთი — ჯამი",
  "debt.rate.domestic": "საშუალო შეწონილი განაკვეთი — საშინაო",
  "debt.rate.external": "საშუალო შეწონილი განაკვეთი — საგარეო",
};

/** The single series of the general government balance dataset. */
export const DEFICIT_SERIES_ID = "deficit.general_government.balance";

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
  sources: ResponseSource[];
  caveats: Caveat[];
};
