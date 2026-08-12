"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MunicipalFunction, MunicipalFunctionFact, MunicipalTotalFact } from "../../lib/data/municipal/types";
import type { SourceDocumentRow } from "../../lib/data/sources";
import {
  buildComparisonRows,
  buildEntityKpis,
  buildMovers,
  buildMunicipalEntityModel,
  getDefaultMunicipalSelection,
} from "../../lib/explorer/municipalData";
import { buildExplorerCsv } from "../../lib/explorer/csvExport";
import { formatAmount, UNIT_MLN } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { EntityPicker, type EntityPickerGroup } from "./entity-picker";
import { MunicipalIndicators } from "./municipal-indicators";
import { useMunicipalState } from "./use-municipal-state";

export type MunicipalExplorerProps = {
  title: string;
  triggerLabel: string;
  metaLine: string;
  entityId: string;

  // Raw facts, already narrowed (and, for a region, aggregated) by the route.
  // NOT a prebuilt model: change, shareEndYear, the KPIs, the movers and the
  // comparison table are all functions of the selected range, which is client
  // state. Handing over one full-span model and filtering its years array would
  // leave all five describing a period the reader is not looking at.
  functions: MunicipalFunction[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  sourceDocuments: SourceDocumentRow[];

  nationalTotalByYear: Record<number, number>;
  rankByYear: Record<number, number>;
  rankOutOf: number;
  csvBasename: string;
  pickerGroups: EntityPickerGroup[];
  prev: { label: string; href: string };
  next: { label: string; href: string };
  sourceNote: string;
  methodologyHref: "/methodology/municipalities";
  children?: ReactNode;
};

export function MunicipalExplorer(props: MunicipalExplorerProps) {
  const router = useRouter();
  const { functions, functionFacts, totalFacts, sourceDocuments } = props;
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
        sourceDocuments,
        startYear: firstYear,
        endYear: lastYear,
      }),
    [functions, functionFacts, totalFacts, sourceDocuments, firstYear, lastYear],
  );

  const knownIds = useMemo(
    () => new Set([fullModel.totalRow.itemId, ...fullModel.rows.map((row) => row.itemId)]),
    [fullModel],
  );
  const defaults = useMemo(() => getDefaultMunicipalSelection(fullModel), [fullModel]);
  const state = useMunicipalState(allYears, defaults, knownIds);

  // REBUILT on every range change. Filtering the full model's years instead
  // would leave change, shareEndYear, the movers and the comparison describing
  // the whole span while the year columns describe the selection.
  const model = useMemo(
    () =>
      buildMunicipalEntityModel({
        functions,
        functionFacts,
        totalFacts,
        sourceDocuments,
        startYear: state.range.start,
        endYear: state.range.end,
      }),
    [functions, functionFacts, totalFacts, sourceDocuments, state.range.start, state.range.end],
  );

  const years = model.years;
  const selectableRows = useMemo(() => [model.totalRow, ...model.rows], [model]);
  const series: ChartSeries[] = selectableRows
    .filter((row) => state.selectedIds.includes(row.itemId))
    .map((row) => ({
      id: row.itemId,
      label: row.kaLabel,
      color: row.color,
      vals: years.map((year) => {
        const value = row.valuesByYear[year] ?? null;
        const total = model.totalRow.valuesByYear[year] ?? null;
        return !state.share ? value : value === null || !total ? null : (value / total) * 100;
      }),
      planned: years.map(() => false),
    }));

  const noSelection = state.selectedIds.length === 0;
  const [seriesQuery, setSeriesQuery] = useState("");
  const visibleRows = useMemo(() => {
    const needle = seriesQuery.trim();
    const functions = needle === "" ? model.rows : model.rows.filter((row) => row.kaLabel.includes(needle));
    return [model.totalRow, ...functions];
  }, [model.rows, model.totalRow, seriesQuery]);
  const normalizedSeriesQuery = seriesQuery.trim().toLowerCase();
  const hasVisibleMatches =
    normalizedSeriesQuery === "" ||
    model.totalRow.kaLabel.toLowerCase().includes(normalizedSeriesQuery) ||
    visibleRows.length > 1;
  const allSelected = selectableRows.every((row) => state.selectedIds.includes(row.itemId));
  const hasSelection = state.selectedIds.length > 0;

  function toggleAll() {
    state.setSelectedIds(hasSelection ? [] : selectableRows.map((row) => row.itemId));
  }

  function downloadCsv() {
    const csv = buildExplorerCsv([...model.rows, model.totalRow], years);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geodata-${props.csvBasename}-${state.range.start}-${state.range.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerOpen(true);
      }
    }

    window.addEventListener("keydown", onKey);
    document.body.dataset.appReady = "true";

    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.body.dataset.appReady;
    };
  }, []);

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
              className="group cursor-pointer border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] font-[family-name:var(--font-display)] text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]"
            >
              {props.triggerLabel}
              <span
                data-testid="entity-picker-caret"
                aria-hidden
                className="ml-1 inline-block align-middle text-[0.35em] text-[var(--control)] transition-colors duration-100 group-hover:text-[var(--accent)]"
              >
                {pickerOpen ? "▴" : "▾"}
              </span>
            </button>
          </h1>
          <EntityPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            groups={props.pickerGroups}
            activeId={props.entityId}
            onSelectMunicipality={(code) => router.push(`/explorer/municipalities/${code}`)}
            onSelectRegion={(regionId) => router.push(`/explorer/municipalities/region/${regionId.replace("region.", "")}`)}
          />
          <div className="text-[12.5px] text-[var(--muted)]">{props.metaLine}</div>
        </div>
        <span className="grid w-full min-w-0 grid-cols-2 items-center gap-4 min-[768px]:flex min-[768px]:w-auto min-[768px]:max-w-[40%] min-[768px]:shrink">
          <a href={props.prev.href} className="block min-w-0 truncate font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            ← {props.prev.label}
          </a>
          <a href={props.next.href} className="block min-w-0 truncate text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            {props.next.label} →
          </a>
        </span>
      </div>

      <div
        data-testid="municipal-workspace"
        className="mt-7 grid items-start gap-10 border-t border-[var(--ink)] pt-5 @min-[1100px]:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="min-w-0">
          <div className="mb-[18px] flex items-center justify-between gap-5">
            <span className="flex items-baseline gap-4">
              <SegmentedTabs<ChartMode>
                ariaLabel="ხედის რეჟიმი"
                value={state.chartMode}
                onChange={state.setChartMode}
                options={[
                  { value: "line", label: "ხაზი", testId: "municipal-mode-line" },
                  { value: "table", label: "ცხრილი", testId: "municipal-mode-table" },
                ]}
              />
              <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                {state.share ? "წილი მთლიან ბიუჯეტში, %" : "მთლიანი ბიუჯეტი · მლნ ₾"}
              </span>
            </span>
            <button
              type="button"
              data-testid="municipal-share-toggle"
              aria-pressed={state.share}
              onClick={() => state.setShare(!state.share)}
              className={`inline-flex h-[27px] cursor-pointer items-center rounded-full border px-3 text-[11.5px] ${
                state.share
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                  : "border-[var(--control)] text-[var(--muted)]"
              }`}
            >
              % წილი
            </button>
          </div>

          {state.chartMode === "line" && noSelection ? (
            <div className="mt-5">
              <Callout testId="no-selection-callout">არც ერთი სერია არ არის არჩეული. აირჩიე სერია პანელიდან „სერიები“.</Callout>
            </div>
          ) : state.chartMode === "line" ? (
            <EditorialLineChart years={years} series={series} share={state.share} unit={UNIT_MLN} />
          ) : (
            <ExplorerTable
              rows={model.rows.filter((row) => state.selectedIds.includes(row.itemId))}
              totalRow={model.totalRow}
              showTotal={state.selectedIds.includes(model.totalRow.itemId)}
              years={years}
              firstColumnLabel="ფუნქცია"
              unit={UNIT_MLN}
              share={state.share}
            />
          )}

          {/* allYears, never model.years — the strip must offer the full span
              even when the selection has narrowed it. */}
          <div className="mt-6 border-t border-[var(--hairline-soft)] pt-4">
            <RangeStrip years={allYears} range={state.range} onChange={state.setRange} />
          </div>

          <div className="mt-5 max-w-[640px]">
            <SourceNote testId="municipal-source-note">{props.sourceNote}</SourceNote>
            <Link
              data-testid="compact-methodology-link"
              href={props.methodologyHref}
              className="mt-2 inline-block text-[12px] font-medium text-[var(--accent)] underline underline-offset-4 hover:text-[var(--ink)]"
            >
              მეთოდოლოგია და პირველწყაროები →
            </Link>
          </div>

          {props.children}

          {/* All three derive from the RANGE model, so they move together with
              the chart instead of describing a span the user is not looking at. */}
          <MunicipalIndicators
            kpis={buildEntityKpis({
              model,
              nationalTotalByYear: props.nationalTotalByYear,
              rankByYear: props.rankByYear,
              rankOutOf: props.rankOutOf,
            })}
            movers={buildMovers(model)}
            comparison={buildComparisonRows(model)}
            startYear={state.range.start}
            endYear={state.range.end}
          />
        </div>

        <aside className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]">
          <div className="sticky top-5">
            <SeriesSelector
              query={seriesQuery}
              onQueryChange={setSeriesQuery}
              searchPlaceholder="ძებნა"
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
                  label={row.kaLabel}
                  color={row.color}
                  value={formatAmount(row.valuesByYear[state.range.end] ?? null)}
                  selected={state.selectedIds.includes(row.itemId)}
                  level={row.itemId === model.totalRow.itemId ? "total" : "category"}
                  onToggle={() => state.toggleSeries(row.itemId)}
                />
              ))}
            </SeriesSelector>
            <button
              type="button"
              data-testid="municipal-csv"
              onClick={downloadCsv}
              className="mt-4 flex h-[38px] w-full cursor-pointer items-center justify-center rounded-[2px] bg-[var(--ink)] text-[12.5px] font-semibold text-[var(--paper)] hover:opacity-85"
            >
              CSV ჩამოტვირთვა
            </button>

            <Link
              href="/explorer/municipalities"
              className="mt-3.5 block text-[12px] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
            >
              ← ყველა მუნიციპალიტეტი
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
