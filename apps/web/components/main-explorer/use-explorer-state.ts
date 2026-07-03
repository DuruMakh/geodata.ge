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

export function useExplorerState({ facts, adminFacts }: UseExplorerStateInput) {
  const yearsBySide = useMemo(
    () => ({
      expenditure: Array.from(new Set(facts.filter((fact) => fact.side === "expenditure").map((fact) => fact.year))).sort((a, b) => a - b),
      revenue: Array.from(new Set(facts.filter((fact) => fact.side === "revenue").map((fact) => fact.year))).sort((a, b) => a - b),
    }),
    [facts],
  );
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
  const sideYears = yearsBySide[side];
  const selectedIds = side === "expenditure" ? expenditureSelections[expenditureGrouping] : revenueSelection;
  const measure: MeasureMode = shareModeActive ? "share_of_total" : "nominal";

  function handleSideChange(nextSide: ExplorerSide) {
    const nextYears = yearsBySide[nextSide];
    const latestYear = nextYears.at(-1);

    setSide(nextSide);
    setStartYear((current) => clampYearToCoverage(current, nextYears));
    setEndYear((current) => clampYearToCoverage(current, nextYears));
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
