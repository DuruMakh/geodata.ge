import type { ProductIndex } from "./inflationProducts";
import { rankProducts } from "./inflationProducts";

export type ProductState = {
  indicator: "annual" | "cumulative";
  range: { startYear: number; endYear: number };
  selected: string[];
};

export function parseProductHash(hash: string, index: ProductIndex): ProductState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const indicator = params.get("i") === "cumulative" ? "cumulative" : "annual";
  const rawRange = /^(\d{4})-(\d{4})$/.exec(params.get("r") ?? "");
  const maxYear = index.defaultRange.endYear;
  const clamp = (year: number) => Math.min(maxYear, Math.max(index.earliestYear, year));
  const first = rawRange ? clamp(Number(rawRange[1])) : index.defaultRange.startYear;
  const last = rawRange ? clamp(Number(rawRange[2])) : index.defaultRange.endYear;
  const rawSelection = params.get("sel");
  const selected = rawSelection === null ? rankProducts(index).slice(0, 1) :
    [...new Set(rawSelection.split(",").filter((id) => index.productById.has(id)))];
  return { indicator, range: { startYear: Math.min(first, last), endYear: Math.max(first, last) }, selected };
}

export function serializeProductHash(state: ProductState): string {
  return new URLSearchParams({
    i: state.indicator,
    r: `${state.range.startYear}-${state.range.endYear}`,
    sel: state.selected.join(","),
  }).toString();
}

export function toggleProduct(state: ProductState, id: string): ProductState {
  return { ...state, selected: state.selected.includes(id) ? state.selected.filter((selected) => selected !== id) : [...state.selected, id] };
}
