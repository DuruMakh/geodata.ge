"use client";

import { coverageLabel } from "../../lib/explorer/coverageLabel";
import Link from "next/link";
import { useMemo, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import type { ClientBasketWeightRow } from "../../lib/servedRows";
import { unpackFacts, type FactsInput } from "../../lib/data/packedFacts";
import { updatedDate } from "../../lib/explorer/coverageLabel";

import { periodLabel, monthlyChartPeriod, PCT_UNIT } from "../../lib/explorer/inflationLabels";
import {
  CATEGORY_TABS,
  DIVISION_IDS,
  RESIDUAL_ID,
  buildCategoryIndex,
  buildCategoryLines,
  buildStackModel,
  categoryCoverage,
  categoryTabLoaded,
  changeCategoryTab,
  parseCategoryHash,
  unpackCategoryFacts,
  rangeFromPatch,
  resolveCategoryRange,
  serializeCategoryHash,
  toggleCategory,
  toggleExpanded,
  type CategoryIndex,
  type CategoryState,
  type PackedCategorySeries,
  type CategoryTab,
} from "../../lib/explorer/inflationCategories";
import { categoryColor, categoryLabel, formatContribution } from "../../lib/explorer/inflationCategoryLabels";
import { buildInflationCategoryWorkbookExportModel } from "../../lib/explorer/inflationCategoryWorkbook";
import type { InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { RangeStrip } from "../main-explorer/range-strip";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { InflationCategoryIndicators } from "./inflation-category-indicators";
import { InflationCategoryPanel } from "./inflation-category-panel";
import { InflationCategoryTable } from "./inflation-category-table";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { latestEntry } from "../../lib/explorer/latestValue";
import { formatInflationValue } from "../../lib/explorer/inflationLabels";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { PageDataStatus } from "../explorer-shell/page-data-status";
import { useHashState } from "../explorer-shell/use-hash-state";
import { usePageData } from "../explorer-shell/use-page-data";
import { topicSection } from "../../lib/navigation/navTree";

// Inflation categories (spec §6): the overview's layout, with a stacked column
// chart on the contribution tab where the parts visibly re-add to the published
// headline. Under the H1 the published national headline's latest month on the
// active rate (owner decision D2, 2026-10-07), the only line there; the unit sits
// with the source note (DESIGN §17).


// A restored hash keeps its range only where the tab has data. While the monthly runs load, the
// range waits as written; the hash is parsed again when they arrive (useHashState re-reads it).
function parseCategoriesHash(hash: string, index: CategoryIndex): CategoryState {
  const parsed = parseCategoryHash(hash);
  return categoryTabLoaded(index, parsed.tab) ? changeCategoryTab(parsed, parsed.tab, index) : parsed;
}

export type InflationCategoriesProps = {
  /** Packed on the server: 27,668 rows cross the wire, so they travel as dense runs. Annual changes only. */
  facts: PackedCategorySeries[];
  /** The monthly-change runs (lib/pages/inflationPageData.ts), fetched only when the monthly tab opens (U13-03). */
  monthlyUrl: string;
  weights: FactsInput<ClientBasketWeightRow>;
  headline: Array<{ period: number; value: number }>;
  /** The national monthly change, for the latest-value line on the monthly tab only. */
  headlineMom: Array<{ period: number; value: number }>;
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationCategories({ facts, monthlyUrl, weights, headline, headlineMom, lastReviewedAt, sources, siteOrigin }: InflationCategoriesProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const [monthlyWanted, setMonthlyWanted] = useState(false);
  const monthly = usePageData<PackedCategorySeries[]>(monthlyUrl, monthlyWanted);
  const index = useMemo(
    () => buildCategoryIndex(unpackCategoryFacts(monthly.status === "ready" ? [...facts, ...monthly.data] : facts), unpackFacts(weights)),
    [facts, monthly, weights],
  );
  const headlineByPeriod = useMemo(() => new Map(headline.map((row) => [row.period, row.value])), [headline]);
  const { state, update } = useHashState(index, parseCategoriesHash, serializeCategoryHash);
  const [announcement, setAnnouncement] = useState("");
  if (state.tab === "mom" && !monthlyWanted) setMonthlyWanted(true);

  // Until the monthly runs arrive, the monthly tab shows their loading (or failure) status in place of the
  // chart, and the rest of the page reads the annual tab, whose data is here.
  const pending = !categoryTabLoaded(index, state.tab);
  const view: CategoryState = pending ? { ...state, tab: "yoy" } : state;
  const range = resolveCategoryRange(view, index);
  const tabPeriods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  const coverage = categoryCoverage(index, view.tab);

  const displayDate = updatedDate(lastReviewedAt, locale);

  const stack = buildStackModel(index, view, range, headlineByPeriod);
  const lines = buildCategoryLines(index, view, range);
  const hasSeries = !pending && (state.tab === "contrib" ? stack.segments.length > 0 : lines.lines.length > 0);

  // The contribution tab decomposes the annual rate, so it states the annual headline.
  const latestTab = state.tab === "mom" ? "mom" : "yoy";
  const latest = latestEntry(new Map((latestTab === "mom" ? headlineMom : headline).map((row) => [row.period, row.value])));

  // The latest-value line above states the headline; the unit line does not repeat it at another precision (U13-14).
  const unitLine = t(`categoryUnit.${state.tab}`);

  function selectTab(tab: CategoryTab) {
    if (!categoryTabLoaded(index, tab)) {
      update((current) => ({ ...current, tab }));
      return;
    }
    const next = changeCategoryTab(state, tab, index);
    const nextRange = resolveCategoryRange(next, index);
    update(() => next);
    setAnnouncement(
      t("rangeChanged", {
        start: periodLabel(messages, nextRange.start, "short"),
        end: periodLabel(messages, nextRange.end, "short"),
      }),
    );
  }

  const chartSeries: ChartSeries[] = lines.lines.map((line) => ({
    id: line.key,
    label: categoryLabel(messages, line.key),
    color: categoryColor(line.key),
    vals: line.values,
  }));

  return (
    <ExplorerPage testId="inflation-categories">
      <PageHeader
        locale={locale}
        messages={messages}
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.inflation"), href: pageHref(topicSection("inflation").href, locale) },
          { label: t("categoriesHeading") },
        ]}
        coverage={coverageLabel(messages, locale, periodLabel(messages, coverage.min, "short"), periodLabel(messages, coverage.max, "short"), lastReviewedAt)}
      />
      <ExplorerHeading>{t("categoriesHeading")}</ExplorerHeading>
      {latest ? (
        <LatestValueLine testId="inflation-category-latest" measure={t(`categoryTab.${latestTab}`)} period={periodLabel(messages, latest.period, "long")} value={formatInflationValue(latest.value, latestTab)} />
      ) : null}

      <div
        data-testid="inflation-category-tabs"
        role="group"
        aria-label={t("tabs")}
        className="mb-3 py-2"
      >
        <div className="flex flex-wrap justify-center gap-x-7 gap-y-3 px-1">
          {CATEGORY_TABS.map((tab) => (
            <TextTab
              key={tab}
              testId={`inflation-category-tab-${tab}`}
              label={t(`categoryTab.${tab}`)}
              active={state.tab === tab}
              onClick={() => selectTab(tab)}
            />
          ))}
        </div>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section
            data-testid="chart-panel"
            data-mode={state.mode}
            data-tab={state.tab}
            className="border-t border-[var(--ink)] pt-3"
          >
            <SegmentedTabs<CategoryState["mode"]>
              ariaLabel={message(messages, "controls.viewMode")}
              value={state.mode}
              onChange={(mode) => update((current) => ({ ...current, mode }))}
              options={[
                {
                  value: "chart",
                  label: state.tab === "contrib" ? t("chartMode.columns") : message(messages, "controls.chart"),
                  testId: "chart-mode-chart",
                },
                { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
              ]}
            />
            {pending ? (
              <PageDataStatus status={monthly.status === "error" ? "error" : "loading"} />
            ) : !hasSeries ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
              </div>
            ) : state.mode === "table" ? (
              <InflationCategoryTable
                index={index}
                state={state}
                range={range}
                onTableSeriesChange={(categoryId) => update((current) => ({ ...current, tableSeries: categoryId }))}
              />
            ) : state.tab === "contrib" ? (
              <div className="mt-5">
                <StackedColumnChart
                  periods={stack.periods}
                  periodsPerYear={12}
                  segments={[
                    ...stack.segments.map((segment) => ({
                      id: segment.categoryId,
                      label: categoryLabel(messages, segment.categoryId),
                      color: categoryColor(segment.categoryId),
                      values: segment.values,
                    })),
                    {
                      id: RESIDUAL_ID,
                      label: t("categoryResidual"),
                      color: categoryColor(RESIDUAL_ID),
                      values: stack.residual,
                    },
                  ]}
                  overlay={{ label: t("categoryHeadline"), values: stack.headline }}
                  formatPeriod={(period) =>
                    periodMonth(period) === 1 ? String(periodYear(period)) : periodLabel(messages, period, "short")
                  }
                  formatValue={(value) => `${formatContribution(value)} ${t("pp")}`}
                  ariaLabel={t("categoryTab.contrib")}
                />
              </div>
            ) : (
              <div className="mt-5">
                <EditorialLineChart
                  years={lines.periods}
                  series={chartSeries}
                  share
                  unit={PCT_UNIT}
                  shareLabel={t(`categoryTab.${state.tab}`)}
                  periodsPerYear={12}
                  formatPeriod={(period, kind) => monthlyChartPeriod(messages, period, kind)}
                />
              </div>
            )}
            {pending ? null : <>
              <ChartSelectionAids series={chartSeries} chartShown={state.mode === "chart"} share unit={PCT_UNIT} legendCap={DIVISION_IDS.length} formatValue={state.tab === "contrib" ? (value) => `${formatContribution(value)} ${t("pp")}` : undefined} />
              <RangeStrip
                years={tabPeriods}
                range={range}
                periodsPerYear={12}
                formatPeriod={(period) => periodLabel(messages, period, "short")}
                formatMonth={(month) => message(messages, `inflation.monthShort.${month}`)}
                onChange={(patch) => update((current) => ({ ...current, range: rangeFromPatch(range, patch) }))}
              />
            </>}
          </section>
          <div className="mt-[18px] space-y-2">
            <SourceNote testId="source-label">
              {/* The unit sits with the source, not as a second line under the heading (DESIGN §17). */}
              <span data-testid="inflation-category-unit">{unitLine}</span>
              {" · "}
              {t("categorySource")} {message(messages, "main.lastUpdated", { date: displayDate })}
            </SourceNote>
            {state.tab === "contrib" ? (
              <p data-testid="inflation-derived-note" className="text-xs text-[var(--muted)]">
                {t("categoryContributionNote")}
              </p>
            ) : null}
            <Link
              href={pageHref("/methodology/inflation", locale)}
              prefetch={false}
              className="inline-flex min-h-11 items-center text-xs text-[var(--muted)] underline underline-offset-4"
            >
              {t("methodology")}
            </Link>
          </div>
        </div>

        <InflationCategoryPanel
          index={index}
          state={view}
          range={range}
          onToggle={(categoryId) => update((current) => toggleCategory(current, categoryId, index))}
          onToggleExpanded={(categoryId) => update((current) => toggleExpanded(current, categoryId))}
          onToggleAll={() =>
            // Clearing 55 rows was a one-way door: the selector hides the bulk
            // button when nothing is selected, and the hash keeps it empty.
            update((current) => ({
              ...current,
              selected: current.selected.length > 0 ? [] : DIVISION_IDS.filter((id) => index.order.includes(id)),
            }))
          }
          downloadAction={
            <ExcelDownloadButton
              testId="inflation-category-download"
              disabled={!hasSeries}
              onDownload={() =>
                downloadWorkbook(
                  buildInflationCategoryWorkbookExportModel({
                    index,
                    state,
                    range,
                    headline: headlineByPeriod,
                    presentation,
                    sources,
                    siteOrigin,
                  }),
                )
              }
            />
          }
        />
      </ExplorerWorkspace>

      <InflationCategoryIndicators index={index} />
    </ExplorerPage>
  );
}
