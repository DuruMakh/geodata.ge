"use client";

import { coverageLabel } from "../../lib/explorer/coverageLabel";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import { formatDisplayDate } from "../../lib/explorer/format";
import {
  buildCityIndex,
  buildCityLines,
  cityCoverage,
  defaultCityState,
  rangeFromPatch,
  resolveCityRange,
  restoreCityState,
  serializeCityHash,
  toggleAllCityLines,
  toggleCityLine,
  unpackCityFacts,
  cityValues,
  GEORGIA_LINE_ID,
  HEADLINE_ID,
  type CityState,
  type CityView,
  type PackedCitySeries,
} from "../../lib/explorer/inflationCities";
import { cityLineLabel, cityViewLineColor, cityViewLineLabel } from "../../lib/explorer/inflationCityLabels";
import { CITIES_PATH } from "../../lib/explorer/inflationCityRoutes";
import { buildInflationCityWorkbookExportModel } from "../../lib/explorer/inflationCityWorkbook";
import { formatInflationValue, periodLabel } from "../../lib/explorer/inflationLabels";
import { latestEntry } from "../../lib/explorer/latestValue";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import type { InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { InflationCityCategoryIndicators } from "./inflation-city-category-indicators";
import { InflationCityHeading } from "./inflation-city-heading";
import { InflationCityIndicators } from "./inflation-city-indicators";
import { InflationCityPanel } from "./inflation-city-panel";
import { InflationCityTable } from "./inflation-city-table";

// Inflation cities (spec 2026-09-30): the Georgia page compares seven places on the
// total; a city page shows that city's total and divisions. Annual inflation only.
// No headline value line under the H1 (DESIGN.md §25).

const PCT_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationCitiesProps = {
  view: CityView;
  facts: PackedCitySeries[];
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationCities({ view, facts, lastReviewedAt, sources, siteOrigin }: InflationCitiesProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(() => buildCityIndex(unpackCityFacts(facts)), [facts]);
  const [state, setState] = useState<CityState>(() => defaultCityState(view));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(restoreCityState(window.location.hash, index, view));
    setReady(true);
  }, [index, view]);
  useAppReady();
  useReplaceHash(serializeCityHash(state, view), ready);

  const range = resolveCityRange(state, index, view);
  const coverage = cityCoverage(index, view);
  // The place's own total: Georgia on the Georgia page, the city on a city page.
  const latest = latestEntry(cityValues(index, view.kind === "city" ? view.cityId : GEORGIA_LINE_ID, HEADLINE_ID, "yoy_pct"));
  const periods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  const displayDate = locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt;
  const lines = buildCityLines(index, view, state, range);
  const hasSeries = lines.lines.length > 0;

  const chartSeries: ChartSeries[] = lines.lines.map((line) => ({
    id: line.key,
    label: cityViewLineLabel(messages, view, line.key),
    color: cityViewLineColor(view, line.key),
    vals: line.values,
    planned: line.values.map(() => false),
  }));
  const citiesCrumb = { label: t("citiesHeading"), ...(view.kind === "city" ? { href: pageHref(CITIES_PATH, locale) } : {}) };

  return (
    <ExplorerPage testId="inflation-cities">
      <PageHeader
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
          citiesCrumb,
          ...(view.kind === "city" ? [{ label: cityLineLabel(messages, view.cityId) }] : []),
        ]}
        coverage={coverageLabel(messages, locale, periodLabel(messages, coverage.min, "short"), periodLabel(messages, coverage.max, "short"), lastReviewedAt)}
      />
      <InflationCityHeading view={view} />
      {latest ? (
        <LatestValueLine testId="inflation-city-latest" measure={t("tab.yoy")} period={periodLabel(messages, latest.period, "long")} value={formatInflationValue(latest.value, "yoy")} />
      ) : null}
      <p data-testid="inflation-city-unit" className="mb-4 text-[13px] text-[var(--muted)]">
        {t("categoryUnit.yoy")}
      </p>

      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={state.mode} className="border-t border-[var(--ink)] pt-3">
            <SegmentedTabs<CityState["mode"]>
              ariaLabel={message(messages, "controls.viewMode")}
              value={state.mode}
              onChange={(mode) => setState((current) => ({ ...current, mode }))}
              options={[
                { value: "chart", label: message(messages, "controls.chart"), testId: "chart-mode-chart" },
                { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
              ]}
            />
            {!hasSeries ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
              </div>
            ) : state.mode === "table" ? (
              <InflationCityTable index={index} view={view} state={state} range={range} onTableSeriesChange={(lineId) => setState((current) => ({ ...current, tableSeries: lineId }))} />
            ) : (
              <div className="mt-5">
                <EditorialLineChart
                  years={lines.periods}
                  series={chartSeries}
                  share
                  unit={PCT_UNIT}
                  shareLabel={t("categoryTab.yoy")}
                  periodsPerYear={12}
                  formatPeriod={(period, kind) =>
                    kind === "axis" && periodMonth(period) === 1 ? String(periodYear(period)) : periodLabel(messages, period, kind === "axis" ? "short" : "long")
                  }
                />
              </div>
            )}
            <ChartSelectionAids series={chartSeries} chartShown={state.mode === "chart"} share unit={PCT_UNIT} />
            <RangeStrip
              years={periods}
              range={range}
              periodsPerYear={12}
              formatPeriod={(period) => periodLabel(messages, period, "short")}
              formatMonth={(month) => message(messages, `inflation.monthShort.${month}`)}
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
          view={view}
          state={state}
          range={range}
          onToggle={(lineId) => setState((current) => toggleCityLine(current, view, lineId))}
          onToggleAll={() => setState((current) => toggleAllCityLines(current, view))}
          downloadAction={
            <ExcelDownloadButton
              testId="inflation-city-download"
              disabled={!hasSeries}
              onDownload={() => downloadWorkbook(buildInflationCityWorkbookExportModel({ index, view, state, range, presentation, sources, siteOrigin }))}
            />
          }
        />
      </ExplorerWorkspace>

      {view.kind === "georgia" ? <InflationCityIndicators index={index} /> : <InflationCityCategoryIndicators index={index} cityId={view.cityId} />}
    </ExplorerPage>
  );
}
