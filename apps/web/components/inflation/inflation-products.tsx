"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { makePeriod, periodMonth, periodYear } from "../../lib/data/inflation/periods";
import { formatDisplayDate } from "../../lib/explorer/format";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { buildProductIndex, productAnnual, productColor, productCumulative, type ClientProduct, type PackedProductSeries } from "../../lib/explorer/inflationProducts";
import { parseProductHash, serializeProductHash, toggleProduct, type ProductState } from "../../lib/explorer/inflationProductState";
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
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
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
  facts: PackedProductSeries[];
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationProducts({ products, facts, lastReviewedAt, sources, siteOrigin }: InflationProductsProps) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(() => buildProductIndex(products, facts), [products, facts]);
  const [state, setState] = useState<ProductState>(() => parseProductHash("", index));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The static server render is the stable default; restore a shared URL after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(parseProductHash(window.location.hash, index));
    setReady(true);
  }, [index]);
  useAppReady();
  useReplaceHash(serializeProductHash(state), ready);

  const minYear = index.earliestYear;
  const maxYear = periodYear(index.latestPeriod);
  const range = { min: minYear, max: maxYear, start: state.range.startYear, end: state.range.endYear };
  const endPeriod = Math.min(makePeriod(state.range.endYear, 12), index.latestPeriod);
  const periods = Array.from({ length: endPeriod - makePeriod(state.range.startYear, 1) + 1 },
    (_, offset) => makePeriod(state.range.startYear, 1) + offset);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, offset) => minYear + offset);
  const chartSeries: ChartSeries[] = state.selected.flatMap((id) => {
    const item = index.productById.get(id);
    if (!item) return [];
    if (state.indicator === "cumulative" && productCumulative(index, id, state.range.startYear, endPeriod).value === null) return [];
    const vals = periods.map((period) => state.indicator === "annual" ?
      productAnnual(index, id, period) : productCumulative(index, id, state.range.startYear, period).value);
    return [{ id, label: locale === "ka" ? item.labelKa : item.labelEn, color: productColor(id), vals,
      planned: vals.map(() => false) }];
  });
  const hasValues = chartSeries.some((series) => series.vals.some((value) => value !== null));
  const toggleAction = state.indicator === "annual" ? t("productsShowCumulative") : t("productsShowAnnual");
  const displayDate = locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt;

  return <ExplorerPage testId="inflation-products">
    <PageHeader
      crumbs={[
        { label: message(messages, "common.home"), href: pageHref("/", locale) },
        { label: message(messages, "common.data") },
        { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
        { label: t("productsHeading") },
      ]}
      coverage={`${minYear} – ${periodLabel(messages, index.latestPeriod, "short")} · ${message(messages, "main.updated", { date: displayDate })}`}
    />
    <ExplorerHeading>{t("productsHeading")}</ExplorerHeading>
    <p className="mb-4 text-[13px] text-[var(--muted)]">{t("productsUnit")}</p>

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
                onClick={() => setState((current) => ({ ...current, indicator: current.indicator === "annual" ? "cumulative" : "annual" }))}
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
          <RangeStrip
            years={years}
            range={range}
            onChange={(patch) => setState((current) => ({ ...current, range: {
              startYear: patch.start ?? current.range.startYear,
              endYear: patch.end ?? current.range.endYear,
            } }))}
          />
        </section>
        <div className="mt-[18px] space-y-2">
          <SourceNote testId="source-label">{t("productsSource")} {message(messages, "main.lastUpdated", { date: displayDate })}</SourceNote>
          {state.indicator === "cumulative" ? <p className="text-xs text-[var(--muted)]">{t("productsDerivedNote")}</p> : null}
          <Link href={pageHref("/methodology/inflation", locale)} className="text-xs text-[var(--muted)] underline underline-offset-4">
            {t("methodology")}
          </Link>
        </div>
      </div>
      <InflationProductPanel
        index={index}
        state={state}
        onToggle={(id) => setState((current) => toggleProduct(current, id))}
        onClear={() => setState((current) => ({ ...current, selected: [] }))}
        downloadAction={<ExcelDownloadButton
          testId="inflation-product-download"
          disabled={false}
          onDownload={() => downloadWorkbook(buildInflationProductWorkbookExportModel({ index, state, presentation, sources, siteOrigin }))}
        />}
      />
    </ExplorerWorkspace>
    <InflationProductIndicators index={index} state={state} />
    <InflationProductTable index={index} state={state} onToggle={(id) => setState((current) => toggleProduct(current, id))} />
  </ExplorerPage>;
}
