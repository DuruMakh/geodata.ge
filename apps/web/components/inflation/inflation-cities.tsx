"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import { formatDisplayDate } from "../../lib/explorer/format";
import {
  CITY_TABS,
  DEFAULT_CITY_STATE,
  buildCityIndex,
  buildCityLines,
  changeCityTab,
  cityCoverage,
  parseCityHash,
  rangeFromPatch,
  resolveCityRange,
  serializeCityHash,
  toggleAllCityLines,
  toggleCityLine,
  unpackCityFacts,
  type CityState,
  type CityTab,
  type PackedCitySeries,
} from "../../lib/explorer/inflationCities";
import { cityLineColor, cityLineLabel } from "../../lib/explorer/inflationCityLabels";
import { buildInflationCityWorkbookExportModel } from "../../lib/explorer/inflationCityWorkbook";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import type { InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { InflationCityCategorySelect } from "./inflation-city-category-select";
import { InflationCityIndicators } from "./inflation-city-indicators";
import { InflationCityPanel } from "./inflation-city-panel";
import { InflationCityTable } from "./inflation-city-table";

// Inflation cities (spec 2026-09-26 §6): the overview's anatomy, seven lines —
// Georgia in ink, then the six cities — and a category picker. No headline value
// line under the H1 (DESIGN.md §25).

const PCT_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationCitiesProps = {
  facts: PackedCitySeries[];
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationCities({ facts, lastReviewedAt, sources, siteOrigin }: InflationCitiesProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(() => buildCityIndex(unpackCityFacts(facts)), [facts]);
  const [state, setState] = useState<CityState>(DEFAULT_CITY_STATE);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const parsed = parseCityHash(window.location.hash);
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(changeCityTab(parsed, parsed.tab, index));
    setReady(true);
  }, [index]);
  useAppReady();
  useReplaceHash(serializeCityHash(state), ready);

  const range = resolveCityRange(state, index);
  const tabPeriods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  const coverage = cityCoverage(index, "mom");
  const displayDate = locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt;
  const lines = buildCityLines(index, state, range);
  const hasSeries = lines.lines.length > 0;

  function selectTab(tab: CityTab) {
    const next = changeCityTab(state, tab, index);
    const nextRange = resolveCityRange(next, index);
    setState(next);
    setAnnouncement(t("rangeChanged", { start: periodLabel(messages, nextRange.start, "short"), end: periodLabel(messages, nextRange.end, "short") }));
  }

  const chartSeries: ChartSeries[] = lines.lines.map((line) => ({
    id: line.key,
    label: cityLineLabel(messages, line.key),
    color: cityLineColor(line.key),
    vals: line.values,
    planned: line.values.map(() => false),
  }));

  return (
    <ExplorerPage testId="inflation-cities">
      <PageHeader
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
          { label: t("citiesHeading") },
        ]}
        coverage={`${periodLabel(messages, coverage.min, "short")} – ${periodLabel(messages, coverage.max, "short")} · ${message(messages, "main.updated", { date: displayDate })}`}
      />
      <ExplorerHeading>{t("citiesHeading")}</ExplorerHeading>
      <p data-testid="inflation-city-unit" className="mb-4 text-[13px] text-[var(--muted)]">
        {t(`categoryUnit.${state.tab}`)}
      </p>

      <div
        data-testid="inflation-city-tabs"
        role="group"
        aria-label={t("tabs")}
        className="mb-3 overflow-x-auto py-2"
        onFocusCapture={(event) => event.target.scrollIntoView({ block: "nearest", inline: "nearest" })}
      >
        <div className="mx-auto flex w-max gap-7 px-1">
          {CITY_TABS.map((tab) => (
            <TextTab key={tab} testId={`inflation-city-tab-${tab}`} label={t(`categoryTab.${tab}`)} active={state.tab === tab} onClick={() => selectTab(tab)} />
          ))}
        </div>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={state.mode} data-tab={state.tab} className="border-t border-[var(--ink)] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <InflationCityCategorySelect value={state.category} onChange={(category) => setState((current) => ({ ...current, category }))} />
              <SegmentedTabs<CityState["mode"]>
                ariaLabel={message(messages, "controls.viewMode")}
                value={state.mode}
                onChange={(mode) => setState((current) => ({ ...current, mode }))}
                options={[
                  { value: "chart", label: message(messages, "controls.chart"), testId: "chart-mode-chart" },
                  { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
                ]}
              />
            </div>
            {!hasSeries ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
              </div>
            ) : state.mode === "table" ? (
              <InflationCityTable index={index} state={state} range={range} onTableSeriesChange={(lineId) => setState((current) => ({ ...current, tableSeries: lineId }))} />
            ) : (
              <div className="mt-5">
                <EditorialLineChart
                  years={lines.periods}
                  series={chartSeries}
                  share
                  unit={PCT_UNIT}
                  shareLabel={t(`categoryTab.${state.tab}`)}
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
              {t("citySource")} {message(messages, "main.lastUpdated", { date: displayDate })}
            </SourceNote>
            <p data-testid="inflation-city-central-prices" className="text-xs text-[var(--muted)]">
              {t("cityCentralPricesNote")}
            </p>
            <Link href={pageHref("/methodology/inflation", locale)} className="text-xs text-[var(--muted)] underline underline-offset-4">
              {t("methodology")}
            </Link>
          </div>
        </div>

        <InflationCityPanel
          index={index}
          state={state}
          range={range}
          onToggle={(lineId) => setState((current) => toggleCityLine(current, lineId))}
          onToggleAll={() => setState((current) => toggleAllCityLines(current))}
          downloadAction={
            <ExcelDownloadButton
              testId="inflation-city-download"
              disabled={!hasSeries}
              onDownload={() => downloadWorkbook(buildInflationCityWorkbookExportModel({ index, state, range, presentation, sources, siteOrigin }))}
            />
          }
        />
      </ExplorerWorkspace>

      <InflationCityIndicators index={index} category={state.category} />
    </ExplorerPage>
  );
}
