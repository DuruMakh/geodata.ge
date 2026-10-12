import type { ClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import { FOREIGN_INVESTMENT_DIMENSIONS, FOREIGN_INVESTMENT_TOTAL_ID, type ForeignInvestmentDimension } from "../data/externalFlows/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export type ForeignInvestmentState = { mode: "line" | "table"; dimension: ForeignInvestmentDimension; range: PeriodRange; selectedIds: string[] };
export const DEFAULT_FOREIGN_INVESTMENT_STATE: ForeignInvestmentState = { mode: "line", dimension: "country", range: { kind: "all" }, selectedIds: [FOREIGN_INVESTMENT_TOTAL_ID] };
/** The page's own series: the country-tab total less its top 10 countries. */
export const FOREIGN_INVESTMENT_OTHERS_ID = "fdi.others";

/** A tab's years: those where any of its items has a value. */
export function foreignInvestmentCoverage(data: ClientForeignInvestmentData, dimension: ForeignInvestmentDimension) {
  const ids = new Set(data.entities.filter(entity => entity.dimension === dimension).map(entity => entity.id));
  const years = [...new Set(data.facts.filter(fact => ids.has(fact.entityId) && fact.valueUsd !== null).map(fact => fact.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error(`No foreign investment years for ${dimension}`);
  return { min: years[0], max: years.at(-1)!, years };
}
/** Every id a saved view on this tab may select, in list order. */
export function foreignInvestmentTabIds(data: ClientForeignInvestmentData, dimension: ForeignInvestmentDimension): string[] {
  return [FOREIGN_INVESTMENT_TOTAL_ID, ...data.entities.filter(entity => entity.dimension === dimension).map(entity => entity.id), ...(dimension === "country" ? [FOREIGN_INVESTMENT_OTHERS_ID] : [])];
}
export function switchForeignInvestmentTab(state: ForeignInvestmentState, dimension: ForeignInvestmentDimension, data: ClientForeignInvestmentData): ForeignInvestmentState {
  return { ...state, dimension, selectedIds: [FOREIGN_INVESTMENT_TOTAL_ID], range: refitRange(state.range, foreignInvestmentCoverage(data, dimension), { collapseToAll: true }) };
}
export function parseForeignInvestmentHash(hash: string, data: ClientForeignInvestmentData): ForeignInvestmentState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const tab = params.get("tab") as ForeignInvestmentDimension, dimension = FOREIGN_INVESTMENT_DIMENSIONS.includes(tab) ? tab : "country";
  const requested = params.has("sel") ? params.get("sel")!.split(",") : [FOREIGN_INVESTMENT_TOTAL_ID];
  return { mode: params.get("view") === "table" ? "table" : "line", dimension, range: refitRange(parseYearRangeKeys(params), foreignInvestmentCoverage(data, dimension), { collapseToAll: true }), selectedIds: foreignInvestmentTabIds(data, dimension).filter(id => requested.includes(id)) };
}
export function serializeForeignInvestmentHash(state: ForeignInvestmentState): string {
  const params = new URLSearchParams({ tab: state.dimension, view: state.mode, sel: state.selectedIds.join(",") });
  writeYearRangeKeys(params, state.range);
  return params.toString();
}
