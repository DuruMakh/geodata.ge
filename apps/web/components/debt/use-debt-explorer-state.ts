"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useReplaceHash } from "../explorer-shell/use-replace-hash";

type Range = { start: number; end: number; min: number; max: number };
type RangePatch = { start?: number; end?: number };

function normalizeRange(rawStart: number, rawEnd: number, range: Range): { start: number; end: number } {
  const start = Math.min(Math.max(rawStart, range.min), range.max);
  const end = Math.min(Math.max(rawEnd, range.min), range.max);
  return start <= end ? { start, end } : { start: end, end: start };
}

export function useDebtExplorerState(facts: ClientGovernmentDebtFact[]) {
  const fullRanges = useMemo<Record<DebtFamily, Range>>(() => {
    const range = (family: DebtFamily): Range => {
      const resolved = debtRangeForFamily(facts, family);
      return { ...resolved, min: resolved.start, max: resolved.end };
    };
    return { stock: range("stock"), service: range("service"), rate: range("rate") };
  }, [facts]);
  const [activeFamily, setActiveFamily] = useState<DebtFamily>("stock");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [shareOfGdp, setShareOfGdp] = useState(false);
  const [ranges, setRanges] = useState<Record<DebtFamily, { start: number; end: number }>>(() => ({
    stock: fullRanges.stock,
    service: fullRanges.service,
    rate: fullRanges.rate,
  }));
  const [selectedIds, setSelectedIds] = useState<DebtSeriesId[]>(getDefaultDebtSelection("stock"));
  const parsedRef = useRef(false);

  useEffect(() => {
    if (parsedRef.current) return;
    parsedRef.current = true;
    const parsed = parseDebtHash(window.location.hash);
    const fullRange = fullRanges[parsed.family];
    const range = parsed.range
      ? normalizeRange(parsed.range.start, parsed.range.end, fullRange)
      : { start: fullRange.start, end: fullRange.end };

    /* eslint-disable react-hooks/set-state-in-effect */
    setActiveFamily(parsed.family);
    if (parsed.chartMode) setChartMode(parsed.chartMode);
    setShareOfGdp(parsed.family === "stock" && parsed.share === true);
    setRanges((current) => ({ ...current, [parsed.family]: range }));
    setSelectedIds(parsed.selection ?? getDefaultDebtSelection(parsed.family));
    /* eslint-enable react-hooks/set-state-in-effect */
    // The hash belongs to the initial browser location, not to later prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const range = { ...fullRanges[activeFamily], ...ranges[activeFamily] };
  const hash = serializeDebtHash({
    family: activeFamily,
    chartMode,
    share: activeFamily === "stock" && shareOfGdp,
    rangeStart: range.start,
    rangeEnd: range.end,
    selectedIds,
  });

  useReplaceHash(hash);

  function setRange(patch: RangePatch) {
    const current = ranges[activeFamily];
    const resolved = normalizeRange(patch.start ?? current.start, patch.end ?? current.end, fullRanges[activeFamily]);
    setRanges((previous) => ({ ...previous, [activeFamily]: resolved }));
  }

  function setSelectedSeries(ids: DebtSeriesId[]) {
    setSelectedIds(normalizeDebtSelection(ids, activeFamily));
  }

  function switchFamily(family: DebtFamily, selection = getDefaultDebtSelection(family)) {
    setActiveFamily(family);
    setRanges((previous) => ({ ...previous, [family]: fullRanges[family] }));
    setSelectedIds(normalizeDebtSelection(selection, family));
    if (family !== "stock") setShareOfGdp(false);
  }

  function toggleSeries(seriesId: DebtSeriesId) {
    const family = familyForDebtSeries(seriesId);
    if (family !== activeFamily) {
      switchFamily(family, [seriesId]);
      return;
    }
    setSelectedIds((current) => selectDebtSeries(current, seriesId));
  }

  return {
    activeFamily,
    chartMode,
    setChartMode,
    shareOfGdp: activeFamily === "stock" && shareOfGdp,
    setShareOfGdp,
    range,
    setRange,
    selectedIds,
    setSelectedSeries,
    toggleSeries,
    switchFamily,
  };
}
