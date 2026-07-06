"use client";

import { useMemo, useState } from "react";
import type { AdminSpendingFact } from "../../lib/data/adminSpending/types";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import { getDefaultSelection } from "../../lib/explorer/explorerData";
import { MAX_CHART_SERIES, type ChartMode, type ExpenditureGrouping, type ExplorerSide, type MeasureMode, type ViewMode } from "../../lib/explorer/types";

type UseExplorerStateInput = {
  facts: BudgetFactImportRow[];
  adminFacts: AdminSpendingFact[];
};

function clampYearToCoverage(year: number, years: number[]): number {
  const minYear = years[0];
  const maxYear = years.at(-1);
  if (minYear === undefined || maxYear === undefined) return year;
  return Math.min(Math.max(year, minYear), maxYear);
}

// Snap to the nearest year that actually has coverage. Used when switching side or
// grouping, so a range handle never lands on a year the new dataset does not cover
// (e.g. keeping 2004 when moving to the ministries grouping, which starts at 2013).
function snapYearToCoverage(year: number, years: number[]): number {
  if (years.length === 0 || years.includes(year)) return year;
  const clamped = clampYearToCoverage(year, years);
  return years.reduce((best, candidate) =>
    Math.abs(candidate - clamped) < Math.abs(best - clamped) ? candidate : best,
  years[0]);
}

export function useExplorerState({ facts, adminFacts }: UseExplorerStateInput) {
  const yearsBySide = useMemo(
    () => ({
      expenditure: Array.from(new Set(facts.filter((fact) => fact.side === "expenditure").map((fact) => fact.year))).sort((a, b) => a - b),
      revenue: Array.from(new Set(facts.filter((fact) => fact.side === "revenue").map((fact) => fact.year))).sort((a, b) => a - b),
    }),
    [facts],
  );
  // The ministries grouping has its own coverage (from the admin-spending facts),
  // which differs from the functional-expenditure years — e.g. it includes 2013 but
  // not the total-only years 2004-2005. Its year strip must reflect that, not the
  // functional years.
  const adminYears = useMemo(
    () => Array.from(new Set(adminFacts.map((fact) => fact.year))).sort((a, b) => a - b),
    [adminFacts],
  );
  const expenditureYearsFor = (grouping: ExpenditureGrouping) =>
    grouping === "ministries" ? adminYears : yearsBySide.expenditure;
  const yearsFor = (nextSide: ExplorerSide, grouping: ExpenditureGrouping) =>
    nextSide === "expenditure" ? expenditureYearsFor(grouping) : yearsBySide.revenue;
  const initialStartYear = yearsBySide.expenditure[0] ?? 2025;
  const initialEndYear = yearsBySide.expenditure.at(-1) ?? initialStartYear;
  const [side, setSide] = useState<ExplorerSide>("expenditure");
  const [viewMode, setViewMode] = useState<ViewMode>("multi_year");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [expenditureGrouping, setExpenditureGrouping] = useState<ExpenditureGrouping>("fields");
  const [shareModeActive, setShareModeActive] = useState(false);
  const [startYear, setStartYear] = useState(initialStartYear);
  const [endYear, setEndYear] = useState(initialEndYear);
  const [singleYear, setSingleYear] = useState(initialEndYear);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [expenditureSelections, setExpenditureSelections] = useState<Record<ExpenditureGrouping, string[]>>({
    fields: getDefaultSelection("expenditure", facts, "fields", adminFacts),
    ministries: getDefaultSelection("expenditure", facts, "ministries", adminFacts),
  });
  const [revenueSelection, setRevenueSelection] = useState<string[]>(getDefaultSelection("revenue", facts));
  const sideYears = yearsFor(side, expenditureGrouping);
  const selectedIds = side === "expenditure" ? expenditureSelections[expenditureGrouping] : revenueSelection;
  const measure: MeasureMode = shareModeActive ? "share_of_total" : "nominal";

  function handleSideChange(nextSide: ExplorerSide) {
    const nextYears = yearsFor(nextSide, expenditureGrouping);
    const latestYear = nextYears.at(-1);

    setSide(nextSide);
    setStartYear((current) => snapYearToCoverage(current, nextYears));
    setEndYear((current) => snapYearToCoverage(current, nextYears));
    setSingleYear((current) => (nextYears.includes(current) || latestYear === undefined ? current : latestYear));
    setLimitMessage(null);
  }

  function handleStartYearChange(year: number) {
    setStartYear(year);
    if (year > endYear) setEndYear(year);
  }

  function handleEndYearChange(year: number) {
    setEndYear(year);
    if (year < startYear) setStartYear(year);
  }

  function handleChartModeChange(mode: ChartMode) {
    setChartMode(mode);
    setLimitMessage(null);
  }

  function handleExpenditureGroupingChange(grouping: ExpenditureGrouping) {
    setExpenditureGrouping(grouping);
    setLimitMessage(null);

    if (side !== "expenditure") return;
    // Re-anchor the selected range onto the new grouping's coverage so the strip and
    // chart show a year the grouping actually has (fields includes 2004-2005 + 2017+;
    // ministries includes 2013 + 2017+).
    const nextYears = expenditureYearsFor(grouping);
    const latestYear = nextYears.at(-1);
    setStartYear((current) => snapYearToCoverage(current, nextYears));
    setEndYear((current) => snapYearToCoverage(current, nextYears));
    setSingleYear((current) => (nextYears.includes(current) || latestYear === undefined ? current : latestYear));
  }

  function handleToggle(itemId: string) {
    setLimitMessage(null);
    const updateSelection = (currentSelection: string[]) => {
      const alreadySelected = currentSelection.includes(itemId);

      if (alreadySelected) {
        return currentSelection.filter((id) => id !== itemId);
      }

      if (chartMode !== "table" && currentSelection.length >= MAX_CHART_SERIES) {
        setLimitMessage(`\u10d2\u10e0\u10d0\u10e4\u10d8\u10d9\u10d6\u10d4 \u10db\u10d0\u10e5\u10e1\u10d8\u10db\u10e3\u10db ${MAX_CHART_SERIES} \u10e1\u10d4\u10e0\u10d8\u10d0 \u10e8\u10d4\u10d8\u10eb\u10da\u10d4\u10d1\u10d0. \u10ea\u10ee\u10e0\u10d8\u10da\u10d8\u10e1 \u10e0\u10d4\u10df\u10d8\u10db\u10e8\u10d8 \u10da\u10d8\u10db\u10d8\u10e2\u10d8 \u10d0\u10e0 \u10d0\u10e0\u10d8\u10e1.`);
        return currentSelection;
      }

      return [...currentSelection, itemId];
    };

    if (side === "expenditure") {
      setExpenditureSelections((current) => ({
        ...current,
        [expenditureGrouping]: updateSelection(current[expenditureGrouping]),
      }));
      return;
    }

    setRevenueSelection(updateSelection);
  }

  return {
    side,
    viewMode,
    setViewMode,
    chartMode,
    expenditureGrouping,
    shareModeActive,
    setShareModeActive,
    startYear,
    endYear,
    singleYear,
    setSingleYear,
    limitMessage,
    yearsBySide,
    sideYears,
    selectedIds,
    measure,
    handleSideChange,
    handleStartYearChange,
    handleEndYearChange,
    handleChartModeChange,
    handleExpenditureGroupingChange,
    handleToggle,
  };
}
