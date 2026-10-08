"use client";

import { coverageLabel } from "../../lib/explorer/coverageLabel";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import type { ClientInflationTargetRow } from "../../lib/servedRows";
import type { ClientCpiFact } from "../../lib/servedRows";
import { formatDisplayDate } from "../../lib/explorer/format";
import { formatInflationValue, periodLabel, seriesLabel } from "../../lib/explorer/inflationLabels";
import { latestEntry } from "../../lib/explorer/latestValue";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import {
  DEFAULT_INFLATION_STATE, INFLATION_COLORS, INFLATION_TABS, buildInflationLines, changeInflationTab, indexInflationFacts,
  parseInflationHash, rangeFromPatch, resolveInflationRange, seriesGroup, serializeInflationHash, toggleSelection,
  type InflationState, type InflationTab,
} from "../../lib/explorer/inflationOverview";
import { buildInflationWorkbookExportModel, type InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { InflationIndicators } from "./inflation-indicators";
import { InflationSeriesPanel } from "./inflation-series-panel";
import { InflationTable } from "./inflation-table";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";

// Inflation overview (spec §6): the GDP overview's centred tabs over the Budget
// explorers' workspace — chart or monthly table, range strip and series panel.

const INDEX_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationOverviewProps = {
  facts: ClientCpiFact[];
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
    () => indexInflationFacts(facts, sourceIdBySeriesMeasure),
    [facts, sourceIdBySeriesMeasure],
  );
  const [state, setState] = useState<InflationState>(DEFAULT_INFLATION_STATE);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const parsed = parseInflationHash(window.location.hash);
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(changeInflationTab(parsed, parsed.tab, index));
    setReady(true);
  }, [index]);
  useAppReady();

  const serializedHash = serializeInflationHash(state);
  useReplaceHash(serializedHash, ready);

  const range = resolveInflationRange(state, index);
  const { periods, lines } = buildInflationLines(index, targets, state, range);
  const tabPeriods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  // The eyebrow states the active tab's span — the same months the chart and range strip offer
  // (the index series starts years before the annual and monthly change series).
  const coverage = { min: range.min, max: range.max };
  // The headline CPI's latest published month on the active tab.
  const latest = latestEntry(index.values.get(seriesGroup("cpi", state.tab)));
  const displayDate = locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt;
  const hasSeries = lines.some((line) => line.key !== "target");
  const chartSeries: ChartSeries[] = lines.map((line) => ({
    id: line.key,
    label: seriesLabel(messages, line.key, state.tab),
    color: INFLATION_COLORS[line.key],
    vals: line.values,
    planned: line.values.map(() => false),
    dashed: line.key === "target",
  }));

  function selectTab(tab: InflationTab) {
    const next = changeInflationTab(state, tab, index);
    const nextRange = resolveInflationRange(next, index);
    setState(next);
    setAnnouncement(t("rangeChanged", { start: periodLabel(messages, nextRange.start, "short"), end: periodLabel(messages, nextRange.end, "short") }));
  }

  return (
    <ExplorerPage testId="inflation-overview">
      <PageHeader
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
          { label: t("heading") },
        ]}
        coverage={coverageLabel(messages, locale, periodLabel(messages, coverage.min, "short"), periodLabel(messages, coverage.max, "short"), lastReviewedAt)}
      />
      <ExplorerHeading>{t("heading")}</ExplorerHeading>
      {latest ? (
        <LatestValueLine testId="inflation-latest" measure={t(`tab.${state.tab}`)} period={periodLabel(messages, latest.period, "long")} value={formatInflationValue(latest.value, state.tab)} />
      ) : null}
      <p data-testid="inflation-unit" className="mb-4 text-[13px] text-[var(--muted)]">{t(`unit.${state.tab}`)}</p>

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
            <SegmentedTabs<InflationState["mode"]>
              ariaLabel={message(messages, "controls.viewMode")}
              value={state.mode}
              onChange={(mode) => setState((current) => ({ ...current, mode }))}
              options={[
                { value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" },
                { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
              ]}
            />
            {!hasSeries ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
              </div>
            ) : state.mode === "table" ? (
              <InflationTable index={index} state={state} range={range} onTableSeriesChange={(key) => setState((current) => ({ ...current, tableSeries: key }))} />
            ) : (
              <div className="mt-5">
                <EditorialLineChart
                  years={periods}
                  series={chartSeries}
                  share={state.tab !== "index"}
                  unit={INDEX_UNIT}
                  shareLabel={t(`tab.${state.tab}`)}
                  periodsPerYear={12}
                  formatPeriod={(period, kind) =>
                    kind === "axis" && periodMonth(period) === 1 ? String(periodYear(period)) : periodLabel(messages, period, kind === "axis" ? "short" : "long")
                  }
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
              onChange={(patch) => setState((current) => ({ ...current, range: rangeFromPatch(range, patch) }))}
            />
          </section>
          <div className="mt-[18px] space-y-2">
            <SourceNote testId="source-label">
              {t("source")} {message(messages, "main.lastUpdated", { date: displayDate })}
            </SourceNote>
            <Link href={pageHref("/methodology/inflation", locale)} className="inline-flex min-h-11 items-center text-xs text-[var(--muted)] underline underline-offset-4">
              {t("methodology")}
            </Link>
          </div>
        </div>

        <InflationSeriesPanel
          index={index}
          targets={targets}
          state={state}
          range={range}
          onToggle={(key) => setState((current) => toggleSelection(current, key))}
          onClear={() => setState((current) => ({ ...current, selected: [] }))}
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
