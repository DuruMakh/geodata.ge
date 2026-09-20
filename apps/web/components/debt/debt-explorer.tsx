"use client";

import { useEffect, useMemo } from "react";
import { buildDebtWorkbookExportModel } from "../../lib/explorer/debtWorkbook";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { pageHref } from "../../lib/i18n/routes";
import { publicLabel } from "../../lib/i18n/labels";
import { useI18n } from "../../lib/i18n/provider";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { buildDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { formatAmount, formatShare, unitFor, unitsFor, formatDisplayDate } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type {
  DebtFamily,
  DebtSeriesId,
  ClientGovernmentDebtFact,
  ServedNationalGdpFact,
} from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { DebtSeriesPanel } from "./debt-series-panel";
import { useDebtExplorerState } from "./use-debt-explorer-state";

type DebtRange = { start: number; end: number; min: number; max: number };

type DebtExplorerProps = {
  facts: ClientGovernmentDebtFact[];
  gdpFacts: ServedNationalGdpFact[];
  workbookSources: WorkbookPublicSource[];
  gdpWorkbookSources?: WorkbookPublicSource[];
  siteOrigin?: string;
  lastUpdatedAt: string;
};

type DebtExplorerSurfaceProps = DebtExplorerProps & {
  family: DebtFamily;
  chartMode: ChartMode;
  shareOfGdp: boolean;
  range: DebtRange;
  selectedIds: DebtSeriesId[];
  onChartModeChange: (mode: ChartMode) => void;
  onShareChange: (share: boolean) => void;
  onRangeChange: (patch: { start?: number; end?: number }) => void;
  onSelectionChange: (ids: DebtSeriesId[]) => void;
  onToggleSeries: (id: DebtSeriesId) => void;
};

const FAMILY_LABEL: Record<DebtFamily, string> = {
  stock: "debt.stock",
  service: "debt.service",
  rate: "debt.rate",
};

export function DebtExplorerSurface(props: DebtExplorerSurfaceProps) {
  const presentation = useI18n();
  const { locale, messages, englishLabels } = presentation;
  const model = useMemo(() => buildDebtExplorerModel({
    facts: props.facts,
    gdpFacts: props.gdpFacts,
    family: props.family,
    selectedIds: props.selectedIds,
    range: props.range,
    shareOfGdp: props.shareOfGdp,
  }, presentation), [props.facts, props.gdpFacts, props.family, props.selectedIds, props.range, props.shareOfGdp, presentation]);
  const familyYears = useMemo(() => Array.from(new Set(
    props.facts.filter((fact) => fact.family === props.family).map((fact) => fact.year),
  )).sort((left, right) => left - right), [props.facts, props.family]);
  const unit = useMemo(() => unitFor(
    props.facts
      .filter((fact) => fact.family === props.family && fact.valueKind === "amount_gel" && fact.value !== null)
      .map((fact) => fact.value as number),
    unitsFor(locale).bn,
    1,
  ), [props.facts, props.family, locale]);
  const isPercent = props.family === "rate" || (props.family === "stock" && props.shareOfGdp);
  const noSelection = props.selectedIds.length === 0;
  const noRangeData = !noSelection && !model.points.some((point) => point.value !== null);
  const pointsBySeriesYear = new Map(model.points.map((point) => [`${point.itemId}:${point.year}`, point]));
  const chartSeries: ChartSeries[] = model.selectedItems.map((item) => ({
    id: item.id,
    label: publicLabel(locale, item.id, item.kaLabel, englishLabels),
    color: item.color,
    vals: model.years.map((year) => {
      const value = pointsBySeriesYear.get(`${item.id}:${year}`)?.value ?? null;
      return value === null ? null : props.family === "stock" && props.shareOfGdp ? value * 100 : value;
    }),
    planned: model.years.map(() => false),
    ...(props.family === "service" && model.forecastStartYear !== null
      ? { forecastFromYear: model.forecastStartYear }
      : {}),
  }));
  const totalItemId = model.items.find((item) => item.family === props.family && item.parentItemId === null)?.id;
  const totalFacts = totalItemId
    ? props.facts
      .filter((fact) => fact.seriesId === totalItemId && fact.value !== null)
      .sort((left, right) => left.year - right.year)
    : [];
  const latestTotalFact = totalFacts.at(-1) ?? null;
  const previousTotalFact = latestTotalFact
    ? totalFacts.find((fact) => fact.year === latestTotalFact.year - 1) ?? null
    : null;
  const deckValue = latestTotalFact?.value === null || latestTotalFact?.value === undefined
    ? "—"
    : props.family === "rate"
      ? formatShare(latestTotalFact.value / 100)
      : formatAmount(latestTotalFact.value, locale);
  const deckYoy = latestTotalFact?.value !== null
    && latestTotalFact?.value !== undefined
    && previousTotalFact?.value !== null
    && previousTotalFact?.value !== undefined
    && previousTotalFact.value !== 0
    ? (latestTotalFact.value - previousTotalFact.value) / previousTotalFact.value
    : null;
  const coverage = [
    familyYears.length > 0 ? `${familyYears[0]}–${familyYears.at(-1)}` : "",
    props.lastUpdatedAt ? message(messages, "main.updated", { date: locale === "en" ? formatDisplayDate(props.lastUpdatedAt, locale) : props.lastUpdatedAt }) : "",
  ].filter(Boolean).join(" · ");
  const forecastYears = model.forecastStartYear === null
    ? []
    : model.years.filter((year) => year >= model.forecastStartYear!);
  const forecastBoundaryYear = props.facts
    .filter((fact) => fact.family === "service" && fact.status === "projection_existing_portfolio")
    .map((fact) => fact.year)
    .sort((left, right) => left - right)[0] ?? null;

  return (
    <main
      data-testid="debt-explorer"
      className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px] min-[768px]:pb-16"
    >
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: message(messages, "common.home"), href: pageHref("/", locale) },
            { label: message(messages, "common.data") },
            { label: message(messages, "common.budget"), href: pageHref("/explorer", locale) },
            { label: message(messages, "common.debt") },
          ]}
          coverage={coverage}
        />
        <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {message(messages, "debt.heading")}
        </h1>
        <p data-testid="debt-deck" className="mb-[30px] flex min-h-[18px] flex-wrap items-baseline gap-2 text-[13px] text-[var(--body)]">
          <span className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--ink)]">
            {latestTotalFact?.year}: {message(messages, FAMILY_LABEL[props.family])} · {deckValue}
          </span>
          {latestTotalFact?.status === "projection_existing_portfolio" ? (
            <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{message(messages, "debt.forecast")}</span>
          ) : null}
          {deckYoy !== null ? (
            <>
              <span
                className="font-[family-name:var(--font-numeric)] text-[13px]"
                style={{ color: deckYoy < 0 ? NEGATIVE : POSITIVE }}
              >
                {formatShare(deckYoy, true)}
              </span>
              <span>{message(messages, "main.previousYear")}</span>
            </>
          ) : null}
        </p>

        <div data-testid="explorer-workspace" className="grid items-start gap-8 @min-[1100px]:grid-cols-[minmax(0,1fr)_292px] @min-[1100px]:gap-10">
          <div className="flex min-w-0 flex-col">
            <section
              data-testid="chart-panel"
              data-mode={props.chartMode}
              data-family={props.family}
              data-measure={isPercent ? "percent" : "amount"}
              className="border-t border-[var(--ink)] pt-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedTabs<ChartMode>
                  ariaLabel={message(messages, "controls.viewMode")}
                  value={props.chartMode}
                  onChange={props.onChartModeChange}
                  options={[
                    { value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" },
                    { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
                  ]}
                />
                <div className="flex items-center gap-3.5">
                  <span data-testid="debt-measure-label" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                    {props.family === "rate" ? "%" : props.shareOfGdp ? message(messages, "main.percentGdp") : message(messages, "format.bnGel")}
                  </span>
                  {props.family === "stock" ? (
                    <button
                      type="button"
                      data-testid="measure-share-toggle"
                      aria-pressed={props.shareOfGdp}
                      onClick={() => props.onShareChange(!props.shareOfGdp)}
                      className={`h-[27px] flex-none cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors duration-150 ${props.shareOfGdp
                        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                        : "border-[var(--control)] bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}
                    >
                      {message(messages, "main.percentGdp")}
                    </button>
                  ) : null}
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
              ) : props.chartMode === "table" ? (
                <ExplorerTable
                  caption={message(messages, "debt.caption", { family: message(messages, FAMILY_LABEL[props.family]), start: props.range.start, end: props.range.end })}
                  rows={model.tableRows.filter((row) => row.itemId !== totalItemId)}
                  totalRow={model.totalRow}
                  showTotal={Boolean(totalItemId && props.selectedIds.includes(totalItemId))}
                  years={model.years}
                  firstColumnLabel={message(messages, "controls.seriesColumn")}
                  unit={unit}
                  share={isPercent}
                  showChangeColumn={false}
                  forecastYears={forecastYears}
                  forecastLabel={message(messages, "debt.forecast")}
                  shareValueForYear={(row, year) => props.family === "rate"
                    ? row.valuesByYear[year] === null || row.valuesByYear[year] === undefined
                      ? null
                      : row.valuesByYear[year]! / 100
                    : row.shareByYear?.[year] ?? null}
                />
              ) : (
                <div className="mt-5">
                  <EditorialLineChart
                    years={model.years}
                    series={chartSeries}
                    share={isPercent}
                    unit={unit}
                    shareLabel={message(messages, props.family === "rate" ? "debt.rate" : "main.shareGdp")}
                  />
                </div>
              )}

              <RangeStrip
                years={familyYears}
                range={props.range}
                onChange={props.onRangeChange}
                marker={props.family === "service" && forecastBoundaryYear !== null
                  ? { year: forecastBoundaryYear, label: message(messages, "debt.forecast") }
                  : undefined}
              />
              {props.family === "service" ? (
                <p data-testid="debt-forecast-note" className="mt-3 max-w-[680px] text-xs leading-relaxed text-[var(--muted)]">
                  {message(messages, "debt.portfolioForecast")}
                </p>
              ) : null}
            </section>

            <div className="mt-[18px]">
              <SourceNote testId="source-label">
                {message(messages, "debt.source")}
                {" "}{message(messages, "debt.comparability")}
                {props.family === "stock" ? " " + message(messages, "main.gdpSource") : null}
                {props.family === "rate" ? message(messages, "debt.missingRates") : null}
                {props.lastUpdatedAt ? (
                  <>{" "}<Message messages={messages} id="main.lastUpdated" values={{ date: <span className="font-[family-name:var(--font-numeric)]">{locale === "en" ? formatDisplayDate(props.lastUpdatedAt, locale) : props.lastUpdatedAt}</span> }} /></>
                ) : null}
              </SourceNote>
            </div>
          </div>

          <DebtSeriesPanel
            items={model.items}
            facts={props.facts}
            selectedIds={props.selectedIds}
            expandedParentIds={model.expandedParentIds}
            onSelectionChange={props.onSelectionChange}
            onToggle={props.onToggleSeries}
            downloadAction={(
              <ExcelDownloadButton
                testId="debt-excel"
                disabled={noSelection}
                onDownload={() => downloadWorkbook(buildDebtWorkbookExportModel({
                  facts: props.facts,
                  gdpFacts: props.gdpFacts,
                  family: props.family,
                  selectedIds: props.selectedIds,
                  range: props.range,
                  shareOfGdp: props.shareOfGdp,
                  sources: props.workbookSources,
                  gdpSources: props.gdpWorkbookSources ?? [],
                  siteOrigin: props.siteOrigin ?? window.location.origin,
                }, presentation))}
              />
            )}
          />
        </div>
      </div>
    </main>
  );
}

export function DebtExplorer(props: DebtExplorerProps) {
  const state = useDebtExplorerState(props.facts);

  useEffect(() => {
    document.body.dataset.appReady = "true";
    return () => {
      delete document.body.dataset.appReady;
    };
  }, []);

  return (
    <DebtExplorerSurface
      {...props}
      family={state.activeFamily}
      chartMode={state.chartMode}
      shareOfGdp={state.shareOfGdp}
      range={state.range}
      selectedIds={state.selectedIds}
      onChartModeChange={state.setChartMode}
      onShareChange={state.setShareOfGdp}
      onRangeChange={state.setRange}
      onSelectionChange={state.setSelectedSeries}
      onToggleSeries={state.toggleSeries}
    />
  );
}
