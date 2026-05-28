"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { buildExplorerCsv } from "../../lib/explorer/csvExport";
import { buildExplorerModel, getDefaultSelection } from "../../lib/explorer/explorerData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";
import { MAX_CHART_SERIES, type ChartMode, type ExplorerSide, type MeasureMode, type ViewMode } from "../../lib/explorer/types";
import { SingleYearSnapshot } from "../single-year/single-year-snapshot";
import { ThemeToggle } from "../ui/theme-toggle";
import { ViewSwitch } from "../ui/view-switch";
import { ChartPanel, ScreenCard, StatusSurface } from "../ui/surfaces";
import { ChartLegend } from "./chart-legend";
import { ExplorerControls } from "./explorer-controls";
import { ExplorerTable } from "./explorer-table";
import { ChartPanelControls } from "./chart-panel-controls";
import { PeriodSummaryPanel } from "./period-summary";
import { SeriesSelector } from "./series-selector";
import { YearRangeStrip } from "./year-range-strip";

const ChartFrame = dynamic(() => import("./chart-frame").then((module) => module.ChartFrame), {
  ssr: false,
  loading: () => <div className="h-[420px] rounded-[18px] bg-[var(--canvas)]" />,
});

type MainExplorerProps = {
  facts: BudgetFactImportRow[];
  glossaryEntries: GlossaryEntry[];
  sourceDocuments: SourceDocumentRow[];
  lastUpdatedAt: string;
};

export function MainExplorer({ facts, glossaryEntries, sourceDocuments, lastUpdatedAt }: MainExplorerProps) {
  useEffect(() => {
    document.body.dataset.appReady = "true";

    return () => {
      delete document.body.dataset.appReady;
    };
  }, []);

  const allYears = useMemo(() => Array.from(new Set(facts.map((fact) => fact.year))).sort((a, b) => a - b), [facts]);
  const initialStartYear = allYears[0] ?? 2025;
  const initialEndYear = allYears.at(-1) ?? initialStartYear;
  const glossary = useMemo(() => new Map(glossaryEntries.map((entry) => [entry.id, entry])), [glossaryEntries]);
  const [side, setSide] = useState<ExplorerSide>("expenditure");
  const [viewMode, setViewMode] = useState<ViewMode>("multi_year");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [shareModeActive, setShareModeActive] = useState(false);
  const [startYear, setStartYear] = useState(initialStartYear);
  const [endYear, setEndYear] = useState(initialEndYear);
  const [singleYear, setSingleYear] = useState(initialEndYear);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<ExplorerSide, string[]>>({
    expenditure: getDefaultSelection("expenditure", facts),
    revenue: getDefaultSelection("revenue", facts),
  });
  const selectedIds = selections[side];
  const measure: MeasureMode = shareModeActive ? "share_of_total" : "nominal";
  const modelStartYear = startYear;
  const modelEndYear = endYear;
  const model = buildExplorerModel({
    facts,
    glossary,
    sourceDocuments,
    side,
    selectedItemIds: selectedIds,
    startYear: modelStartYear,
    endYear: modelEndYear,
    measure,
  });
  const singleYearModel = buildSingleYearSnapshotModel({
    facts,
    glossary,
    sourceDocuments,
    side,
    year: singleYear,
  });
  const screenTitle =
    side === "expenditure"
      ? "\u10ee\u10d0\u10e0\u10ef\u10d4\u10d1\u10d8\u10e1 \u10d3\u10d8\u10dc\u10d0\u10db\u10d8\u10d9\u10d0"
      : "\u10e8\u10d4\u10db\u10dd\u10e1\u10d0\u10d5\u10da\u10d4\u10d1\u10d8\u10e1 \u10d3\u10d8\u10dc\u10d0\u10db\u10d8\u10d9\u10d0";
  const hasPlannedValues = viewMode === "single_year" ? singleYearModel.hasPlannedValues : model.hasPlannedValues;
  const selectorRows = [...model.tableRows, ...model.comparisonRows];

  function handleSideChange(nextSide: ExplorerSide) {
    setSide(nextSide);
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

  function handleToggle(itemId: string) {
    setLimitMessage(null);
    setSelections((current) => {
      const currentSideSelection = current[side];
      const alreadySelected = currentSideSelection.includes(itemId);

      if (alreadySelected) {
        return {
          ...current,
          [side]: currentSideSelection.filter((id) => id !== itemId),
        };
      }

      if (chartMode !== "table" && currentSideSelection.length >= MAX_CHART_SERIES) {
        setLimitMessage(`\u10d2\u10e0\u10d0\u10e4\u10d8\u10d9\u10d6\u10d4 \u10db\u10d0\u10e5\u10e1\u10d8\u10db\u10e3\u10db ${MAX_CHART_SERIES} \u10e1\u10d4\u10e0\u10d8\u10d0 \u10e8\u10d4\u10d8\u10eb\u10da\u10d4\u10d1\u10d0. \u10ea\u10ee\u10e0\u10d8\u10da\u10d8\u10e1 \u10e0\u10d4\u10df\u10d8\u10db\u10e8\u10d8 \u10da\u10d8\u10db\u10d8\u10e2\u10d8 \u10d0\u10e0 \u10d0\u10e0\u10d8\u10e1.`);
        return current;
      }

      return {
        ...current,
        [side]: [...currentSideSelection, itemId],
      };
    });
  }

  function downloadCsv() {
    const csv = buildExplorerCsv(model.tableRows, model.years);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geodata-budget-${side}-${modelStartYear}-${modelEndYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const chartToolbar = (
    <ChartPanelControls
      chartMode={chartMode}
      shareModeActive={shareModeActive}
      onChartModeChange={handleChartModeChange}
      onShareModeChange={setShareModeActive}
    />
  );

  const chartLegend = <ChartLegend items={model.selectedItems} />;

  const rangeStrip = (
    <YearRangeStrip
      years={allYears}
      startYear={startYear}
      endYear={endYear}
      onStartYearChange={handleStartYearChange}
      onEndYearChange={handleEndYearChange}
    />
  );

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--canvas)] px-4 py-10 text-[var(--ink)]">
      <section className="mx-auto w-[min(1200px,calc(100vw-32px))]">
        <ScreenCard>
          <header data-testid="explorer-header" className="border-b border-[var(--hairline)] pb-5">
            <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
              <strong className="text-[22px] font-bold tracking-[-0.02em] text-[var(--ink)]">GeoData.ge</strong>
              <div data-testid="explorer-controls" className="flex justify-start md:justify-center">
                <ExplorerControls side={side} onSideChange={handleSideChange} />
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <ThemeToggle />
                <div data-testid="view-switch">
                  <ViewSwitch
                    label={viewMode === "single_year" ? "\u10db\u10e0\u10d0\u10d5\u10d0\u10da\u10ec\u10da\u10d8\u10d0\u10dc\u10d8" : "\u10d4\u10e0\u10d7\u10ec\u10da\u10d8\u10d0\u10dc\u10d8"}
                    checked={viewMode === "single_year"}
                    checkedValue="single_year"
                    uncheckedValue="multi_year"
                    onChange={setViewMode}
                    testId={viewMode === "single_year" ? "view-multi_year" : "view-single_year"}
                    ariaLabel={viewMode === "single_year" ? "Switch to multi-year view" : "Switch to single-year view"}
                  />
                </div>
              </div>
            </div>
          </header>

          <div className={`mt-5 grid max-w-full gap-5 ${viewMode === "multi_year" ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
            <div className="order-1 flex min-w-0 max-w-full flex-col gap-5 lg:order-none">
              <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-[var(--ink)] md:text-[36px]">
                {screenTitle}
              </h1>

              {viewMode === "single_year" ? (
                <div className="min-w-0 max-w-full">
                  <SingleYearSnapshot model={singleYearModel} years={allYears} onYearChange={setSingleYear} />
                </div>
              ) : model.unavailableReason ? (
                <StatusSurface>{model.unavailableReason}</StatusSurface>
              ) : chartMode === "table" ? (
                <ChartPanel mode={chartMode} measure={measure} toolbar={chartToolbar} legend={chartLegend} rangeStrip={rangeStrip}>
                  <ExplorerTable rows={model.tableRows} years={model.years} />
                </ChartPanel>
              ) : (
                <ChartPanel mode={chartMode} measure={measure} toolbar={chartToolbar} legend={chartLegend} rangeStrip={rangeStrip}>
                  <ChartFrame mode={chartMode} measure={measure} years={model.years} points={model.points} selectedItems={model.selectedItems} />
                </ChartPanel>
              )}

              <p data-testid="source-label" className="rounded-[12px] border border-[var(--hairline)] bg-[var(--soft)] px-3 py-2 text-xs leading-5 text-[var(--body)]">
                {"\u10db\u10dd\u10dc\u10d0\u10ea\u10d4\u10db\u10d4\u10d1\u10d8: \u10d2\u10d0\u10d3\u10d0\u10db\u10dd\u10ec\u10db\u10d4\u10d1\u10e3\u10da\u10d8 \u10dd\u10e4\u10d8\u10ea\u10d8\u10d0\u10da\u10e3\u10e0\u10d8 \u10e1\u10d0\u10d1\u10d8\u10e3\u10ef\u10d4\u10e2\u10dd \u10d3\u10dd\u10d9\u10e3\u10db\u10d4\u10dc\u10e2\u10d4\u10d1\u10d8. \u10d1\u10dd\u10da\u10dd \u10d2\u10d0\u10dc\u10d0\u10ee\u10da\u10d4\u10d1\u10d0: "}
                {lastUpdatedAt}.
                {hasPlannedValues
                  ? " \u10d0\u10e5\u10e2\u10d8\u10e3\u10e0 \u10db\u10dc\u10d8\u10e8\u10d5\u10dc\u10d4\u10da\u10dd\u10d1\u10d4\u10d1\u10e8\u10d8 \u10d0\u10e0\u10d8\u10e1 \u10d2\u10d4\u10d2\u10db\u10e3\u10e0\u10d8 \u10d1\u10d8\u10e3\u10ef\u10d4\u10e2\u10d8\u10e1 \u10db\u10dd\u10dc\u10d0\u10ea\u10d4\u10db\u10d4\u10d1\u10d8."
                  : ""}
              </p>
            </div>

            {viewMode === "multi_year" ? (
              <div className="order-2 min-w-0 max-w-full lg:order-none">
                <SeriesSelector
                  items={model.items}
                  selectedIds={selectedIds}
                  rows={selectorRows}
                  years={model.years}
                  chartMode={chartMode}
                  limitMessage={limitMessage}
                  onToggle={handleToggle}
                  onDownloadCsv={downloadCsv}
                />
              </div>
            ) : null}
          </div>
        </ScreenCard>
      </section>

      {viewMode === "multi_year" ? (
        <section className="mx-auto mt-8 w-[min(1200px,calc(100vw-32px))] pb-12">
          <PeriodSummaryPanel
            years={model.years}
            summary={model.summary}
            totalRow={model.totalRow}
            rows={model.comparisonRows}
            topGrowth={model.topGrowth}
            bottomGrowth={model.bottomGrowth}
          />
        </section>
      ) : null}
    </main>
  );
}
