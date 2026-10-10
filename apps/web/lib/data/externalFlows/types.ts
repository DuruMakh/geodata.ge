export type MoneyTransferEntityKind = "total" | "estimate" | "country" | "remainder";
export type MoneyTransferEntity = { id: string; kind: MoneyTransferEntityKind; labelKa: string };
export type MoneyTransferMeasure = "received" | "sent";
export const MONEY_TRANSFER_MEASURES: readonly MoneyTransferMeasure[] = ["received", "sent"];
export const MONEY_TRANSFER_TOTAL_ID = "transfer.total";
export const PERSONAL_TRANSFERS_ID = "bop.personal_transfers";
export const MONEY_TRANSFER_SOURCES = {
  transfers: "source.nbg_money_transfers_by_countries",
  estimate: "source.nbg_balance_of_payments_bpm6",
} as const;
export const MONEY_TRANSFER_YEARS = { first: 2000, last: 2025 } as const;
export type MoneyTransferFact = {
  entityId: string; year: number; measure: MoneyTransferMeasure; valueUsd: string | null;
  unit: "usd"; basis: "actual"; valueStatus: "numeric" | "blank" | "partial_months"; monthsReported: number | null;
  sourceId: string; sourceSheet: string; sourceCells: string; sourceUnit: "thousand_usd" | "million_usd"; vintage: string; lastReviewedAt: string;
};
export type MoneyTransfersData = { entities: MoneyTransferEntity[]; facts: MoneyTransferFact[] };
export type MoneyTransfersAcceptance = {
  status: "passed"; scope: "annual_money_transfers"; years: number[]; countryEntities: number; remainderEntities: number;
  transferObservations: number; estimateObservations: number;
  valueStatusCounts: { numeric: number; blank: number; partial_months: number };
  inputSha256: Record<string, string>; canonicalSha256: string; catalogueSha256: string; englishLabelsSha256: string; reviewedAt: string;
};
export function moneyTransferFactKey(fact: Pick<MoneyTransferFact, "entityId" | "measure" | "year">): string {
  return `${fact.entityId}:${fact.measure}:${fact.year}`;
}

export type ForeignInvestmentDimension = "country" | "sector" | "region";
export const FOREIGN_INVESTMENT_DIMENSIONS: readonly ForeignInvestmentDimension[] = ["country", "sector", "region"];
export type ForeignInvestmentEntity = { id: string; dimension: ForeignInvestmentDimension | null; kind: "total" | "country" | "unallocated" | "remainder" | "sector" | "region"; labelKa: string };
export const FOREIGN_INVESTMENT_TOTAL_ID = "fdi.total";
export const FOREIGN_INVESTMENT_SOURCES = {
  total: "source.geostat_fdi_by_quarters",
  country: "source.geostat_fdi_by_countries",
  sector: "source.geostat_fdi_by_sectors",
  region: "source.geostat_fdi_by_regions",
} as const;
/** Each breakdown keeps Geostat's own first year; complete years end in 2025. */
export const FOREIGN_INVESTMENT_YEARS = { total: 1996, country: 1996, sector: 2016, region: 2009, last: 2025 } as const;
export type ForeignInvestmentFact = {
  entityId: string; year: number; valueUsd: string | null; unit: "usd"; basis: "actual"; valueStatus: "numeric" | "not_applicable";
  sourceId: string; sourceSheet: string; sourceCells: string; sourceUnit: "thousand_usd" | "million_usd"; vintage: string; lastReviewedAt: string;
};
export type ForeignInvestmentData = { entities: ForeignInvestmentEntity[]; facts: ForeignInvestmentFact[] };
export type ForeignInvestmentAcceptance = {
  status: "passed"; scope: "annual_foreign_direct_investment"; years: Record<"total" | ForeignInvestmentDimension, number[]>;
  entities: Record<ForeignInvestmentDimension, number>; observations: number; valueStatusCounts: { numeric: number; not_applicable: number };
  inputSha256: Record<string, string>; canonicalSha256: string; catalogueSha256: string; englishLabelsSha256: string; reviewedAt: string;
};
export function foreignInvestmentFactKey(fact: Pick<ForeignInvestmentFact, "entityId" | "year">): string {
  return `${fact.entityId}:${fact.year}`;
}

export const CURRENT_ACCOUNT_SERIES = ["ca.balance", "ca.goods", "ca.services", "ca.primary_income", "ca.secondary_income"] as const;
export type CurrentAccountSeriesId = (typeof CURRENT_ACCOUNT_SERIES)[number];
export const CURRENT_ACCOUNT_PARTS: readonly CurrentAccountSeriesId[] = CURRENT_ACCOUNT_SERIES.slice(1);
export const CURRENT_ACCOUNT_FLOWS = ["credit", "debit", "net"] as const;
export type CurrentAccountFlow = (typeof CURRENT_ACCOUNT_FLOWS)[number];
export const CURRENT_ACCOUNT_SOURCE = "source.nbg_balance_of_payments_bpm6";
export const CURRENT_ACCOUNT_YEARS = { first: 2000, last: 2025 } as const;
export type CurrentAccountFact = {
  seriesId: CurrentAccountSeriesId; year: number; flow: CurrentAccountFlow; valueUsd: string; unit: "usd"; basis: "actual";
  sourceId: string; sourceSheet: string; sourceCells: string; sourceUnit: "million_usd"; vintage: string; lastReviewedAt: string;
};
export type CurrentAccountAcceptance = {
  status: "passed"; scope: "annual_current_account"; years: number[]; observations: number;
  inputSha256: Record<string, string>; canonicalSha256: string; reviewedAt: string;
};
export function currentAccountFactKey(fact: Pick<CurrentAccountFact, "seriesId" | "flow" | "year">): string {
  return `${fact.seriesId}:${fact.flow}:${fact.year}`;
}
