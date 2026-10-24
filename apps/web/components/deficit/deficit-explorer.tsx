"use client";

import { coverageLabel } from "../../lib/explorer/coverageLabel";
import { useMemo } from "react";
import type { ClientGeneralGovernmentBalanceFact } from "../../lib/explorer/clientData";
import { buildDeficitExplorerModel, DEFICIT_ITEM } from "../../lib/explorer/deficitExplorer";
import { parseDeficitHash, serializeDeficitHash } from "../../lib/explorer/deficitUrlState";
import { buildDeficitWorkbookExportModel } from "../../lib/explorer/deficitWorkbook";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { pageHref } from "../../lib/i18n/routes";
import { publicLabel } from "../../lib/i18n/labels";
import { useI18n } from "../../lib/i18n/provider";
import { formatInUnit, formatShare, unitFor, unitsFor } from "../../lib/explorer/format";
import { withLari } from "../ui/lari";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { PageHeader } from "../shell/page-header";
import { Callout, SourceNote } from "../ui/editorial";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { SeriesAside } from "../explorer-shell/series-aside";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { MeasurePill } from "../explorer-shell/measure-pill";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { useHashState } from "../explorer-shell/use-hash-state";
import { DECK_LINE_CLASS } from "../explorer-shell/latest-value-line";
import { navGroup } from "../../lib/navigation/navTree";

type DeficitExplorerProps = {
  facts: ClientGeneralGovernmentBalanceFact[];
  workbookSources: WorkbookPublicSource[];
  edition: string;
  siteOrigin?: string;
  lastUpdatedAt: string;
};

type DeficitBounds = { min: number; max: number };
type DeficitState = { chartMode: ChartMode; percentage: boolean; selected: boolean; range: { start: number; end: number } };

function parseDeficitState(hash: string, { min, max }: DeficitBounds): DeficitState {
  const parsed = parseDeficitHash(hash);
  const start = Math.min(Math.max(parsed.range?.start ?? min, min), max);
  const end = Math.min(Math.max(parsed.range?.end ?? max, min), max);
  return {
    chartMode: parsed.chartMode ?? "line",
    percentage: parsed.percentage ?? true,
    selected: parsed.selected ?? true,
    range: { start: Math.min(start, end), end: Math.max(start, end) },
  };
}

function serializeDeficitState({ chartMode, percentage, selected, range }: DeficitState): string {
  return serializeDeficitHash({ chartMode, percentage, rangeStart: range.start, rangeEnd: range.end, selected });
}

export function DeficitExplorer({ facts, workbookSources, edition, siteOrigin, lastUpdatedAt }: DeficitExplorerProps) {
  const presentation = useI18n();
  const { locale, messages, englishLabels } = presentation;
  const years = useMemo(
    () => [...new Set(facts.map((fact) => fact.year))].sort((left, right) => left - right),
    [facts],
  );
  const min = years[0] ?? 0;
  const max = years.at(-1) ?? min;
  const bounds = useMemo(() => ({ min, max }), [min, max]);
  const { state, update } = useHashState(bounds, parseDeficitState, serializeDeficitState);
  const { chartMode, percentage, selected } = state;
  const range = useMemo(() => ({ ...state.range, min, max }), [state.range, min, max]);
  const setChartMode = (mode: ChartMode) => update((current) => ({ ...current, chartMode: mode }));
  const setPercentage = (share: boolean) => update((current) => ({ ...current, percentage: share }));
  const model = useMemo(
    () => buildDeficitExplorerModel({ facts, range, percentage, selected }, presentation),
    [facts, range, percentage, selected, presentation],
  );
  const forecastBoundaryYear = facts.find((fact) => fact.status === "projection")?.year ?? null;
  const actualYears = facts.filter((fact) => fact.status === "actual").map((fact) => fact.year);
  const projectionYears = facts.filter((fact) => fact.status === "projection").map((fact) => fact.year);
  const latestActual = facts.filter((fact) => fact.status === "actual").at(-1) ?? null;
  const unit = useMemo(
    () => unitFor(facts.map((fact) => fact.generalGovernmentBalanceGel), unitsFor(locale).bn, 2),
    [facts, locale],
  );
  const forecastYears = model.years.filter((year) => year >= (model.forecastStartYear ?? Infinity));
  const label = publicLabel(locale, DEFICIT_ITEM.id, DEFICIT_ITEM.kaLabel, englishLabels);
  const forecastStartYear = model.forecastStartYear;
  const chartSeries: ChartSeries[] = selected
    ? [{
        id: DEFICIT_ITEM.id,
        label,
        color: DEFICIT_ITEM.color,
        vals: model.points.map((point) => point.value),
        ...(forecastStartYear === null
          ? {}
          : { forecastFromYear: forecastStartYear, preliminary: model.years.map((year) => year >= forecastStartYear) }),
      }]
    : [];
  const headlineValue = latestActual
    ? percentage
      ? formatShare(latestActual.generalGovernmentBalancePctGdp / 100)
      // The table's precision, so the deck, the series row and the table print one figure (U07-13).
      : `${formatInUnit(latestActual.generalGovernmentBalanceGel, unit)} ${message(messages, "format.bnGel")}`
    : "—";
  const coverage = coverageLabel(messages, locale, years.length > 0 ? min : undefined, years.length > 0 ? max : undefined, lastUpdatedAt || undefined);

  const chart = (
    <EditorialLineChart
      years={model.years}
      series={chartSeries}
      share={percentage}
      unit={unit}
      shareLabel={message(messages, "main.shareGdp")}
      preliminaryLabel={message(messages, "deficit.forecast")}
    />
  );
  const shareAction = selected ? (
    <ChartShareButton
      title={message(messages, "deficit.heading")}
      caption={`${message(messages, percentage ? "main.shareGdp" : "format.bnGel")} · ${range.start}–${range.end}`}
      legend={chartSeries.map(({ label, color }) => ({ label, color }))}
      source={message(messages, "deficit.source", { edition })}
      chart={chart}
      period={`${range.start}-${range.end}`}
    />
  ) : undefined;
  return (
    <ExplorerPage testId="deficit-explorer" repeatDesktopBottomPadding>
      <PageHeader
        locale={locale}
        messages={messages}
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.budget"), href: pageHref(navGroup("budget").href, locale) },
          { label: message(messages, "common.deficit") },
        ]}
        coverage={coverage}
      />
      <ExplorerHeading>{message(messages, "deficit.heading")}</ExplorerHeading>
      <p data-testid="deficit-deck" className={DECK_LINE_CLASS}>
        <span className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--ink)]">
          {latestActual?.year}: {label} · {withLari(headlineValue)}
        </span>
      </p>

      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section
            data-testid="chart-panel"
            data-mode={chartMode}
            data-measure={percentage ? "percent" : "amount"}
            className="border-t border-[var(--ink)] pt-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ModeTabs value={chartMode} onChange={setChartMode} />
              <div className="flex items-center gap-3.5">
                {percentage ? null : (
                  <span data-testid="deficit-measure-label" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                    {message(messages, "format.bnGel")}
                  </span>
                )}
                <MeasurePill label={message(messages, "main.percentGdp")} pressed={percentage} onChange={setPercentage} />
              </div>
            </div>

            {!selected ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">
                  {message(messages, "main.noSelection")}
                </Callout>
              </div>
            ) : chartMode === "table" ? (
              <ExplorerTable
                caption={message(messages, "deficit.caption", { start: range.start, end: range.end })}
                rows={[model.tableRow]}
                totalRow={null}
                showTotal={false}
                years={model.years}
                firstColumnLabel={message(messages, "controls.seriesColumn")}
                unit={unit}
                share={percentage}
                showChangeColumn={false}
                forecastYears={forecastYears}
                forecastLabel={message(messages, "deficit.forecast")}
                shareValueForYear={(row, year) => row.shareByYear?.[year] ?? null}
              />
            ) : (
              <div className="mt-5">
                {chart}
              </div>
            )}
            <ChartSelectionAids series={chartSeries} chartShown={chartMode === "line"} share={percentage} unit={unit} />

            <RangeStrip
              years={years}
              range={range}
              onChange={(patch) => update((current) => ({
                ...current,
                range: { start: patch.start ?? current.range.start, end: patch.end ?? current.range.end },
              }))}
              marker={forecastBoundaryYear === null
                ? undefined
                : { year: forecastBoundaryYear, label: message(messages, "deficit.forecast") }}
            />
            <p data-testid="deficit-forecast-note" className="mt-3 max-w-[680px] text-xs leading-relaxed text-[var(--muted)]">
              {message(messages, "deficit.forecastNote", {
                projectionFirst: projectionYears[0] ?? "",
                projectionLast: projectionYears.at(-1) ?? "",
                actualFirst: actualYears[0] ?? "",
                actualLast: actualYears.at(-1) ?? "",
              })}
            </p>
          </section>

          <div className="mt-[18px]">
            <SourceNote testId="source-label" action={shareAction}>
              {message(messages, "deficit.source", { edition })}
              {" "}{message(messages, "deficit.definition")}
              {lastUpdatedAt ? (
                <>{" "}<Message messages={messages} id="main.lastUpdated" values={{ date: <span className="font-[family-name:var(--font-numeric)]">{updatedDate(lastUpdatedAt, locale)}</span> }} /></>
              ) : null}
            </SourceNote>
          </div>
        </div>

        <SeriesAside label={message(messages, "controls.series")}>
          <SeriesSelector
            searchable={false}
            selectedCount={selected ? 1 : 0}
            totalCount={1}
            hasSelection={selected}
            allSelected={selected}
            onToggleAll={() => update((current) => ({ ...current, selected: false }))}
            allowSelectAll={false}
            bulkActions={false}
          >
            <SeriesSelectorRow
              id={DEFICIT_ITEM.id}
              label={label}
              color={DEFICIT_ITEM.color}
              value={headlineValue}
              selected={selected}
              level="total"
              onToggle={() => update((current) => ({ ...current, selected: !current.selected }))}
            />
          </SeriesSelector>
          <ExcelDownloadButton
            testId="deficit-excel"
            disabled={!selected}
            onDownload={() => downloadWorkbook(buildDeficitWorkbookExportModel({
              facts,
              range,
              percentage,
              sources: workbookSources,
              siteOrigin: siteOrigin ?? window.location.origin,
            }, presentation))}
          />
        </SeriesAside>
      </ExplorerWorkspace>
    </ExplorerPage>
  );
}
