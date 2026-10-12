"use client";

import { useMemo } from "react";
import type { DebtFamily, DebtSeriesId, ClientGovernmentDebtFact } from "../../lib/servedRows";
import {
  debtRangeForFamily,
  familyForDebtSeries,
  getDefaultDebtSelection,
  normalizeDebtSelection,
  selectDebtSeries,
} from "../../lib/explorer/debtExplorer";
import { parseDebtHash, serializeDebtHash } from "../../lib/explorer/debtUrlState";
import type { ChartMode } from "../../lib/explorer/types";
import { useHashState } from "../explorer-shell/use-hash-state";

type Range = { start: number; end: number; min: number; max: number };
type RangePatch = { start?: number; end?: number };
type FullRanges = Record<DebtFamily, Range>;
type DebtState = {
  family: DebtFamily;
  chartMode: ChartMode;
  shareOfGdp: boolean;
  range: { start: number; end: number };
  selectedIds: DebtSeriesId[];
};

function normalizeRange(rawStart: number, rawEnd: number, range: Range): { start: number; end: number } {
  const start = Math.min(Math.max(rawStart, range.min), range.max);
  const end = Math.min(Math.max(rawEnd, range.min), range.max);
  return start <= end ? { start, end } : { start: end, end: start };
}

function parseDebtState(hash: string, fullRanges: FullRanges): DebtState {
  const parsed = parseDebtHash(hash);
  const fullRange = fullRanges[parsed.family];
  return {
    family: parsed.family,
    chartMode: parsed.chartMode ?? "line",
    shareOfGdp: parsed.family === "stock" && parsed.share === true,
    range: parsed.range
      ? normalizeRange(parsed.range.start, parsed.range.end, fullRange)
      : { start: fullRange.start, end: fullRange.end },
    selectedIds: parsed.selection ?? getDefaultDebtSelection(parsed.family),
  };
}

function serializeDebtState(state: DebtState): string {
  return serializeDebtHash({
    family: state.family,
    chartMode: state.chartMode,
    share: state.family === "stock" && state.shareOfGdp,
    rangeStart: state.range.start,
    rangeEnd: state.range.end,
    selectedIds: state.selectedIds,
  });
}

function withFamily(state: DebtState, family: DebtFamily, selection: DebtSeriesId[], fullRanges: FullRanges): DebtState {
  return {
    ...state,
    family,
    range: { start: fullRanges[family].start, end: fullRanges[family].end },
    selectedIds: normalizeDebtSelection(selection, family),
    shareOfGdp: family === "stock" && state.shareOfGdp,
  };
}

export function useDebtExplorerState(facts: ClientGovernmentDebtFact[]) {
  const fullRanges = useMemo<FullRanges>(() => {
    const range = (family: DebtFamily): Range => {
      const resolved = debtRangeForFamily(facts, family);
      return { ...resolved, min: resolved.start, max: resolved.end };
    };
    return { stock: range("stock"), service: range("service"), rate: range("rate") };
  }, [facts]);
  const { state, update } = useHashState(fullRanges, parseDebtState, serializeDebtState);

  function setRange(patch: RangePatch) {
    update((current) => ({
      ...current,
      range: normalizeRange(patch.start ?? current.range.start, patch.end ?? current.range.end, fullRanges[current.family]),
    }));
  }

  function setSelectedSeries(ids: DebtSeriesId[]) {
    update((current) => ({ ...current, selectedIds: normalizeDebtSelection(ids, current.family) }));
  }

  function switchFamily(family: DebtFamily, selection = getDefaultDebtSelection(family)) {
    update((current) => withFamily(current, family, selection, fullRanges));
  }

  function toggleSeries(seriesId: DebtSeriesId) {
    update((current) => {
      const family = familyForDebtSeries(seriesId);
      return family !== current.family
        ? withFamily(current, family, [seriesId], fullRanges)
        : { ...current, selectedIds: selectDebtSeries(current.selectedIds, seriesId) };
    });
  }

  return {
    activeFamily: state.family,
    chartMode: state.chartMode,
    setChartMode: (chartMode: ChartMode) => update((current) => ({ ...current, chartMode })),
    shareOfGdp: state.family === "stock" && state.shareOfGdp,
    setShareOfGdp: (shareOfGdp: boolean) => update((current) => ({ ...current, shareOfGdp })),
    range: { ...fullRanges[state.family], ...state.range },
    setRange,
    selectedIds: state.selectedIds,
    setSelectedSeries,
    toggleSeries,
    switchFamily,
  };
}
