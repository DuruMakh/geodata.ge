"use client";

import type { ReactNode } from "react";
import type { ExplorerModel } from "../../lib/explorer/explorerData";
import { UNIT_BN } from "../../lib/explorer/format";
import { type ChartMode, type ExpenditureGrouping, type ExplorerScope } from "../../lib/explorer/types";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
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
  expandedMinistries: string[];
  lastUpdatedAt: string;
  onGroupingChange: (grouping: ExpenditureGrouping) => void;
  onChartModeChange: (mode: ChartMode) => void;
  onShareChange: (share: boolean) => void;
  onRangeChange: (patch: { start?: number; end?: number }) => void;
  onSelectionChange: (itemIds: string[]) => void;
  onToggleSeries: (itemId: string) => void;
  onToggleExpanded: (itemId: string) => void;
  downloadAction: ReactNode;
};

const COVERAGE_NOTE: Record<ExplorerScope, string> = {
  fields: "ხარჯვითი მონაცემები",
  ministries: "უწყებრივი მონაცემები",
  revenue: "შემოსავლების მონაცემები",
};

// Moved out of ExplorerTable so the table takes a label rather than a scope.
const FIRST_COL_LABEL: Record<ExplorerScope, string> = {
  fields: "სფერო",
  ministries: "უწყება",
  revenue: "საბიუჯეტო მუხლი",
};

// Classification-authorship disclosure (DESIGN.md §7.10): year totals are official;
// the category split is Fiscal.ge's own mapping and must say so. Revenue categories
// are the official budget-classification lines, so no disclosure is needed there.
const CLASSIFICATION_NOTE: Record<ExplorerScope, string | null> = {
  fields: "კატეგორიებად დაყოფა Fiscal.ge-ის კლასიფიკაციაა ოფიციალური ფუნქციური (COFOG) კოდების მიხედვით.",
  ministries: "უწყებრივი დაჯგუფება Fiscal.ge-ისაა ბიუჯეტის შესრულების ანგარიშების პროგრამული კლასიფიკაციის მიხედვით.",
  revenue: null,
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
  expandedMinistries,
  lastUpdatedAt,
  onGroupingChange,
  onChartModeChange,
  onShareChange,
  onRangeChange,
  onSelectionChange,
  onToggleSeries,
  onToggleExpanded,
  downloadAction,
}: ExplorerViewProps) {
  const noSelection = selectedIds.length === 0;
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

  // A non-empty selection can still have zero coverage in the active range
  // (e.g. a program series with a pre-2016 range) — say so instead of drawing
  // a fabricated empty axis or a total-only table.
  const noRangeData = !noSelection && model.points.length === 0;

  return (
    <>
      <div data-testid="explorer-workspace" className="grid items-start gap-8 @min-[1100px]:grid-cols-[minmax(0,1fr)_292px] @min-[1100px]:gap-10">
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={chartMode} data-measure={share ? "share_of_gdp" : "nominal"} className="border-t border-[var(--ink)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedTabs<ChartMode>
                ariaLabel="ხედის რეჟიმი"
                value={chartMode}
                onChange={onChartModeChange}
                options={[
                  { value: "line", label: "ხაზი", testId: "chart-mode-line" },
                  { value: "table", label: "ცხრილი", testId: "chart-mode-table" },
                ]}
              />
              <div className="flex items-center gap-3.5">
                <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {share ? "% მშპ-ში" : "მლრდ ₾"}
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
                  % მშპ-ში
                </button>
              </div>
            </div>

            {noSelection ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">არც ერთი სერია არ არის არჩეული. აირჩიე სერია პანელიდან „სერიები“.</Callout>
              </div>
            ) : noRangeData ? (
              <div className="mt-5">
                <Callout testId="no-range-data-callout">
                  არჩეული სერიებისთვის ამ დიაპაზონში მონაცემები არ არის. გააფართოვე დიაპაზონი ან შეცვალე სერიები.
                </Callout>
              </div>
            ) : chartMode === "table" ? (
              <ExplorerTable
                rows={model.tableRows.filter((row) => row.level !== "total")}
                totalRow={model.totalRow}
                showTotal={Boolean(model.totalRow && selectedIds.includes(model.totalRow.itemId))}
                years={model.years}
                firstColumnLabel={FIRST_COL_LABEL[scope]}
                unit={UNIT_BN}
                share={share}
                shareColumnLabel="წილი მშპ-ში"
                shareValueForYear={(row, year) => row.shareByYear?.[year] ?? null}
              />
            ) : (
              <div className="mt-5">
                <EditorialLineChart years={model.years} series={series} share={share} unit={UNIT_BN} shareLabel="წილი მშპ-ში" />
              </div>
            )}

            <RangeStrip years={scopeYears} range={range} onChange={onRangeChange} />
          </section>

          <div className="mt-[18px]">
            <SourceNote testId="source-label">
              მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო).{" "}
              <span className="font-[family-name:var(--font-numeric)]">{coverage}</span> · 12-თვიანი ფაქტობრივი შესრულება.
              {CLASSIFICATION_NOTE[scope] ? ` ${CLASSIFICATION_NOTE[scope]}` : null}
              {scope === "revenue" ? " 2004 წლის ვალდებულებების ზრდა არ არის ხელმისაწვდომი და 2004 წლის ჯამში არ შედის." : null}
              {Object.keys(model.gdpByYear).length > 0 ? " მშპ: საქსტატი, მიმდინარე ფასებში." : null}
              {model.years.some((year) => model.gdpByYear[year]?.status === "preliminary") ? " 2025 წლის მშპ წინასწარია." : null}
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
          key={scope}
          items={model.items}
          rows={model.totalRow ? [model.totalRow, ...model.comparisonRows] : model.comparisonRows}
          scope={scope}
          showGrouping={showGrouping}
          grouping={grouping}
          selectedIds={selectedIds}
          endYear={range.end}
          expandedIds={expandedMinistries}
          onGroupingChange={onGroupingChange}
          onSelectionChange={onSelectionChange}
          onToggle={onToggleSeries}
          onToggleExpanded={onToggleExpanded}
          downloadAction={downloadAction}
        />
      </div>

      <Indicators model={model} scope={scope} />
    </>
  );
}
