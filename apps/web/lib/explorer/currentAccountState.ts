import type { ClientCurrentAccountFact } from "../data/externalFlows/importCurrentAccount";
import { CURRENT_ACCOUNT_SERIES, type CurrentAccountSeriesId } from "../data/externalFlows/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export const CURRENT_ACCOUNT_TABS = ["balance", "in", "out"] as const;
export type CurrentAccountTab = (typeof CURRENT_ACCOUNT_TABS)[number];
export type CurrentAccountUnit = "usd" | "gdp";
/** The selection applies to Money in and Money out; the Balance tab always shows every part. */
export type CurrentAccountState = { tab: CurrentAccountTab; unit: CurrentAccountUnit; mode: "line" | "table"; range: PeriodRange; selectedIds: CurrentAccountSeriesId[] };
export const DEFAULT_CURRENT_ACCOUNT_STATE: CurrentAccountState = { tab: "balance", unit: "usd", mode: "line", range: { kind: "all" }, selectedIds: ["ca.balance"] };

export function currentAccountCoverage(facts: readonly ClientCurrentAccountFact[]) {
  const years = [...new Set(facts.map(fact => fact.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error("No current account source years");
  return { min: years[0], max: years.at(-1)!, years };
}
export function parseCurrentAccountHash(hash: string, facts: readonly ClientCurrentAccountFact[]): CurrentAccountState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const requested = params.has("sel") ? params.get("sel")!.split(",") : DEFAULT_CURRENT_ACCOUNT_STATE.selectedIds;
  const tab = params.get("tab") as CurrentAccountTab;
  return {
    tab: CURRENT_ACCOUNT_TABS.includes(tab) ? tab : "balance", unit: params.get("unit") === "gdp" ? "gdp" : "usd", mode: params.get("view") === "table" ? "table" : "line",
    range: refitRange(parseYearRangeKeys(params), currentAccountCoverage(facts), { collapseToAll: true }), selectedIds: CURRENT_ACCOUNT_SERIES.filter(id => requested.includes(id)),
  };
}
export function serializeCurrentAccountHash(state: CurrentAccountState): string {
  const params = new URLSearchParams({ tab: state.tab, unit: state.unit, view: state.mode, sel: state.selectedIds.join(",") });
  writeYearRangeKeys(params, state.range);
  return params.toString();
}
