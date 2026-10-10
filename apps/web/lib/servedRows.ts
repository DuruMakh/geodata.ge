// The contract between the build-time data layer and everything that ships to
// the browser.
//
// The ingestion rows (BudgetFactImportRow, AdminSpendingFact) carry validation
// and provenance columns — mapping notes and confidence, official codes, the
// public spending field id, institution/program/subprogram strings — that exist
// for validation, mapping review and the db parity check. No component or view
// model reads any of them (explorerData.ts even documents that officialCode is
// deliberately never surfaced), yet serving those rows verbatim inlined them
// into every explorer route's payload and tied the client to the ingestion
// schema.
//
// This file lives at the lib root, not in lib/data, and deliberately has NO
// imports. lib/data's modules pull in csv-parse, zod, decimal.js and node:fs;
// a client-facing type that sits among them is one accidental value import away
// from dragging a CSV parser into the browser bundle. With zero imports here
// that cannot happen.
//
// The projection itself lives in lib/data/servedData.ts, which already owns the
// ingestion types. Its mapper return annotations are the drift guard: if an
// ingestion union gains a member, assigning it to the narrow union below fails
// to typecheck.

export type ServedBudgetFact = {
  year: number;
  side: "revenue" | "expenditure";
  itemId: string;
  amountGel: number;
  basis: "actual" | "planned";
  sourceId: string;
};

export type ServedAdminFact = {
  year: number;
  itemId: string;
  parentItemId: string | null;
  level: "admin_category" | "major_program";
  amountGel: number;
  basis: "actual";
  sourceId: string;
  officialLabelKa: string | null;
  officialInstitutionLabelKa: string | null;
};

export type ServedNationalGdpFact = {
  year: number;
  gdpCurrentPricesGel: number;
  accountingStandard: "sna_1993" | "sna_2008";
  status: "final_as_published" | "preliminary";
  sourceId: string;
};

export type DebtFamily = "stock" | "service" | "rate";

export type DebtSeriesId =
  | "debt.stock.total"
  | "debt.stock.domestic"
  | "debt.stock.external"
  | "debt.service.total"
  | "debt.service.principal"
  | "debt.service.interest"
  | "debt.rate.total"
  | "debt.rate.domestic"
  | "debt.rate.external";

export type ServedGovernmentDebtFact = {
  year: number;
  family: DebtFamily;
  seriesId: DebtSeriesId;
  value: number | null;
  valueKind: "amount_gel" | "percent";
  status: "actual" | "projection_existing_portfolio" | "not_available";
  sourceId: string | null;
  snapshotDate: string | null;
  lastReviewedAt: string;
};

export type ServedGeneralGovernmentBalanceFact = {
  year: number;
  generalGovernmentBalancePctGdp: number;
  generalGovernmentBalanceGel: number;
  status: "actual" | "projection";
  sourceId: string;
  lastReviewedAt: string;
};

// Explorer pages send these to the browser instead of the served rows. The
// unread provenance columns (sourceLocator, unit, valuation, priceBasis,
// accountingStandard, per-row lastReviewedAt) stay on the server; each page
// hoists the source ids its workbook builder needs into one small map and
// passes the newest review date once.
export type ClientGdpObservation = {
  seriesId: string;
  year: number;
  value: number;
  status: "published" | "preliminary";
};

/**
 * A source id per run of years, newest run first, rather than per row.
 *
 * GDP changed national accounts standard mid-history, so four of its six
 * series cite one Geostat vintage before 2010 and another from 2010 on: a
 * series-only key would drop a source from any range spanning the switch.
 * Keying all 251 rows by `${seriesId}:${year}` is correct but ships 14.6 kB,
 * more than the 11.5 kB `sourceId` column it replaced. The id only changes at
 * a boundary, so one entry per boundary carries the same answer in 0.8 kB.
 */
export type SourceIdRanges = Readonly<
  Record<string, readonly { fromYear: number; sourceId: string }[]>
>;

export type ClientSectorObservation = {
  seriesId: string;
  year: number;
  measure: "nominal" | "share_of_gdp" | "real_growth";
  value: number;
  status: "published" | "preliminary";
};

// The workbook cites the targets' source, and the chart reads the band and
// its effective dates. lastReviewedAt is not read anywhere on the client.
export type ClientInflationTargetRow = {
  effectiveFrom: string;
  effectiveTo: string | null;
  targetPct: number;
  sourceId: string;
};

export type ClientCpiFact = {
  seriesId: string;
  measure: string;
  period: string;
  value: number;
};

export type ClientBasketWeightRow = {
  categoryId: string;
  year: number;
  weightPct: number;
};

export type ClientGovernmentDebtFact = Omit<
  ServedGovernmentDebtFact,
  "snapshotDate" | "lastReviewedAt"
>;

export type ClientRegionalEconomyObservation = {
  regionId: string;
  seriesId: string;
  year: number;
  measure: "nominal" | "share_of_region_gdp";
  value: number;
  status: "published";
};

/** A demography observation as the browser receives it: no locator, review date or basis code. */
export type ClientDemographyObservation = {
  geographyId: string;
  seriesId: string;
  year: number;
  value: number;
};

/** A migration row as the Migration page receives it: one direction, sex and citizenship group in one year, in persons. */
export type ClientMigrationFact = {
  seriesId: string;
  year: number;
  sex: "total" | "male" | "female";
  citizenshipId: string;
  value: number;
};

/** A national rate as the browser receives it: the fertility and life-expectancy series, with the mother's age group where it has one ("" otherwise). */
export type ClientNationalFact = { seriesId: string; year: number; ageGroup: string; value: number };
