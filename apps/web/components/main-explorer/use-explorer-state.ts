"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientAdminFact, ClientBudgetFact } from "../../lib/explorer/clientData";
import { getDefaultSelection } from "../../lib/explorer/explorerData";
import { type ChartMode, type ExpenditureGrouping, type ExplorerScope, type ExplorerSide } from "../../lib/explorer/types";
import { parseExplorerHash, restoreExplorerSelection, scopeFor, serializeExplorerHash } from "../../lib/explorer/urlState";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { toggleId } from "../../lib/explorer/selection";
import { budgetYearsByScope } from "./budget-explorer-frame";

type UseExplorerStateInput = {
  facts: ClientBudgetFact[];
  adminFacts: ClientAdminFact[];
  nav: ExplorerSide;
};

type RangePatch = { start?: number; end?: number };

export type ResolvedRange = { start: number; end: number; min: number; max: number };

function clampYear(year: number, min: number, max: number): number {
  return Math.min(Math.max(year, min), max);
}

export function useExplorerState({ facts, adminFacts, nav }: UseExplorerStateInput) {
  const yearsByScope = useMemo(() => budgetYearsByScope(facts, adminFacts), [facts, adminFacts]);

  const idsByScope = useMemo<Record<ExplorerScope, Set<string>>>(
    () => ({
      fields: new Set(["expenditure.total", ...facts.filter((fact) => fact.side === "expenditure").map((fact) => fact.itemId)]),
      revenue: new Set(["revenue.total", ...facts.filter((fact) => fact.side === "revenue").map((fact) => fact.itemId)]),
      ministries: new Set(["admin_spending.total", ...adminFacts.map((fact) => fact.itemId)]),
    }),
    [facts, adminFacts],
  );

  const defaultSelections = useMemo<Record<ExplorerScope, string[]>>(
    () => ({
      fields: getDefaultSelection("expenditure", facts, "fields", adminFacts),
      ministries: getDefaultSelection("expenditure", facts, "ministries", adminFacts),
      revenue: getDefaultSelection("revenue", facts),
    }),
    [facts, adminFacts],
  );

  const [grouping, setGrouping] = useState<ExpenditureGrouping>("fields");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [share, setShare] = useState(false);
  const [ranges, setRanges] = useState<Partial<Record<ExplorerScope, RangePatch>>>({});
  const [selections, setSelections] = useState<Partial<Record<ExplorerScope, string[]>>>({});
  const [expandedMinistries, setExpandedMinistries] = useState<string[]>([]);
  const hashAppliedRef = useRef(false);

  const scope = scopeFor(nav, grouping);
  const scopeYears = yearsByScope[scope];

  function rangeOf(targetScope: ExplorerScope): ResolvedRange {
    const years = yearsByScope[targetScope];
    if (years.length === 0) return { start: 0, end: 0, min: 0, max: 0 };
    const min = years[0];
    const max = years.at(-1) ?? min;
    const patch = ranges[targetScope] ?? {};
    let start = patch.start === undefined ? min : clampYear(patch.start, min, max);
    let end = patch.end === undefined ? max : clampYear(patch.end, min, max);
    if (start > end) [start, end] = [end, start];
    return { start, end, min, max };
  }

  function setRange(targetScope: ExplorerScope, patch: RangePatch) {
    setRanges((current) => ({ ...current, [targetScope]: { ...(current[targetScope] ?? {}), ...patch } }));
  }

  const selectedIds = selections[scope] ?? defaultSelections[scope];

  function toggleSeries(itemId: string) {
    setSelections((existing) => {
      const fresh = existing[scope] ?? defaultSelections[scope];
      return {
        ...existing,
        [scope]: toggleId(fresh, itemId),
      };
    });
  }

  function setSelectedSeries(nextSelectedIds: string[]) {
    setSelections((existing) => ({ ...existing, [scope]: nextSelectedIds }));
  }

  function toggleMinistryExpanded(ministryId: string) {
    setExpandedMinistries((current) =>
      toggleId(current, ministryId),
    );
  }

  // Restore shareable state from the URL hash once, after mount (the server render
  // always shows defaults; unknown values are dropped by the parser or the checks below).
  // The hash is a one-time external input on load, so the one extra render is intended.
  useEffect(() => {
    if (hashAppliedRef.current) return;
    hashAppliedRef.current = true;
    const parsed = parseExplorerHash(window.location.hash, nav);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parsed.grouping) setGrouping(parsed.grouping);
    if (parsed.chartMode) setChartMode(parsed.chartMode);
    if (parsed.share) setShare(true);
    if (parsed.range) setRanges((current) => ({ ...current, [parsed.range!.scope]: { start: parsed.range!.start, end: parsed.range!.end } }));
    if (parsed.selection) {
      const { scope: selectionScope } = parsed.selection;
      const { ids, expandedMinistries: parents } = restoreExplorerSelection(parsed.selection, idsByScope[selectionScope], adminFacts);
      if (ids) setSelections((current) => ({ ...current, [selectionScope]: ids }));
      // Without the open parents, a recipient would see a charted program with no checked row anywhere.
      if (parents.length > 0) setExpandedMinistries(parents);
    }
    // The hook state is the source of truth after mount; the hash is write-only from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRange = rangeOf(scope);
  const serializedHash = serializeExplorerHash({
    nav,
    grouping,
    chartMode,
    share,
    rangeStart: activeRange.start,
    rangeEnd: activeRange.end,
    selectedIds,
  });

  useReplaceHash(serializedHash);

  return {
    explorerSide: nav,
    scope,
    grouping,
    chartMode,
    share,
    setShare,
    scopeYears,
    range: activeRange,
    setRange,
    selectedIds,
    expandedMinistries,
    toggleMinistryExpanded,
    toggleSeries,
    setSelectedSeries,
    setGrouping,
    setChartMode,
  };
}
