"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { buildExplorerCsv } from "../../lib/explorer/csvExport";
import { buildExplorerModel, getDefaultSelection } from "../../lib/explorer/explorerData";
import { formatGel } from "../../lib/explorer/format";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";
import { MAX_CHART_SERIES, type ChartMode, type ExplorerSide, type MeasureMode, type ViewMode } from "../../lib/explorer/types";
import { SingleYearSnapshot } from "../single-year/single-year-snapshot";
import { ExplorerControls } from "./explorer-controls";
import { ExplorerTable } from "./explorer-table";
import { PeriodSummaryPanel } from "./period-summary";
import { SeriesSelector } from "./series-selector";

const ChartFrame = dynamic(() => import("./chart-frame").then((module) => module.ChartFrame), {
  ssr: false,
  loading: () => <div className="h-[420px] border border-cyan-400/20 bg-black/40" />,
});

type MainExplorerProps = {
  facts: BudgetFactImportRow[];
  glossaryEntries: GlossaryEntry[];
  sourceDocuments: SourceDocumentRow[];
  lastUpdatedAt: string;
};

export function MainExplorer({ facts, glossaryEntries, sourceDocuments, lastUpdatedAt }: MainExplorerProps) {
  const allYears = useMemo(() => Array.from(new Set(facts.map((fact) => fact.year))).sort((a, b) => a - b), [facts]);
  const initialStartYear = allYears[0] ?? 2025;
  const initialEndYear = allYears.at(-1) ?? initialStartYear;
  const glossary = useMemo(() => new Map(glossaryEntries.map((entry) => [entry.id, entry])), [glossaryEntries]);
  const [side, setSide] = useState<ExplorerSide>("expenditure");
  const [viewMode, setViewMode] = useState<ViewMode>("multi_year");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [measure, setMeasure] = useState<MeasureMode>("nominal");
  const [startYear, setStartYear] = useState(initialStartYear);
  const [endYear, setEndYear] = useState(initialEndYear);
  const [barYear, setBarYear] = useState(initialEndYear);
  const [singleYear, setSingleYear] = useState(initialEndYear);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<ExplorerSide, string[]>>({
    expenditure: getDefaultSelection("expenditure", facts),
    revenue: getDefaultSelection("revenue", facts),
  });
  const selectedIds = selections[side];
  const modelStartYear = chartMode === "bar" ? barYear : startYear;
  const modelEndYear = chartMode === "bar" ? barYear : endYear;
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
  const latestYear = model.years.at(-1);
  const latestTotal = latestYear === undefined ? null : model.totalRow?.valuesByYear[latestYear] ?? null;
  const selectorRows = [...model.tableRows, ...model.comparisonRows];

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
    if (mode === "bar") setBarYear(endYear);
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
        setLimitMessage(`გრაფიკზე მაქსიმუმ ${MAX_CHART_SERIES} სერია შეიძლება. ცხრილის რეჟიმში ლიმიტი არ არის.`);
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

  return (
    <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <section className={`grid min-h-[calc(100vh-2rem)] gap-5 ${viewMode === "multi_year" ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-none">
          <header className="border border-cyan-400/20 bg-black/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase text-cyan-200">GeoData.ge / Budget Explorer</p>
                <h1 className="mt-2 text-2xl font-semibold text-white md:text-4xl">საქართველოს ბიუჯეტის ანალიტიკა</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                  წლიური ეროვნული ბიუჯეტის სამუშაო ვერსია: ხარჯები, შემოსავლები, ტრენდები და CSV ექსპორტი.
                </p>
              </div>
              <div className="border border-lime-300/20 bg-lime-300/10 px-4 py-3 text-right">
                <p className="font-mono text-xs uppercase text-lime-200">{latestYear ?? "n/a"}</p>
                <p className="mt-1 text-lg font-semibold text-white">{formatGel(latestTotal)}</p>
                {model.hasPlannedValues ? <p className="mt-1 text-xs text-amber-200">გეგმური მნიშვნელობა აქტიურია</p> : null}
              </div>
            </div>
          </header>

          <div className="border border-cyan-400/20 bg-zinc-950/80 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <ExplorerControls
                side={side}
                viewMode={viewMode}
                chartMode={chartMode}
                measure={measure}
                years={allYears}
                startYear={startYear}
                endYear={endYear}
                barYear={barYear}
                singleYear={singleYear}
                onSideChange={setSide}
                onViewModeChange={setViewMode}
                onChartModeChange={handleChartModeChange}
                onMeasureChange={setMeasure}
                onStartYearChange={handleStartYearChange}
                onEndYearChange={handleEndYearChange}
                onBarYearChange={setBarYear}
                onSingleYearChange={setSingleYear}
              />
              {viewMode === "multi_year" ? (
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="h-10 border border-cyan-300 px-4 font-mono text-xs uppercase text-cyan-100 transition hover:bg-cyan-300 hover:text-black"
                >
                  CSV ჩამოტვირთვა
                </button>
              ) : null}
            </div>
          </div>

          {viewMode === "single_year" ? (
            <SingleYearSnapshot model={singleYearModel} />
          ) : model.unavailableReason ? (
            <div className="border border-amber-300/30 bg-amber-300/10 p-6 text-sm text-amber-100">{model.unavailableReason}</div>
          ) : chartMode === "table" ? (
            <ExplorerTable rows={model.tableRows} years={model.years} />
          ) : (
            <ChartFrame mode={chartMode} measure={measure} years={model.years} points={model.points} selectedItems={model.selectedItems} />
          )}

          <p className="text-xs text-zinc-500">
            მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები. ბოლო განახლება: {lastUpdatedAt}.
            {model.hasPlannedValues ? " აქტიურ მნიშვნელობებში არის გეგმური ბიუჯეტის მონაცემები." : ""}
          </p>
        </div>

        {viewMode === "multi_year" ? (
          <div className="order-2 lg:order-none">
            <SeriesSelector
              items={model.items}
              selectedIds={selectedIds}
              rows={selectorRows}
              years={model.years}
              chartMode={chartMode}
              limitMessage={limitMessage}
              onToggle={handleToggle}
            />
          </div>
        ) : null}
      </section>

      {viewMode === "multi_year" ? (
        <section className="mt-8 pb-12">
          <PeriodSummaryPanel
            years={model.years}
            summary={model.summary}
            rows={model.comparisonRows}
            topGrowth={model.topGrowth}
            bottomGrowth={model.bottomGrowth}
          />
        </section>
      ) : null}
    </main>
  );
}
