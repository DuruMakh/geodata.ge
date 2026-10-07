"use client";

import { coverageLabel } from "../../lib/explorer/coverageLabel";
import { useMemo } from "react";
import { buildDebtWorkbookExportModel } from "../../lib/explorer/debtWorkbook";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { pageHref } from "../../lib/i18n/routes";
import { publicLabel } from "../../lib/i18n/labels";
import { useI18n } from "../../lib/i18n/provider";
import type { SourcedWorkbookPublicSource } from "../../lib/methodology/workbookSources";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { buildDebtDeck, buildDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { formatAmount, formatPoints, formatShare, unitFor, unitsFor, formatDisplayDate } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type {
  DebtFamily,
  DebtSeriesId,
  ClientGovernmentDebtFact,
} from "../../lib/servedRows";
import type { ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { DebtSeriesPanel } from "./debt-series-panel";
import { useDebtExplorerState } from "./use-debt-explorer-state";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { MeasurePill } from "../explorer-shell/measure-pill";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";

type DebtRange = { start: number; end: number; min: number; max: number };

type DebtExplorerProps = {
  facts: ClientGovernmentDebtFact[];
  gdpFacts: ClientNationalGdpFact[];
  workbookSources: SourcedWorkbookPublicSource[];
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
  const deck = buildDebtDeck(props.facts, props.family);
  const deckValue = deck === null
    ? "—"
    : props.family === "rate"
      ? formatShare(deck.value / 100)
      : formatAmount(deck.value, locale);
  const deckChange = deck?.change ?? null;
  const preliminaryGdpYears = props.family === "stock"
    ? model.years.filter((year) => props.gdpFacts.some((fact) => fact.year === year && fact.status === "preliminary"))
    : [];
  const coverage = coverageLabel(messages, locale, familyYears[0], familyYears.at(-1), props.lastUpdatedAt || undefined);
  const forecastYears = model.forecastStartYear === null
    ? []
    : model.years.filter((year) => year >= model.forecastStartYear!);
  const forecastBoundaryYear = props.facts
    .filter((fact) => fact.family === "service" && fact.status === "projection_existing_portfolio")
    .map((fact) => fact.year)
    .sort((left, right) => left - right)[0] ?? null;

  return (
    <ExplorerPage testId="debt-explorer" repeatDesktopBottomPadding>
      <PageHeader
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.budget"), href: pageHref("/explorer", locale) },
          { label: message(messages, "common.debt") },
        ]}
        coverage={coverage}
      />
      <ExplorerHeading>{message(messages, "debt.heading")}</ExplorerHeading>
      <p data-testid="debt-deck" className="mb-[30px] flex min-h-[18px] flex-wrap items-baseline gap-2 text-[13px] text-[var(--body)]">
        <span className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--ink)]">
          {deck?.year}: {message(messages, FAMILY_LABEL[props.family])} · {deckValue}
        </span>
        {deckChange !== null ? (
          <>
            <span
              className="font-[family-name:var(--font-numeric)] text-[13px]"
              style={{ color: deckChange.value < 0 ? NEGATIVE : POSITIVE }}
            >
              {deckChange.kind === "points"
                ? `${formatPoints(deckChange.value, true)} ${message(messages, "debt.pp")}`
                : formatShare(deckChange.value, true)}
            </span>
            <span>{message(messages, "main.previousYear")}</span>
          </>
        ) : null}
      </p>

      <ExplorerWorkspace>
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
                  <MeasurePill label={message(messages, "main.percentGdp")} pressed={props.shareOfGdp} onChange={props.onShareChange} />
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
            <ChartSelectionAids series={chartSeries} chartShown={props.chartMode === "line"} share={isPercent} unit={unit} />

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
              {preliminaryGdpYears.length > 0 ? " " + message(messages, "main.preliminaryGdp", { years: preliminaryGdpYears.join(", ") }) : null}
              {props.family === "rate" ? message(messages, "debt.missingRates") : null}
              {props.lastUpdatedAt ? (
                <>{" "}<Message messages={messages} id="main.lastUpdated" values={{ date: <span className="font-[family-name:var(--font-numeric)]">{locale === "en" ? formatDisplayDate(props.lastUpdatedAt, locale) : props.lastUpdatedAt}</span> }} /></>
              ) : null}
            </SourceNote>
          </div>
        </div>

        <DebtSeriesPanel
          items={model.items}
          family={props.family}
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
      </ExplorerWorkspace>
    </ExplorerPage>
  );
}

export function DebtExplorer(props: DebtExplorerProps) {
  const state = useDebtExplorerState(props.facts);

  useAppReady();

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
