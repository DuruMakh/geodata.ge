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
