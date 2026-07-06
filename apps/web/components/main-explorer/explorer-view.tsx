"use client";

import type { ExplorerModel } from "../../lib/explorer/explorerData";
import type { ChartMode, ExpenditureGrouping, ExplorerScope } from "../../lib/explorer/types";
import { Callout, SourceNote, TextTab } from "../ui/editorial";
import { EditorialLineChart, type ChartSeries } from "./editorial-line-chart";
import { ExplorerTable } from "./explorer-table";
import { Indicators } from "./indicators";
import { RangeStrip } from "./range-strip";
import { SeriesPanel } from "./series-panel";
import type { ResolvedRange } from "./use-explorer-state";

// Multi-year explorer per DESIGN.md §8: mode/grouping tabs and the measure pill over
// the chart or table, range strip, source note, and the sticky series aside.

type ExplorerViewProps = {
  model: ExplorerModel;
  scope: ExplorerScope;
  showGrouping: boolean;
  grouping: ExpenditureGrouping;
  chartMode: ChartMode;
  share: boolean;
  range: ResolvedRange;
  scopeYears: number[];
  selectedIds: string[];
  query: string;
  limitMessage: string | null;
  expandedMinistries: string[];
  lastUpdatedAt: string;
  onGroupingChange: (grouping: ExpenditureGrouping) => void;
  onChartModeChange: (mode: ChartMode) => void;
  onShareChange: (share: boolean) => void;
  onRangeChange: (patch: { start?: number; end?: number }) => void;
  onQueryChange: (query: string) => void;
  onToggleSeries: (itemId: string) => void;
  onToggleExpanded: (itemId: string) => void;
  onDownloadCsv: () => void;
};

const COVERAGE_NOTE: Record<ExplorerScope, string> = {
  fields: "ხარჯვითი მონაცემები",
  ministries: "უწყებრივი მონაცემები",
  revenue: "შემოსავლების მონაცემები",
};

export function ExplorerView({
  model,
  scope,
  showGrouping,
  grouping,
  chartMode,
  share,
  range,
  scopeYears,
  selectedIds,
  query,
  limitMessage,
  expandedMinistries,
  lastUpdatedAt,
  onGroupingChange,
  onChartModeChange,
  onShareChange,
  onRangeChange,
  onQueryChange,
  onToggleSeries,
  onToggleExpanded,
  onDownloadCsv,
}: ExplorerViewProps) {
  const noSelection = selectedIds.length === 0;
  const sideWord = scope === "revenue" ? "შემოსავლებიდან" : "ხარჯებიდან";

  const series: ChartSeries[] = model.selectedItems.map((item) => {
    const pointsByYear = new Map(model.points.filter((point) => point.itemId === item.id).map((point) => [point.year, point]));

    return {
      id: item.id,
      label: item.kaLabel.length > 30 ? `${item.kaLabel.slice(0, 29)}…` : item.kaLabel,
      color: item.color,
      vals: model.years.map((year) => {
        const value = pointsByYear.get(year)?.value ?? null;
        return value === null ? null : share ? value * 100 : value;
      }),
      planned: model.years.map((year) => pointsByYear.get(year)?.basis === "planned"),
    };
  });

  const coverage =
    scopeYears.length > 0 ? `${COVERAGE_NOTE[scope]}: ${scopeYears[0]}–${scopeYears.at(-1)}` : COVERAGE_NOTE[scope];

  return (
    <>
      <div data-testid="explorer-workspace" className="grid items-start gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_292px] min-[1100px]:gap-10">
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={chartMode} data-measure={share ? "share_of_total" : "nominal"} className="border-t border-[var(--ink)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-[18px]">
                <TextTab label="ხაზი" active={chartMode === "line"} onClick={() => onChartModeChange("line")} testId="chart-mode-line" />
                <TextTab label="ცხრილი" active={chartMode === "table"} onClick={() => onChartModeChange("table")} testId="chart-mode-table" />
              </div>
              <div className="flex items-center gap-3.5">
                <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {share ? `% მთლიანი ${sideWord}` : "მლრდ ₾"}
                </span>
                <button
                  type="button"
                  data-testid="measure-share-toggle"
                  aria-pressed={share}
                  onClick={() => onShareChange(!share)}
                  className={`h-[27px] flex-none cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors duration-150 ${
                    share
                      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                      : "border-[var(--control)] bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  % წილი
                </button>
              </div>
            </div>

            {noSelection ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">არც ერთი სერია არ არის არჩეული. აირჩიე სერია პანელიდან „სერიები“.</Callout>
              </div>
            ) : chartMode === "table" ? (
              <ExplorerTable rows={model.tableRows} totalRow={model.totalRow} years={model.years} scope={scope} share={share} />
            ) : (
              <div className="mt-5">
                <EditorialLineChart years={model.years} series={series} share={share} />
              </div>
            )}

            <RangeStrip years={scopeYears} range={range} onChange={onRangeChange} />
          </section>

          <div className="mt-[18px]">
            <SourceNote testId="source-label">
              მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო).{" "}
              <span className="font-[family-name:var(--font-numeric)]">{coverage}</span> · 12-თვიანი ფაქტობრივი შესრულება.
              {lastUpdatedAt ? (
                <>
                  {" "}ბოლო განახლება: <span className="font-[family-name:var(--font-numeric)]">{lastUpdatedAt}</span>.
                </>
              ) : null}
              {model.hasPlannedValues ? " აქტიურ მნიშვნელობებში არის გეგმური ბიუჯეტის მონაცემები." : null}
            </SourceNote>
          </div>
        </div>

        <SeriesPanel
          items={model.items}
          rows={model.comparisonRows}
          scope={scope}
          showGrouping={showGrouping}
          grouping={grouping}
          selectedIds={selectedIds}
          chartMode={chartMode}
          endYear={range.end}
          query={query}
          limitMessage={limitMessage}
          expandedIds={expandedMinistries}
          onGroupingChange={onGroupingChange}
          onQueryChange={onQueryChange}
          onToggle={onToggleSeries}
          onToggleExpanded={onToggleExpanded}
          onDownloadCsv={onDownloadCsv}
        />
      </div>

      <Indicators model={model} scope={scope} />
    </>
  );
}
