import type { ClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { MONEY_TRANSFER_MEASURES, MONEY_TRANSFER_TOTAL_ID, type MoneyTransferMeasure } from "../data/externalFlows/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export type MoneyTransfersState = { mode: "line" | "table"; measure: MoneyTransferMeasure; range: PeriodRange; selectedIds: string[] };
export const DEFAULT_MONEY_TRANSFERS_STATE: MoneyTransfersState = { mode: "line", measure: "received", range: { kind: "all" }, selectedIds: [MONEY_TRANSFER_TOTAL_ID] };

export function moneyTransfersCoverage(data: ClientMoneyTransfersData) {
  const years = [...new Set(data.facts.map(fact => fact.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error("No money transfer source years");
  return { min: years[0], max: years.at(-1)!, years };
}
export function moneyTransfersBulkSelection(data: ClientMoneyTransfersData): string[] {
  return data.entities.map(entity => entity.id);
}
export function parseMoneyTransfersHash(hash: string, data: ClientMoneyTransfersData): MoneyTransfersState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const requested = params.has("sel") ? params.get("sel")!.split(",") : [MONEY_TRANSFER_TOTAL_ID];
  const measure = params.get("measure") as MoneyTransferMeasure;
  return { mode: params.get("view") === "table" ? "table" : "line", measure: MONEY_TRANSFER_MEASURES.includes(measure) ? measure : "received", range: refitRange(parseYearRangeKeys(params), moneyTransfersCoverage(data), { collapseToAll: true }), selectedIds: moneyTransfersBulkSelection(data).filter(id => requested.includes(id)) };
}
export function serializeMoneyTransfersHash(state: MoneyTransfersState): string {
  const params = new URLSearchParams({ measure: state.measure, view: state.mode, sel: state.selectedIds.join(",") });
  writeYearRangeKeys(params, state.range);
  return params.toString();
}
