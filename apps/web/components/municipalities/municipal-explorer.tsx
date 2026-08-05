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
import { Callout, SegmentedTabs, SourceNote, SwatchBar } from "../ui/editorial";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { EntityPicker, type EntityPickerGroup } from "./entity-picker";
import { MunicipalIndicators } from "./municipal-indicators";
import { useMunicipalState } from "./use-municipal-state";

const WARNING_TEXT: Record<string, string> = {
  source_version_difference: "ოფიციალური ჯამი და ფუნქციური კლასიფიკაციის ჯამი წყაროს სხვადასხვა ვერსიიდან მოდის",
  financing_outside_functional: "ოფიციალური ჯამი მოიცავს დაფინანსების ოპერაციებს, რომლებიც ფუნქციურ კლასიფიკაციაში არ ნაწილდება",
  reconciliation_review_required: "სხვაობა დამატებით გადამოწმებას საჭიროებს",
};

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

  nationalTotalLatest: number;
  rank: number;
  rankOutOf: number;
  showWarnings: boolean;
  csvBasename: string;
  pickerGroups: EntityPickerGroup[];
  prev: { label: string; href: string };
  next: { label: string; href: string };
  sourceNote: string;
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

  const knownIds = useMemo(() => new Set(fullModel.rows.map((row) => row.itemId)), [fullModel]);
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
  const totalsByYear = new Map(years.map((year) => [year, model.totalRow.valuesByYear[year] ?? null]));

  const series: ChartSeries[] = model.rows
    .filter((row) => state.selectedIds.includes(row.itemId))
    .map((row) => ({
      id: row.itemId,
      label: row.kaLabel,
      color: row.color,
      vals: years.map((year) => {
        const value = row.valuesByYear[year] ?? null;
        if (!state.share) return value;
        const total = totalsByYear.get(year);
        return value === null || !total ? null : (value / total) * 100;
      }),
      planned: years.map(() => false),
    }));

  const visibleWarnings = props.showWarnings ? model.warnings : [];

  const [seriesQuery, setSeriesQuery] = useState("");
  const visibleRows = useMemo(() => {
    const needle = seriesQuery.trim();
    return needle === "" ? model.rows : model.rows.filter((row) => row.kaLabel.includes(needle));
  }, [model.rows, seriesQuery]);
  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => state.selectedIds.includes(row.itemId));

  function toggleAll() {
    // Selecting every function would exceed the chart cap, so select-all is a
    // table-mode affordance: in line mode it clears instead of overfilling.
    if (allSelected || state.chartMode === "line") {
      state.setSelectedIds([]);
      return;
    }
    state.setSelectedIds(visibleRows.map((row) => row.itemId));
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
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mt-[22px] flex items-baseline justify-between gap-5">
        <div className="min-w-0">
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
              className="cursor-pointer border-b-2 border-[var(--accent)] font-[family-name:var(--font-display)] text-inherit"
            >
              {props.triggerLabel}
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
        <span className="flex flex-none items-center gap-4">
          <a href={props.prev.href} className="font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            ← {props.prev.label}
          </a>
          <a href={props.next.href} className="font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            {props.next.label} →
          </a>
        </span>
      </div>

      <div className="mt-7 grid items-start gap-10 border-t border-[var(--ink)] pt-5 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
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
                {state.share ? "წილი ჯამურ ხარჯებში, %" : "ათი ფუნქციის ჯამი · მლნ ₾"}
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

          {state.chartMode === "line" ? (
            <EditorialLineChart years={years} series={series} share={state.share} unit={UNIT_MLN} />
          ) : (
            <ExplorerTable
              rows={model.rows}
              totalRow={model.totalRow}
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

          {visibleWarnings.length > 0 ? (
            <div className="mt-5">
              <Callout testId="divergence-callout">
                {visibleWarnings.map((warning) => warning.year).join(", ")} — {WARNING_TEXT[visibleWarnings[0]!.type] ?? "ოფიციალური ჯამი და ფუნქციური ჯამი განსხვავდება"}
                {visibleWarnings[0]!.amountGel === null ? "" : ` (${formatAmount(Math.abs(visibleWarnings[0]!.amountGel))})`}.
              </Callout>
            </div>
          ) : null}

          <div className="mt-5 max-w-[640px]">
            <SourceNote testId="municipal-source-note">{props.sourceNote}</SourceNote>
          </div>

          {props.children}

          {/* All three derive from the RANGE model, so they move together with
              the chart instead of describing a span the user is not looking at. */}
          <MunicipalIndicators
            kpis={buildEntityKpis({
              model,
              nationalTotalLatest: props.nationalTotalLatest,
              rank: props.rank,
              rankOutOf: props.rankOutOf,
            })}
            movers={buildMovers(model)}
            comparison={buildComparisonRows(model)}
            startYear={state.range.start}
            endYear={state.range.end}
          />
        </div>

        <aside className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] min-[1100px]:border-t-0 min-[1100px]:border-l min-[1100px]:border-[var(--hairline)] min-[1100px]:pt-0 min-[1100px]:pl-[26px]">
          <div className="sticky top-5">
            <div className="flex items-baseline justify-between pb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">სერიები</span>
              <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                {state.selectedIds.length} / {model.rows.length}
              </span>
            </div>

            <input
              data-testid="municipal-series-search"
              value={seriesQuery}
              onChange={(event) => setSeriesQuery(event.target.value)}
              placeholder="ძებნა"
              aria-label="სერიების ძებნა"
              className="mb-2 h-[34px] w-full border-0 border-b border-[var(--control)] bg-transparent text-[13px] text-[var(--ink)] outline-none"
            />

            <button
              type="button"
              data-testid="municipal-series-all"
              aria-pressed={allSelected}
              onClick={toggleAll}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b-2 border-[var(--ink)] py-2 pr-1 pl-0.5 text-left"
            >
              <span
                aria-hidden
                className="inline-flex h-3.5 w-3.5 items-center justify-center border-[1.5px] text-[9px] leading-none text-[var(--paper)]"
                style={{
                  borderColor: allSelected ? "var(--ink)" : "var(--control)",
                  backgroundColor: allSelected ? "var(--ink)" : "transparent",
                }}
              >
                {allSelected ? "✓" : ""}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
                {allSelected || state.chartMode === "line" ? "გასუფთავება" : "ყველას მონიშვნა"}
              </span>
            </button>

            {visibleRows.map((row) => {
              const selected = state.selectedIds.includes(row.itemId);
              const latest = row.valuesByYear[state.range.end] ?? null;

              return (
                <button
                  key={row.itemId}
                  type="button"
                  data-testid="municipal-series-row"
                  aria-pressed={selected}
                  onClick={() => state.toggleSeries(row.itemId)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--row-border)] py-[7px] pr-1 text-left"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-3.5 w-3.5 items-center justify-center border-[1.5px] text-[9px] leading-none text-[var(--paper)]"
                    style={{
                      borderColor: selected ? row.color : "var(--control)",
                      backgroundColor: selected ? row.color : "transparent",
                    }}
                  >
                    {selected ? "✓" : ""}
                  </span>
                  <span className="flex min-w-0 items-center gap-[7px]">
                    <SwatchBar color={row.color} />
                    <span className="truncate text-[12px] font-medium">{row.kaLabel}</span>
                  </span>
                  <span className="font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap text-[var(--faint)]">
                    {formatAmount(latest)}
                  </span>
                </button>
              );
            })}
            {state.limitMessage ? (
              <div className="mt-3">
                <Callout testId="municipal-series-limit">{state.limitMessage}</Callout>
              </div>
            ) : null}

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
