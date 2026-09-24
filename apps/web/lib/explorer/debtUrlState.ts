import type { DebtFamily, DebtSeriesId } from "../servedRows";
import {
  DEFAULT_DEBT_FAMILY,
  DEBT_FAMILIES,
  familyForDebtSeries,
  isDebtSeriesId,
  normalizeDebtSelection,
} from "./debtExplorer";
import type { ChartMode } from "./types";
import { parseSharedHashKeys, writeSharedHashKeys } from "./urlState";

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

export function parseDebtHash(hash: string): DebtUrlState {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const { chartMode, share, range, selection: rawSelection } = parseSharedHashKeys(params);
    const firstSelectedFamily = rawSelection?.find(isDebtSeriesId);
    const rawFamily = params.get("f");
    const family = isDebtFamily(rawFamily)
      ? rawFamily
      : firstSelectedFamily
        ? familyForDebtSeries(firstSelectedFamily)
        : DEFAULT_DEBT_FAMILY;
    const state: DebtUrlState = { family };
    if (chartMode) state.chartMode = chartMode;
    if (share) state.share = true;
    if (range) state.range = range;
    if (rawSelection !== undefined) {
      const normalizedSelection = normalizeDebtSelection(rawSelection, family);
      // Preserve a deliberate `sel=` clear, but let a stale non-empty list whose
      // ids all disappeared fall through to the family's safe default.
      if (normalizedSelection.length > 0 || params.get("sel") === "") {
        state.selection = normalizedSelection;
      }
    }

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
  writeSharedHashKeys(params, { ...input, selectedIds: normalizeDebtSelection(input.selectedIds, input.family) });
  return params.toString();
}
