"use client";

import { useEffect, useMemo } from "react";
import { buildDebtWorkbookExportModel } from "../../lib/explorer/debtWorkbook";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { buildDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { formatAmount, formatShare, unitFor, UNIT_BN } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type {
  DebtFamily,
  DebtSeriesId,
  ServedGovernmentDebtFact,
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
  facts: ServedGovernmentDebtFact[];
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
  stock: "მთავრობის ვალი",
  service: "ვალის გადახდა",
  rate: "საპროცენტო განაკვეთი",
};

export function DebtExplorerSurface(props: DebtExplorerSurfaceProps) {
  const model = useMemo(() => buildDebtExplorerModel({
    facts: props.facts,
    gdpFacts: props.gdpFacts,
    family: props.family,
    selectedIds: props.selectedIds,
    range: props.range,
    shareOfGdp: props.shareOfGdp,
  }), [props.facts, props.gdpFacts, props.family, props.selectedIds, props.range, props.shareOfGdp]);
  const familyYears = useMemo(() => Array.from(new Set(
    props.facts.filter((fact) => fact.family === props.family).map((fact) => fact.year),
  )).sort((left, right) => left - right), [props.facts, props.family]);
  const unit = useMemo(() => unitFor(
    props.facts
      .filter((fact) => fact.family === props.family && fact.valueKind === "amount_gel" && fact.value !== null)
      .map((fact) => fact.value as number),
    UNIT_BN,
    1,
  ), [props.facts, props.family]);
  const isPercent = props.family === "rate" || (props.family === "stock" && props.shareOfGdp);
  const noSelection = props.selectedIds.length === 0;
  const pointsBySeriesYear = new Map(model.points.map((point) => [`${point.itemId}:${point.year}`, point]));
  const chartSeries: ChartSeries[] = model.selectedItems.map((item) => ({
    id: item.id,
    label: item.kaLabel,
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
  const totalValue = totalItemId
    ? props.facts.find((fact) => fact.seriesId === totalItemId && fact.year === props.range.end)?.value ?? null
    : null;
  const deckValue = totalValue === null
    ? "—"
    : props.family === "rate"
      ? formatShare(totalValue / 100)
      : props.family === "stock" && props.shareOfGdp
        ? formatShare(model.totalRow?.shareByYear?.[props.range.end] ?? null)
        : formatAmount(totalValue);
  const coverage = [
    familyYears.length > 0 ? `${familyYears[0]}–${familyYears.at(-1)}` : "",
    props.lastUpdatedAt ? `განახლდა ${props.lastUpdatedAt}` : "",
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
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "ვალი" },
          ]}
          coverage={coverage}
        />
        <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          რამდენია მთავრობის ვალი და როგორ ვიხდით მას
        </h1>
        <p className="mb-[30px] flex min-h-[18px] flex-wrap items-baseline gap-2 text-[13px] text-[var(--body)]">
          <span className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--ink)]">
            {props.range.end}: {FAMILY_LABEL[props.family]} · {deckValue}
          </span>
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
                  ariaLabel="ხედის რეჟიმი"
                  value={props.chartMode}
                  onChange={props.onChartModeChange}
                  options={[
                    { value: "line", label: "ხაზი", testId: "chart-mode-line" },
                    { value: "table", label: "ცხრილი", testId: "chart-mode-table" },
                  ]}
                />
                <div className="flex items-center gap-3.5">
                  <span data-testid="debt-measure-label" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                    {props.family === "rate" ? "%" : props.shareOfGdp ? "% მშპ-ში" : "მლრდ ₾"}
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
                      % მშპ-ში
                    </button>
                  ) : null}
                </div>
              </div>

              {noSelection ? (
                <div className="mt-5">
                  <Callout testId="no-selection-callout">არც ერთი სერია არ არის არჩეული. აირჩიე სერია პანელიდან „სერიები“.</Callout>
                </div>
              ) : props.chartMode === "table" ? (
                <ExplorerTable
                  caption={`${FAMILY_LABEL[props.family]}, ${props.range.start}–${props.range.end}`}
                  rows={model.tableRows.filter((row) => row.itemId !== totalItemId)}
                  totalRow={model.totalRow}
                  showTotal={Boolean(totalItemId && props.selectedIds.includes(totalItemId))}
                  years={model.years}
                  firstColumnLabel="სერია"
                  unit={unit}
                  share={isPercent}
                  showChangeColumn={false}
                  forecastYears={forecastYears}
                  forecastLabel="პროგნოზი"
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
                    shareLabel={props.family === "rate" ? "საპროცენტო განაკვეთი" : "წილი მშპ-ში"}
                  />
                </div>
              )}

              <RangeStrip
                years={familyYears}
                range={props.range}
                onChange={props.onRangeChange}
                marker={props.family === "service" && forecastBoundaryYear !== null
                  ? { year: forecastBoundaryYear, label: "პროგნოზი" }
                  : undefined}
              />
              {props.family === "service" ? (
                <p data-testid="debt-forecast-note" className="mt-3 max-w-[680px] text-xs leading-relaxed text-[var(--muted)]">
                  2026–2030 წლების პროგნოზი ეფუძნება 2025-12-31 მდგომარეობით არსებულ პორტფელს და არ წარმოადგენს მომავალი ბიუჯეტის სრულ პროგნოზს.
                </p>
              ) : null}
            </section>

            <div className="mt-[18px]">
              <SourceNote testId="source-label">
                მონაცემები: საქართველოს ფინანსთა სამინისტრო. ნაჩვენებია მთავრობის ვალი და არა უფრო ფართო საჯარო ან სახელმწიფო ვალი.
                {" "}შედარებისას გაითვალისწინეთ 2019 წლის საბიუჯეტო ორგანიზაციების აღრიცხვის ცვლილება და 2022 წლის საერთო მთავრობის სახელმწიფო საწარმოების საზღვრის ცვლილება.
                {props.family === "stock" ? " მშპ: საქსტატი, მიმდინარე ფასებში." : null}
                {props.family === "rate" ? " გამოუქვეყნებელი განაკვეთები დატოვებულია გამოტოვებად და არ არის ჩანაცვლებული ნულით." : null}
                {props.lastUpdatedAt ? (
                  <> ბოლო განახლება: <span className="font-[family-name:var(--font-numeric)]">{props.lastUpdatedAt}</span>.</>
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
                }))}
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
