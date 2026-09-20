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

export type ClientSectorObservation = {
  seriesId: string;
  year: number;
  measure: "nominal" | "share_of_gdp" | "real_growth";
  value: number;
  status: "published" | "preliminary";
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
