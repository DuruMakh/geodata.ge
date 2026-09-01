import type { DebtFamily, DebtSeriesId } from "../servedRows";
import {
  DEFAULT_DEBT_FAMILY,
  DEBT_FAMILIES,
  familyForDebtSeries,
  isDebtSeriesId,
  normalizeDebtSelection,
} from "./debtExplorer";
import type { ChartMode } from "./types";

export type DebtUrlState = {
  family: DebtFamily;
  chartMode?: ChartMode;
  share?: boolean;
  range?: { start: number; end: number };
  selection?: DebtSeriesId[];
};

function isDebtFamily(value: string | null): value is DebtFamily {
  return value !== null && (DEBT_FAMILIES as readonly string[]).includes(value);
}

function selectionIds(value: string): string[] {
  return [...new Set(value.split(",").filter(Boolean))];
}

export function parseDebtHash(hash: string): DebtUrlState {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const rawSelection = params.has("sel") ? selectionIds(params.get("sel") ?? "") : undefined;
    const firstSelectedFamily = rawSelection?.find(isDebtSeriesId);
    const rawFamily = params.get("f");
    const family = isDebtFamily(rawFamily)
      ? rawFamily
      : firstSelectedFamily
        ? familyForDebtSeries(firstSelectedFamily)
        : DEFAULT_DEBT_FAMILY;
    const state: DebtUrlState = { family };
    const mode = params.get("m");
    if (mode === "line" || mode === "table") state.chartMode = mode;
    if (params.get("sh") === "1") state.share = true;

    const range = params.get("r");
    if (range && /^\d{4}-\d{4}$/.test(range)) {
      const [start = 0, end = 0] = range.split("-").map(Number);
      state.range = { start, end };
    }
    if (rawSelection !== undefined) state.selection = normalizeDebtSelection(rawSelection, family);

    return state;
  } catch {
    return { family: DEFAULT_DEBT_FAMILY };
  }
}

export function serializeDebtHash(input: {
  family: DebtFamily;
  chartMode: ChartMode;
  share: boolean;
  rangeStart: number;
  rangeEnd: number;
  selectedIds: DebtSeriesId[];
}): string {
  const params = new URLSearchParams();
  params.set("f", input.family);
  params.set("m", input.chartMode);
  if (input.share) params.set("sh", "1");
  params.set("r", `${input.rangeStart}-${input.rangeEnd}`);
  params.set("sel", normalizeDebtSelection(input.selectedIds, input.family).join(","));
  return params.toString();
}
