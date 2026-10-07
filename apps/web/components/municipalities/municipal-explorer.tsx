"use client";

import Link from "next/link";
import { message } from "../../lib/i18n/messages";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { pageHref } from "../../lib/i18n/routes";
import type { Presentation } from "../../lib/i18n/types";
import { I18nProvider, useI18n } from "../../lib/i18n/provider";
import { publicLabel } from "../../lib/i18n/labels";
import { workbookMessage } from "../../lib/i18n/workbook";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MunicipalFunction, MunicipalFunctionFact, MunicipalTotalFact } from "../../lib/data/municipal/types";
import {
  buildComparisonRows,
  buildCountryKpis,
  buildEntityKpis,
  buildMunicipalIndicatorPresentation,
  buildMovers,
  buildMunicipalEntityModel,
  getDefaultMunicipalSelection,
  municipalShareValueForYear,
} from "../../lib/explorer/municipalData";
import { formatAmount, unitFor, unitsFor } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import {
  buildWorkbookExportModel,
  type WorkbookExportInput,
  type WorkbookPublicSource,
  type WorkbookSeries,
} from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { EntityPicker, type EntityPickerCountry, type EntityPickerGroup } from "./entity-picker";
import { MunicipalIndicators } from "./municipal-indicators";
import { useMunicipalState } from "./use-municipal-state";
import { useAppReady } from "../explorer-shell/use-app-ready";

export type MunicipalMetricContext =
  | {
      kind: "ranked";
      nationalTotalByYear: Record<number, number>;
      rankByYear: Record<number, number>;
      rankOutOf: number;
    }
  | { kind: "country"; budgetCount: number };

type MunicipalNavigation = { prev: { label: string; href: string }; next: { label: string; href: string } };

type MunicipalExplorerBaseProps = {
  presentation: Presentation;
  title: string;
  triggerLabel: string;
  metaLine: string;
  entityId: string;

  // Raw facts, already narrowed (and, for a region, aggregated) by the route.
  // NOT a prebuilt model: change, the share column, the KPIs, the movers and the
  // comparison table are all functions of the selected range, which is client
  // state. Handing over one full-span model and filtering its years array would
  // leave all five describing a period the reader is not looking at.
  functions: MunicipalFunction[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];

  workbookBasename: string;
  workbookSources: WorkbookPublicSource[];
  functionalWorkbookSources?: WorkbookPublicSource[];
  supplementalWorkbookSources?: WorkbookPublicSource[];
  siteOrigin: string;
  pickerCountry: EntityPickerCountry;
  pickerGroups: EntityPickerGroup[];
  sourceNote: string;
  summary?: string;
  children?: ReactNode;
};

export type MunicipalExplorerProps = MunicipalExplorerBaseProps &
  (
    | { metrics: Extract<MunicipalMetricContext, { kind: "ranked" }>; navigation: MunicipalNavigation }
    | { metrics: Extract<MunicipalMetricContext, { kind: "country" }>; navigation?: never }
  );

export function MunicipalExplorer(props: MunicipalExplorerProps) {
  return <I18nProvider {...props.presentation}><MunicipalExplorerContent {...props} /></I18nProvider>;
}

function MunicipalExplorerContent(props: MunicipalExplorerProps) {
  const i18n = useI18n();
  const { locale, messages, englishLabels } = i18n;
  const { functions, functionFacts, totalFacts } = props;
  const { metrics, navigation } = props;
  const [pickerOpen, setPickerOpen] = useState(false);

  const allYears = useMemo(
    () => Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b),
    [totalFacts],
  );
  const firstYear = allYears[0] ?? 0;
  const lastYear = allYears.at(-1) ?? 0;

  // Full-span model, for the series list's stable order and the default
  // selection — both must survive a range change rather than re-deriving.
  const fullModel = useMemo(
    () =>
      buildMunicipalEntityModel({
        functions,
        functionFacts,
        totalFacts,
        startYear: firstYear,
        endYear: lastYear,
      }, i18n),
    [functions, functionFacts, totalFacts, firstYear, lastYear, i18n],
  );

  const knownIds = useMemo(
    () => new Set([fullModel.totalRow.itemId, ...fullModel.rows.map((row) => row.itemId)]),
    [fullModel],
  );
  const defaults = useMemo(() => getDefaultMunicipalSelection(fullModel), [fullModel]);
  // Precision is decided once, from the full span rather than the selection, so
  // dragging the range or toggling a series never reformats the numbers under
  // the reader. Small functions (ონი health, 133,333 ₾) would otherwise share a
  // cell value with the genuinely unfunded ones.
  const unit = useMemo(
    () =>
      unitFor(
        [fullModel.totalRow, ...fullModel.rows].flatMap((row) =>
          Object.values(row.valuesByYear).filter((value): value is number => value !== null),
        ),
        unitsFor(locale).mln,
      ),
    [fullModel, locale],
  );
  const state = useMunicipalState(allYears, defaults, knownIds);

  // REBUILT on every range change. Filtering the full model's years instead
  // would leave change, the share column, the movers and the comparison describing
  // the whole span while the year columns describe the selection.
  const model = useMemo(
    () =>
      buildMunicipalEntityModel({
        functions,
        functionFacts,
        totalFacts,
        startYear: state.range.start,
        endYear: state.range.end,
      }, i18n),
    [functions, functionFacts, totalFacts, state.range.start, state.range.end, i18n],
  );

  const years = model.years;
  const kpis =
    metrics.kind === "country"
      ? buildCountryKpis(model, metrics.budgetCount, i18n)
      : buildEntityKpis({ model, ...metrics }, i18n);
  const presentation = buildMunicipalIndicatorPresentation(model, metrics);
  const selectableRows = useMemo(() => [model.totalRow, ...model.rows], [model]);
  const series: ChartSeries[] = selectableRows
    .filter((row) => state.selectedIds.includes(row.itemId))
    .map((row) => ({
      id: row.itemId,
      label: publicLabel(locale, row.itemId, row.kaLabel, englishLabels),
      color: row.color,
      vals: years.map((year) => {
        const value = row.valuesByYear[year] ?? null;
        if (!state.share) return value;
        // The chart axis is in percentage points, not fractions.
        const share = municipalShareValueForYear(model, row, year);
        return share === null ? null : share * 100;
      }),
      planned: years.map(() => false),
    }));

  const noSelection = state.selectedIds.length === 0;
  const [seriesQuery, setSeriesQuery] = useState("");
  const visibleRows = useMemo(() => {
    const needle = seriesQuery.trim();
    const functions = needle === "" ? model.rows : model.rows.filter((row) => matchesLabelQuery(needle, [row.kaLabel, row.enLabel]));
    return [model.totalRow, ...functions];
  }, [model.rows, model.totalRow, seriesQuery]);
  const normalizedSeriesQuery = seriesQuery.trim().toLowerCase();
  const hasVisibleMatches =
    normalizedSeriesQuery === "" ||
    matchesLabelQuery(normalizedSeriesQuery, [model.totalRow.kaLabel, model.totalRow.enLabel]) ||
    visibleRows.length > 1;
  const allSelected = selectableRows.every((row) => state.selectedIds.includes(row.itemId));
  const hasSelection = state.selectedIds.length > 0;

  function toggleAll() {
    state.setSelectedIds(hasSelection ? [] : selectableRows.map((row) => row.itemId));
  }

  function buildWorkbookInput(): WorkbookExportInput {
    const selectedRows = [model.totalRow, ...model.rows].filter((row) =>
      state.selectedIds.includes(row.itemId),
    );
    const years = allYears.filter(
      (year) => year >= state.range.start && year <= state.range.end,
    );
    const workbookSeries = selectedRows.map<WorkbookSeries>((row) => {
      const pointsByYear: WorkbookSeries["pointsByYear"] = {};
      for (const year of years) {
        const amountGel = row.valuesByYear[year];
        const basis = row.basisByYear[year];
        pointsByYear[year] = amountGel === null || amountGel === undefined || basis === undefined
          ? null
          : {
              amountGel,
              measureValue: state.share ? municipalShareValueForYear(model, row, year) : undefined,
              basis,
            };
      }

      return {
        id: row.itemId,
        kind: row.itemId === model.totalRow.itemId ? "total" : "item",
        parentLabel: null,
        label: publicLabel(locale, row.itemId, row.kaLabel, englishLabels),
        pointsByYear,
      };
    });
    const hasFunctionSeries = selectedRows.some((row) => row.itemId !== model.totalRow.itemId);
    const hasTotalSeries = selectedRows.some((row) => row.itemId === model.totalRow.itemId);
    const useTotalSources = hasTotalSeries || (state.share && hasFunctionSeries);
    return {
      locale,
      filenameBase: props.workbookBasename,
      title: publicLabel(locale, props.entityId, metrics.kind === "country" ? props.pickerCountry.nameKa : props.triggerLabel, englishLabels),
      groupLabel: workbookMessage(locale, "workbook.municipalExpenditure"),
      years,
      measure: state.share
        ? {
            kind: "percentage",
            unitLabel: workbookMessage(locale, "workbook.percentShare"),
            analysisHeader: workbookMessage(locale, "workbook.budgetShareHeader"),
          }
        : { kind: "amount", unitLabel: workbookMessage(locale, "workbook.millionGel"), readableScale: 1_000_000 },
      totalId: model.totalRow.itemId,
      series: workbookSeries,
      sources: [
        ...(hasFunctionSeries ? props.functionalWorkbookSources ?? [] : []),
        ...(useTotalSources ? props.workbookSources : []),
        ...(useTotalSources ? props.supplementalWorkbookSources ?? [] : []),
      ],
      siteOrigin: props.siteOrigin,
    };
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerOpen(true);
      }
    }

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useAppReady();

  return (
    <>
      <div className="mt-[22px] flex flex-col gap-4 min-[768px]:flex-row min-[768px]:items-baseline min-[768px]:justify-between min-[768px]:gap-5">
        <div className="min-w-0 min-[768px]:flex-1">
          {/* The popover is a SIBLING of the heading, not a child: a role="dialog"
              and a fixed overlay nested inside an h1 is announced as part of the
              heading and is fragile to position. */}
          <h1 className="mb-2 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[36px]">
            {props.title}{" "}
            <button
              type="button"
              data-testid="entity-picker-trigger"
              aria-expanded={pickerOpen}
              aria-haspopup="dialog"
              onClick={() => setPickerOpen((current) => !current)}
              className="group inline-block max-w-full align-bottom break-words cursor-pointer border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] font-[family-name:var(--font-display)] text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]"
            >
              {props.triggerLabel}
              <span
                aria-hidden="true"
                className={`ml-1 inline-block h-0 w-0 border-x-[4px] border-x-transparent ${
                  pickerOpen ? "border-b-[5px] border-b-current" : "border-t-[5px] border-t-current"
                }`}
              />
            </button>
          </h1>
          <EntityPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            country={props.pickerCountry}
            groups={props.pickerGroups}
            activeId={props.entityId}
          />
          <div className="text-[12.5px] text-[var(--muted)]">{props.metaLine}</div>
        </div>
        {navigation ? (
          <span
            data-testid="municipal-entity-navigation"
            className="grid w-full min-w-0 grid-cols-2 items-center gap-4 min-[768px]:flex min-[768px]:w-auto min-[768px]:max-w-[40%] min-[768px]:shrink"
          >
            <a href={navigation.prev.href} className="block min-w-0 truncate font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
              ← {navigation.prev.label}
            </a>
            <a href={navigation.next.href} className="block min-w-0 truncate text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
              {navigation.next.label} →
            </a>
          </span>
        ) : null}
      </div>

      <div
        data-testid="municipal-workspace"
        className="mt-7 grid items-start gap-10 border-t border-[var(--ink)] pt-5 @min-[1100px]:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="min-w-0">
          <div
            data-testid="municipal-chart-controls"
            className="mb-[18px] flex flex-wrap items-center justify-between gap-x-5 gap-y-3"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 [&_button]:min-h-9">
              <SegmentedTabs<ChartMode>
                ariaLabel={message(messages, "municipal.viewMode")}
                value={state.chartMode}
                onChange={state.setChartMode}
                options={[
                  { value: "line", label: message(messages, "municipal.line"), testId: "municipal-mode-line" },
                  { value: "table", label: message(messages, "municipal.table"), testId: "municipal-mode-table" },
                ]}
              />
              {/* Phones keep the pill on this row: the caption shortens to the unit, and
                  in share mode the pressed "% წილი" pill names the unit itself. */}
              <span data-testid="municipal-measure-label" className="min-w-0 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                <span className="max-[768px]:hidden">{message(messages, state.share ? "municipal.shareMeasure" : "municipal.amountMeasure")}</span>
                {state.share ? null : <span className="hidden max-[768px]:inline">{message(messages, "municipal.amountMeasureShort")}</span>}
              </span>
            </span>
            <button
              type="button"
              data-testid="municipal-share-toggle"
              aria-pressed={state.share}
              onClick={() => state.setShare(!state.share)}
              className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border px-3 text-[11.5px] ${
                state.share
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] before:mr-1 before:content-['✓'_/_'']"
                  : "border-[var(--control)] text-[var(--muted)]"
              }`}
            >
              {message(messages, "municipal.shareToggle")}
            </button>
          </div>

          {state.chartMode === "line" && noSelection ? (
            <div className="mt-5">
              <Callout testId="no-selection-callout">{message(messages, "municipal.noSelection")}</Callout>
            </div>
          ) : state.chartMode === "line" ? (
            <EditorialLineChart years={years} series={series} share={state.share} unit={unit} shareLabel={message(messages, "municipal.shareOfBudget")} />
          ) : (
            <ExplorerTable
              caption={message(messages, state.share ? "municipal.tableCaptionShare" : "municipal.tableCaptionAmount", { name: props.triggerLabel, start: state.range.start, end: state.range.end })}
              rows={model.rows.filter((row) => state.selectedIds.includes(row.itemId))}
              totalRow={model.totalRow}
              showTotal={state.selectedIds.includes(model.totalRow.itemId)}
              years={years}
              firstColumnLabel={message(messages, "municipal.function")}
              unit={unit}
              share={state.share}
              shareColumnLabel={message(messages, "municipal.share")}
              shareValueForYear={(row, year) => municipalShareValueForYear(model, row, year)}
            />
          )}

          {/* allYears, never model.years — the strip must offer the full span
              even when the selection has narrowed it. The strip draws its own rule. */}
          <RangeStrip years={allYears} range={state.range} onChange={state.setRange} />

          <div className="mt-5 max-w-[640px]">
            <SourceNote testId="municipal-source-note">{props.sourceNote}</SourceNote>
          </div>

          {props.summary ? (
            <p
              data-testid="municipal-entity-summary"
              className="mt-5 max-w-[740px] border-l-2 border-[var(--accent)] bg-[var(--tint)] px-4 py-3 text-[13px] leading-[1.65] text-[var(--body)]"
            >
              {props.summary}
            </p>
          ) : null}

          {props.children}

        </div>

        <aside className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]">
          <div className="sticky top-5">
            <SeriesSelector
              query={seriesQuery}
              onQueryChange={setSeriesQuery}
              searchPlaceholder={message(messages, "municipal.search")}
              selectedCount={state.selectedIds.length}
              totalCount={selectableRows.length}
              hasSelection={hasSelection}
              allSelected={allSelected}
              onToggleAll={toggleAll}
              hasVisibleMatches={hasVisibleMatches}
            >
              {visibleRows.map((row) => (
                <SeriesSelectorRow
                  key={row.itemId}
                  id={row.itemId}
                  label={publicLabel(locale, row.itemId, row.kaLabel, englishLabels)}
                  color={row.color}
                  value={formatAmount(row.valuesByYear[state.range.end] ?? null, locale)}
                  selected={state.selectedIds.includes(row.itemId)}
                  level={row.itemId === model.totalRow.itemId ? "total" : "category"}
                  onToggle={() => state.toggleSeries(row.itemId)}
                />
              ))}
            </SeriesSelector>
            <ExcelDownloadButton
              testId="municipal-excel"
              disabled={state.selectedIds.length === 0}
              onDownload={() => downloadWorkbook(buildWorkbookExportModel(buildWorkbookInput()))}
            />

            <Link
              href={pageHref("/explorer/municipalities", locale)}
              className="mt-3.5 block text-[12px] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
            >
              {message(messages, "municipal.allMunicipalities")}
            </Link>
          </div>
        </aside>
      </div>

      {/* All three derive from the RANGE model, so they move together with
          the chart instead of describing a span the user is not looking at. */}
      <MunicipalIndicators
        entityLabel={props.triggerLabel}
        kpis={kpis}
        presentation={presentation}
        movers={buildMovers(model, i18n)}
        comparison={buildComparisonRows(model, i18n)}
        startYear={state.range.start}
        endYear={state.range.end}
      />
    </>
  );
}
