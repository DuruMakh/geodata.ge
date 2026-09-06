"use client";

import type { ReactNode } from "react";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { publicLabel } from "../../lib/i18n/labels";
import { formatDisplayDate } from "../../lib/explorer/format";
import type { ExplorerModel } from "../../lib/explorer/explorerData";
import type { ValueUnit } from "../../lib/explorer/format";
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
  /** Derived once from the full corpus by MainExplorer, so the range strip cannot reformat cells mid-drag. */
  unit: ValueUnit;
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
  fields: "main.expenditureCoverage",
  ministries: "main.ministryCoverage",
  revenue: "main.revenueCoverage",
};

// Moved out of ExplorerTable so the table takes a label rather than a scope.
const FIRST_COL_LABEL: Record<ExplorerScope, string> = {
  fields: "main.field",
  ministries: "main.institution",
  revenue: "main.budgetItem",
};

// Classification-authorship disclosure (DESIGN.md §7.10): year totals are official;
// the category split is Fiscal.ge's own mapping and must say so. Revenue categories
// are the official budget-classification lines, so no disclosure is needed there.
const CLASSIFICATION_NOTE: Record<ExplorerScope, string | null> = {
  fields: "main.fieldsClassification",
  ministries: "main.ministriesClassification",
  revenue: null,
};

export function ExplorerView({
  model,
  scope,
  unit,
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
  const { locale, messages, englishLabels } = useI18n();
  const noSelection = selectedIds.length === 0;
  const series: ChartSeries[] = model.selectedItems.map((item) => {
    const label = publicLabel(locale, item.id, item.kaLabel, englishLabels);
    const pointsByYear = new Map(model.points.filter((point) => point.itemId === item.id).map((point) => [point.year, point]));

    return {
      id: item.id,
      label: label.length > 30 ? `${label.slice(0, 29)}…` : label,
      color: item.color,
      vals: model.years.map((year) => {
        const value = pointsByYear.get(year)?.value ?? null;
        return value === null ? null : share ? value * 100 : value;
      }),
      planned: model.years.map((year) => pointsByYear.get(year)?.basis === "planned"),
    };
  });

  const coverageLabel = message(messages, COVERAGE_NOTE[scope]);
  const coverage = scopeYears.length > 0 ? `${coverageLabel}: ${scopeYears[0]}–${scopeYears.at(-1)}` : coverageLabel;
  const preliminaryYears = model.years.filter(year => model.gdpByYear[year]?.status === "preliminary");

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
                ariaLabel={message(messages, "controls.viewMode")}
                value={chartMode}
                onChange={onChartModeChange}
                options={[
                  { value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" },
                  { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
                ]}
              />
              <div className="flex items-center gap-3.5">
                <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {message(messages, share ? "main.percentGdp" : "format.bnGel")}
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
                  {message(messages, "main.percentGdp")}
                </button>
              </div>
            </div>

            {noSelection ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
              </div>
            ) : noRangeData ? (
              <div className="mt-5">
                <Callout testId="no-range-data-callout">
                  {message(messages, "main.noRangeData")}
                </Callout>
              </div>
            ) : chartMode === "table" ? (
              <ExplorerTable
                caption={message(messages, "main.tableCaption", { coverage: coverageLabel, measure: message(messages, share ? "main.shareGdp" : scope === "revenue" ? "main.revenueGel" : "main.expenditureGel"), startYear: range.start, endYear: range.end })}
                rows={model.tableRows.filter((row) => row.level !== "total")}
                totalRow={model.totalRow}
                showTotal={Boolean(model.totalRow && selectedIds.includes(model.totalRow.itemId))}
                years={model.years}
                firstColumnLabel={message(messages, FIRST_COL_LABEL[scope])}
                unit={unit}
                share={share}
                showChangeColumn={false}
                shareValueForYear={(row, year) => row.shareByYear?.[year] ?? null}
              />
            ) : (
              <div className="mt-5">
                <EditorialLineChart years={model.years} series={series} share={share} unit={unit} shareLabel={message(messages, "main.shareGdp")} />
              </div>
            )}

            <RangeStrip years={scopeYears} range={range} onChange={onRangeChange} />
          </section>

          <div className="mt-[18px]">
            <SourceNote testId="source-label">
              {message(messages, "main.sourceData")}{" "}
              <span className="font-[family-name:var(--font-numeric)]">{coverage}</span>{" "}{message(messages, "main.annualExecution")}
              {CLASSIFICATION_NOTE[scope] ? " " + message(messages, CLASSIFICATION_NOTE[scope]) : null}
              {scope === "revenue" ? " " + message(messages, "main.missing2004Liabilities") : null}
              {Object.keys(model.gdpByYear).length > 0 ? " " + message(messages, "main.gdpSource") : null}
              {preliminaryYears.length > 0 ? " " + message(messages, "main.preliminaryGdp", { years: preliminaryYears.join(", ") }) : null}
              {lastUpdatedAt ? <>{" "}<Message messages={messages} id="main.lastUpdated" values={{ date: <span className="font-[family-name:var(--font-numeric)]">{locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt}</span> }} /></> : null}
              {model.hasPlannedValues ? " " + message(messages, "main.activePlanned") : null}
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
