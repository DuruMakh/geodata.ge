"use client";

import { coverageLabel } from "../../lib/explorer/coverageLabel";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientInflationTargetRow } from "../../lib/servedRows";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatInflationValue, periodLabel, seriesLabel, monthlyChartPeriod } from "../../lib/explorer/inflationLabels";
import { latestEntry } from "../../lib/explorer/latestValue";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import {
  INFLATION_COLORS, INFLATION_TABS, buildInflationLines, changeInflationTab, indexInflationFacts,
  parseInflationHash, rangeFromPatch, resolveInflationRange, seriesGroup, serializeInflationHash, toggleSelection, unpackCpiFacts,
  type InflationIndex, type InflationState, type InflationTab,
} from "../../lib/explorer/inflationOverview";
import type { PackedCategorySeries } from "../../lib/explorer/inflationCategories";
import { buildInflationWorkbookExportModel, type InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { Callout, SourceNote, TextTab } from "../ui/editorial";
import { InflationIndicators } from "./inflation-indicators";
import { InflationSeriesPanel } from "./inflation-series-panel";
import { InflationTable } from "./inflation-table";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { useHashState } from "../explorer-shell/use-hash-state";
import { topicSection } from "../../lib/navigation/navTree";

// Inflation overview (spec §6): the GDP overview's centred tabs over the Budget
// explorers' workspace — chart or monthly table, range strip and series panel.

const INDEX_UNIT = { divisor: 1, label: "", decimals: 1 };

// A restored hash keeps its range only where the tab has data.
function parseOverviewHash(hash: string, index: InflationIndex): InflationState {
  const parsed = parseInflationHash(hash);
  return changeInflationTab(parsed, parsed.tab, index);
}

export type InflationOverviewProps = {
  /** Packed on the server (packCpiFacts): one dense run per series and measure. */
  facts: PackedCategorySeries[];
  // One entry per series and measure: every CPI row of a group comes from the
  // same Geostat publication, and the workbook cites it.
  sourceIdBySeriesMeasure: Record<string, string>;
  lastReviewedAt: string;
  targets: ClientInflationTargetRow[];
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationOverview({ facts, sourceIdBySeriesMeasure, lastReviewedAt, targets, sources, siteOrigin }: InflationOverviewProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(
    () => indexInflationFacts(unpackCpiFacts(facts), sourceIdBySeriesMeasure),
    [facts, sourceIdBySeriesMeasure],
  );
  const { state, update } = useHashState(index, parseOverviewHash, serializeInflationHash);
  const [announcement, setAnnouncement] = useState("");

  const range = resolveInflationRange(state, index);
  const { periods, lines } = buildInflationLines(index, targets, state, range);
  const tabPeriods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  // The eyebrow states the active tab's span — the same months the chart and range strip offer
  // (the index series starts years before the annual and monthly change series).
  // The headline CPI's latest published month on the active tab.
  const latest = latestEntry(index.values.get(seriesGroup("cpi", state.tab)));
  const displayDate = updatedDate(lastReviewedAt, locale);
  const hasSeries = lines.some((line) => line.key !== "target");
  const chartSeries: ChartSeries[] = lines.map((line) => ({
    id: line.key,
    label: seriesLabel(messages, line.key, state.tab),
    color: INFLATION_COLORS[line.key],
    vals: line.values,
    dashed: line.key === "target",
  }));

  function selectTab(tab: InflationTab) {
    const next = changeInflationTab(state, tab, index);
    const nextRange = resolveInflationRange(next, index);
    update(() => next);
    setAnnouncement(t("rangeChanged", { start: periodLabel(messages, nextRange.start, "short"), end: periodLabel(messages, nextRange.end, "short") }));
  }

  return (
    <ExplorerPage testId="inflation-overview">
      <PageHeader
        locale={locale}
        messages={messages}
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.inflation"), href: pageHref(topicSection("inflation").href, locale) },
          { label: t("heading") },
        ]}
        coverage={coverageLabel(messages, locale, periodLabel(messages, range.min, "short"), periodLabel(messages, range.max, "short"), lastReviewedAt)}
      />
      <ExplorerHeading>{t("heading")}</ExplorerHeading>
      {latest ? (
        <LatestValueLine testId="inflation-latest" measure={t(`tab.${state.tab}`)} period={periodLabel(messages, latest.period, "long")} value={formatInflationValue(latest.value, state.tab)} />
      ) : null}

      <div
        data-testid="inflation-tabs"
        role="group"
        aria-label={t("tabs")}
        className="mb-3 py-2"
      >
        <div className="flex flex-wrap justify-center gap-x-7 gap-y-3 px-1">
          {INFLATION_TABS.map((tab) => (
            <TextTab key={tab} testId={`inflation-tab-${tab}`} label={t(`tab.${tab}`)} active={state.tab === tab} onClick={() => selectTab(tab)} />
          ))}
        </div>
      </div>
      <p role="status" className="sr-only">{announcement}</p>

      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={state.mode} data-tab={state.tab} className="border-t border-[var(--ink)] pt-3">
            <ModeTabs value={state.mode} onChange={(mode) => update((current) => ({ ...current, mode }))} />
            {!hasSeries ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
              </div>
            ) : state.mode === "table" ? (
              <InflationTable index={index} state={state} range={range} onTableSeriesChange={(key) => update((current) => ({ ...current, tableSeries: key }))} />
            ) : (
              <div className="mt-5">
                <EditorialLineChart
                  years={periods}
                  series={chartSeries}
                  share={state.tab !== "index"}
                  unit={INDEX_UNIT}
                  shareLabel={t(`tab.${state.tab}`)}
                  periodsPerYear={12}
                  formatPeriod={(period, kind) => monthlyChartPeriod(messages, period, kind)}
                />
              </div>
            )}
            <ChartSelectionAids series={chartSeries} chartShown={state.mode === "line"} share={state.tab !== "index"} unit={INDEX_UNIT} />
            <RangeStrip
              years={tabPeriods}
              range={range}
              periodsPerYear={12}
              formatPeriod={(period) => periodLabel(messages, period, "short")}
              formatMonth={(month) => message(messages, `inflation.monthShort.${month}`)}
              onChange={(patch) => update((current) => ({ ...current, range: rangeFromPatch(range, patch) }))}
            />
          </section>
          <div className="mt-[18px] space-y-2">
            <SourceNote testId="source-label">
              {/* The unit sits with the source, not as a second line under the heading (DESIGN §17). */}
              <span data-testid="inflation-unit">{t(`unit.${state.tab}`)}</span>
              {" · "}
              {t("source")} {message(messages, "main.lastUpdated", { date: displayDate })}
            </SourceNote>
            <Link href={pageHref("/methodology/inflation", locale)} prefetch={false} className="inline-flex min-h-11 items-center text-xs text-[var(--muted)] underline underline-offset-4">
              {t("methodology")}
            </Link>
          </div>
        </div>

        <InflationSeriesPanel
          index={index}
          targets={targets}
          state={state}
          range={range}
          onToggle={(key) => update((current) => toggleSelection(current, key))}
          onClear={() => update((current) => ({ ...current, selected: [] }))}
          downloadAction={
            <ExcelDownloadButton
              testId="inflation-download"
              disabled={!hasSeries}
              onDownload={() => downloadWorkbook(buildInflationWorkbookExportModel({ index, targets, state, range, presentation, sources, siteOrigin }))}
            />
          }
        />
      </ExplorerWorkspace>

      <InflationIndicators index={index} targets={targets} />
    </ExplorerPage>
  );
}
