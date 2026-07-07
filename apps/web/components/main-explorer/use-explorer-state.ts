"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSpendingFact } from "../../lib/data/adminSpending/types";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import { getDefaultSelection, isDerivedTotalItemId } from "../../lib/explorer/explorerData";
import { MAX_CHART_SERIES, type ChartMode, type ExpenditureGrouping, type ExplorerNav, type ExplorerScope } from "../../lib/explorer/types";
import { parseExplorerHash, scopeFor, serializeExplorerHash } from "../../lib/explorer/urlState";

type UseExplorerStateInput = {
  facts: BudgetFactImportRow[];
  adminFacts: AdminSpendingFact[];
};

type RangePatch = { start?: number; end?: number };

export type ResolvedRange = { start: number; end: number; min: number; max: number };

const SERIES_LIMIT_MESSAGE = `გრაფიკზე მაქსიმუმ ${MAX_CHART_SERIES} სერია შეიძლება. ცხრილის რეჟიმში ლიმიტი არ არის.`;

function clampYear(year: number, min: number, max: number): number {
  return Math.min(Math.max(year, min), max);
}

export function useExplorerState({ facts, adminFacts }: UseExplorerStateInput) {
  const yearsByScope = useMemo<Record<ExplorerScope, number[]>>(() => {
    const collect = (values: Iterable<number>) => Array.from(new Set(values)).sort((a, b) => a - b);

    return {
      // Chartable field/revenue years are years with category detail; derived totals
      // are not selectable series, so total-only years are not offered.
      fields: collect(
        facts.filter((fact) => fact.side === "expenditure" && !isDerivedTotalItemId(fact.itemId)).map((fact) => fact.year),
      ),
      revenue: collect(
        facts.filter((fact) => fact.side === "revenue" && !isDerivedTotalItemId(fact.itemId)).map((fact) => fact.year),
      ),
      ministries: collect(adminFacts.map((fact) => fact.year)),
    };
  }, [facts, adminFacts]);

  const idsByScope = useMemo<Record<ExplorerScope, Set<string>>>(
    () => ({
      fields: new Set(facts.filter((fact) => fact.side === "expenditure").map((fact) => fact.itemId)),
      revenue: new Set(facts.filter((fact) => fact.side === "revenue").map((fact) => fact.itemId)),
      ministries: new Set(adminFacts.map((fact) => fact.itemId)),
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

  const [nav, setNav] = useState<ExplorerNav>("expenditure");
  const [grouping, setGrouping] = useState<ExpenditureGrouping>("fields");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [share, setShare] = useState(false);
  const [ranges, setRanges] = useState<Partial<Record<ExplorerScope, RangePatch>>>({});
  const [selections, setSelections] = useState<Partial<Record<ExplorerScope, string[]>>>({});
  const [expandedMinistries, setExpandedMinistries] = useState<string[]>([]);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [analysisSide, setAnalysisSide] = useState<"expenditure" | "revenue">("expenditure");
  const [analysisGrouping, setAnalysisGrouping] = useState<ExpenditureGrouping>("fields");
  const [analysisYear, setAnalysisYear] = useState<number | null>(null);
  const hashAppliedRef = useRef(false);
  const hashWrittenRef = useRef(false);

  const explorerSide: "expenditure" | "revenue" = nav === "revenue" ? "revenue" : "expenditure";
  const scope = scopeFor(explorerSide, grouping);
  const scopeYears = yearsByScope[scope];

  const analysisScope = scopeFor(analysisSide, analysisGrouping);
  const analysisYears = yearsByScope[analysisScope];
  const resolvedAnalysisYear =
    analysisYear !== null && analysisYears.includes(analysisYear) ? analysisYear : analysisYears.at(-1) ?? null;

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
    // The limit check reads render-time state (good enough for the message), but
    // the write derives from the updater's own argument so rapid toggles in one
    // render window can't overwrite each other with a stale array.
    const current = selections[scope] ?? defaultSelections[scope];
    if (!current.includes(itemId) && chartMode !== "table" && current.length >= MAX_CHART_SERIES) {
      setLimitMessage(SERIES_LIMIT_MESSAGE);
      return;
    }

    setSelections((existing) => {
      const fresh = existing[scope] ?? defaultSelections[scope];
      return {
        ...existing,
        [scope]: fresh.includes(itemId) ? fresh.filter((id) => id !== itemId) : [...fresh, itemId],
      };
    });
    setLimitMessage(null);
  }

  function toggleMinistryExpanded(ministryId: string) {
    setExpandedMinistries((current) =>
      current.includes(ministryId) ? current.filter((id) => id !== ministryId) : [...current, ministryId],
    );
  }

  function handleNavChange(nextNav: ExplorerNav) {
    setNav(nextNav);
    setLimitMessage(null);
  }

  function handleGroupingChange(nextGrouping: ExpenditureGrouping) {
    setGrouping(nextGrouping);
    setLimitMessage(null);
  }

  function handleChartModeChange(mode: ChartMode) {
    setChartMode(mode);
    setLimitMessage(null);
  }

  // Restore shareable state from the URL hash once, after mount (the server render
  // always shows defaults; unknown values are dropped by the parser or the checks below).
  // The hash is a one-time external input on load, so the one extra render is intended.
  useEffect(() => {
    if (hashAppliedRef.current) return;
    hashAppliedRef.current = true;
    const parsed = parseExplorerHash(window.location.hash);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parsed.nav) setNav(parsed.nav);
    if (parsed.grouping) setGrouping(parsed.grouping);
    if (parsed.chartMode) setChartMode(parsed.chartMode);
    if (parsed.share) setShare(true);
    if (parsed.analysisSide) setAnalysisSide(parsed.analysisSide);
    if (parsed.analysisGrouping) setAnalysisGrouping(parsed.analysisGrouping);
    if (parsed.analysisYear !== undefined) setAnalysisYear(parsed.analysisYear);
    if (parsed.range) setRanges((current) => ({ ...current, [parsed.range!.scope]: { start: parsed.range!.start, end: parsed.range!.end } }));
    if (parsed.selection) {
      const knownIds = parsed.selection.ids.filter((id) => idsByScope[parsed.selection!.scope].has(id));
      // A deliberately-empty shared selection restores as empty; a selection whose
      // ids are ALL unknown (renamed taxonomy, typos) falls back to the default.
      if (knownIds.length > 0 || parsed.selection.ids.length === 0) {
        setSelections((current) => ({ ...current, [parsed.selection!.scope]: knownIds }));
      }
      // A restored program selection must be visible in the panel: expand the
      // parents of every selected major program, or the recipient sees a charted
      // series with no checked row anywhere.
      if (parsed.selection.scope === "ministries") {
        const known = new Set(knownIds);
        const parents = Array.from(
          new Set(
            adminFacts
              .filter((fact) => fact.level === "major_program" && fact.parentItemId !== null && known.has(fact.itemId))
              .map((fact) => fact.parentItemId as string),
          ),
        );
        if (parents.length > 0) setExpandedMinistries(parents);
      }
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
    analysisSide,
    analysisGrouping,
    analysisYear: resolvedAnalysisYear,
  });

  useEffect(() => {
    // Skip the mount run: its serializedHash was computed from default state, so
    // writing it would clobber an incoming deep link (and stamp pristine URLs).
    if (!hashWrittenRef.current) {
      hashWrittenRef.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${serializedHash}`);
    } catch {
      // History can be unavailable in some embedded contexts; the UI still works.
    }
  }, [serializedHash]);

  return {
    nav,
    explorerSide,
    scope,
    grouping,
    chartMode,
    share,
    setShare,
    scopeYears,
    range: activeRange,
    setRange,
    selectedIds,
    limitMessage,
    expandedMinistries,
    toggleMinistryExpanded,
    toggleSeries,
    handleNavChange,
    handleGroupingChange,
    handleChartModeChange,
    analysisSide,
    setAnalysisSide,
    analysisGrouping,
    setAnalysisGrouping,
    analysisYears,
    analysisYear: resolvedAnalysisYear,
    setAnalysisYear,
  };
}
