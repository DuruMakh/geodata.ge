"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import type { ServedCpiFact, ServedInflationTargetRow } from "../../lib/data/inflation/types";
import { formatDisplayDate } from "../../lib/explorer/format";
import { periodLabel, seriesLabel } from "../../lib/explorer/inflationLabels";
import {
  DEFAULT_INFLATION_STATE, INFLATION_COLORS, INFLATION_TABS, buildInflationLines, changeInflationTab, indexInflationFacts,
  overallCoverage, parseInflationHash, rangeFromPatch, resolveInflationRange, serializeInflationHash, toggleSelection,
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

// Inflation overview (spec §6): the GDP overview's centred tabs over the Budget
// explorers' workspace — chart or monthly table, range strip and series panel.

const INDEX_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationOverviewProps = {
  facts: ServedCpiFact[];
  targets: ServedInflationTargetRow[];
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationOverview({ facts, targets, sources, siteOrigin }: InflationOverviewProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(() => indexInflationFacts(facts), [facts]);
  const [state, setState] = useState<InflationState>(DEFAULT_INFLATION_STATE);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const parsed = parseInflationHash(window.location.hash);
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(changeInflationTab(parsed, parsed.tab, index));
    setReady(true);
    document.body.dataset.appReady = "true";
    return () => {
      delete document.body.dataset.appReady;
    };
  }, [index]);

  useEffect(() => {
    if (ready) history.replaceState(null, "", `#${serializeInflationHash(state)}`);
  }, [ready, state]);

  const range = resolveInflationRange(state, index);
  const { periods, lines } = buildInflationLines(index, targets, state, range);
  const tabPeriods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  const coverage = overallCoverage(index);
  const lastReviewedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
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
    <main data-testid="inflation-overview" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: message(messages, "common.home"), href: pageHref("/", locale) },
            { label: message(messages, "common.data") },
            { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
            { label: t("heading") },
          ]}
          coverage={`${periodLabel(messages, coverage.min, "short")} – ${periodLabel(messages, coverage.max, "short")} · ${message(messages, "main.updated", { date: displayDate })}`}
        />
        <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {t("heading")}
        </h1>
        <p data-testid="inflation-unit" className="mb-4 text-[13px] text-[var(--muted)]">{t(`unit.${state.tab}`)}</p>

        <div
          data-testid="inflation-tabs"
          role="group"
          aria-label={t("tabs")}
          className="mb-3 overflow-x-auto py-2"
          onFocusCapture={(event) => event.target.scrollIntoView({ block: "nearest", inline: "nearest" })}
        >
          <div className="mx-auto flex w-max gap-7 px-1">
            {INFLATION_TABS.map((tab) => (
              <TextTab key={tab} testId={`inflation-tab-${tab}`} label={t(`tab.${tab}`)} active={state.tab === tab} onClick={() => selectTab(tab)} />
            ))}
          </div>
        </div>
        <p role="status" className="sr-only">{announcement}</p>

        <div data-testid="explorer-workspace" className="grid items-start gap-8 @min-[1100px]:grid-cols-[minmax(0,1fr)_292px] @min-[1100px]:gap-10">
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
              <RangeStrip
                years={tabPeriods}
                range={range}
                periodsPerYear={12}
                formatPeriod={(period) => periodLabel(messages, period, "short")}
                onChange={(patch) => setState((current) => ({ ...current, range: rangeFromPatch(range, patch) }))}
              />
            </section>
            <div className="mt-[18px] space-y-2">
              <SourceNote testId="source-label">
                {t("source")} {message(messages, "main.lastUpdated", { date: displayDate })}
              </SourceNote>
              <Link href={pageHref("/methodology/inflation", locale)} className="text-xs text-[var(--muted)] underline underline-offset-4">
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
        </div>

        <InflationIndicators index={index} targets={targets} />
      </div>
    </main>
  );
}
