"use client";

import { coverageLabel } from "../../lib/explorer/coverageLabel";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useCallback, useMemo } from "react";
import { makePeriod, periodKey, periodMonth, periodYear } from "../../lib/data/inflation/periods";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { buildProductIndex, productAnnual, productColor, productCumulative, type ClientProduct, type PackedProductSeries, type ProductIndex } from "../../lib/explorer/inflationProducts";
import { parseProductHash, serializeProductHash, toggleProduct } from "../../lib/explorer/inflationProductState";
import { buildInflationProductWorkbookExportModel } from "../../lib/explorer/inflationProductWorkbook";
import type { InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { PageDataStatus } from "../explorer-shell/page-data-status";
import { useHashState } from "../explorer-shell/use-hash-state";
import { usePageData } from "../explorer-shell/use-page-data";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { ControlTooltip } from "../ui/control-tooltip";
import { Callout, SourceNote } from "../ui/editorial";
import { InflationProductPanel } from "./inflation-product-panel";
import { InflationProductIndicators } from "./inflation-product-indicators";
import { InflationProductTable } from "./inflation-product-table";

const PCT_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationProductsProps = {
  products: ClientProduct[];
  /** The packed index runs (lib/pages/inflationPageData.ts), fetched after load rather than carried in the HTML (U14-01). */
  dataUrl: string;
  /** The months the runs cover, so the header states them before the runs arrive. */
  coverage: { earliestYear: number; latestPeriod: number };
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationProducts({ products, dataUrl, coverage, lastReviewedAt, sources, siteOrigin }: InflationProductsProps) {
  const { locale, messages } = useI18n();
  const t = (key: string) => message(messages, `inflation.${key}`);
  const runs = usePageData<PackedProductSeries[]>(dataUrl);
  const index = useMemo(() => runs.status === "ready" ? buildProductIndex(products, runs.data) : null, [products, runs]);

  return <ExplorerPage testId="inflation-products">
    <PageHeader
      locale={locale}
      messages={messages}
      crumbs={[
        { label: message(messages, "common.home"), href: pageHref("/", locale) },
        { label: message(messages, "common.data") },
        { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
        { label: t("productsHeading") },
      ]}
      coverage={coverageLabel(messages, locale, coverage.earliestYear, periodLabel(messages, coverage.latestPeriod, "short"), lastReviewedAt)}
    />
    <ExplorerHeading>{t("productsHeading")}</ExplorerHeading>
    <p className="mb-4 text-[13px] text-[var(--muted)]">{t("productsUnit")}</p>
    {index ? <ProductExplorer index={index} lastReviewedAt={lastReviewedAt} sources={sources} siteOrigin={siteOrigin} /> :
      <PageDataStatus status={runs.status === "error" ? "error" : "loading"} />}
  </ExplorerPage>;
}

export function ProductExplorer({ index, lastReviewedAt, sources, siteOrigin }: {
  index: ProductIndex;
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `inflation.${key}`, values);
  const { state, update } = useHashState(index, parseProductHash, serializeProductHash);
  // Stable, so a click re-renders only the selector rows whose selection changed.
  const toggle = useCallback((id: string) => update((current) => toggleProduct(current, id)), [update]);

  const minYear = index.earliestYear;
  const maxYear = periodYear(index.latestPeriod);
  const range = { min: minYear, max: maxYear, start: state.range.startYear, end: state.range.endYear };
  const endPeriod = Math.min(makePeriod(state.range.endYear, 12), index.latestPeriod);
  const periods = Array.from({ length: endPeriod - makePeriod(state.range.startYear, 1) + 1 },
    (_, offset) => makePeriod(state.range.startYear, 1) + offset);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, offset) => minYear + offset);
  const omitted = state.indicator === "cumulative" ? state.selected.flatMap((id) => {
    const product = index.productById.get(id);
    if (!product) return [];
    const cumulative = productCumulative(index, id, state.range.startYear, endPeriod);
    if (cumulative.value !== null) return [];
    const reason = cumulative.reason === "late_start" ? t("productsLateStart", { period: product.firstPeriod }) :
      cumulative.missingPeriod !== null ? t("productsMissingMonth", { period: periodKey(cumulative.missingPeriod) }) :
        t("productsUnavailable");
    return [{ id, label: locale === "ka" ? product.labelKa : product.labelEn, reason }];
  }) : [];
  const omittedIds = new Set(omitted.map((item) => item.id));
  const chartSeries: ChartSeries[] = state.selected.flatMap((id) => {
    const item = index.productById.get(id);
    if (!item) return [];
    if (omittedIds.has(id)) return [];
    const vals = periods.map((period) => state.indicator === "annual" ?
      productAnnual(index, id, period) : productCumulative(index, id, state.range.startYear, period).value);
    return [{ id, label: locale === "ka" ? item.labelKa : item.labelEn, color: productColor(id), vals,
      planned: vals.map(() => false) }];
  });
  const hasValues = chartSeries.some((series) => series.vals.some((value) => value !== null));
  const toggleAction = state.indicator === "annual" ? t("productsShowCumulative") : t("productsShowAnnual");
  const displayDate = updatedDate(lastReviewedAt, locale);

  return <>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-indicator={state.indicator} className="border-t border-[var(--ink)] pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-[var(--ink)]">
                {state.indicator === "annual" ? t("productsAnnualTitle") : t("productsCumulativeTitle")}
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">{state.indicator === "annual" ? t("productsAnnualUnit") : t("productsCumulativeUnit")}</p>
            </div>
            <ControlTooltip label={toggleAction}>
              <button
                type="button"
                data-testid="product-cumulative-toggle"
                aria-label={toggleAction}
                aria-pressed={state.indicator === "cumulative"}
                onClick={() => update((current) => ({ ...current, indicator: current.indicator === "annual" ? "cumulative" : "annual" }))}
                className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-[var(--control)] transition-[background-color,color] duration-150 ${state.indicator === "cumulative" ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-transparent text-[var(--ink)] hover:bg-[var(--tint)]"}`}
              >
                <TrendingUp size={18} aria-hidden="true" strokeWidth={1.75} />
              </button>
            </ControlTooltip>
          </div>
          <p className="sr-only" data-testid="product-chart-summary">
            {t("productsChartSummary", { mode: state.indicator === "annual" ? t("productsAnnualTitle") : t("productsCumulativeTitle"),
              start: state.range.startYear, end: periodLabel(messages, endPeriod, "long"), count: chartSeries.length })}
          </p>
          {hasValues ? <div className="mt-5">
            <EditorialLineChart
              years={periods}
              series={chartSeries}
              share
              unit={PCT_UNIT}
              shareLabel={state.indicator === "annual" ? t("productsAnnualTitle") : t("productsCumulativeTitle")}
              periodsPerYear={12}
              formatPeriod={(period, kind) => kind === "axis" && periodMonth(period) === 1 ? String(periodYear(period)) :
                periodLabel(messages, period, kind === "axis" ? "short" : "long")}
            />
          </div> : <div className="mt-5"><Callout testId="no-selection-callout">
            {state.selected.length === 0 ? message(messages, "main.noSelection") : t("productsNoCompleteSeries")}
          </Callout></div>}
          <ChartSelectionAids series={chartSeries} chartShown share unit={PCT_UNIT} />
          {omitted.length > 0 ? <div data-testid="product-chart-omissions" className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-[11px] leading-relaxed text-[var(--muted)]">
            <p className="font-semibold text-[var(--ink)]">{t("productsChartOmitted")}</p>
            <ul className="mt-1 list-disc pl-4">
              {omitted.map((item) => <li key={item.id}>{item.label} — {item.reason}</li>)}
            </ul>
          </div> : null}
          <RangeStrip
            years={years}
            range={range}
            onChange={(patch) => update((current) => ({ ...current, range: {
              startYear: patch.start ?? current.range.startYear,
              endYear: patch.end ?? current.range.endYear,
            } }))}
          />
        </section>
        <div className="mt-[18px] space-y-2">
          <SourceNote testId="source-label">{t("productsSource")} {message(messages, "main.lastUpdated", { date: displayDate })}</SourceNote>
          <p className="text-xs text-[var(--muted)]">{t("productsDerivedNote")}</p>
          <Link href={pageHref("/methodology/inflation", locale)} prefetch={false} className="inline-flex min-h-11 items-center text-xs text-[var(--muted)] underline underline-offset-4">
            {t("methodology")}
          </Link>
        </div>
      </div>
      <InflationProductPanel
        index={index}
        state={state}
        onToggle={toggle}
        onClear={() => update((current) => ({ ...current, selected: [] }))}
        downloadAction={<ExcelDownloadButton
          testId="inflation-product-download"
          disabled={false}
          onDownload={() => downloadWorkbook(buildInflationProductWorkbookExportModel({ index, state, presentation, sources, siteOrigin }))}
        />}
      />
    </ExplorerWorkspace>
    <InflationProductIndicators index={index} state={state} />
    <InflationProductTable index={index} state={state} onToggle={toggle} />
  </>;
}
