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
