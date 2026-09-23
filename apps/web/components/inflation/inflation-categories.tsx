"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import type { ClientBasketWeightRow } from "../../lib/servedRows";
import { formatDisplayDate } from "../../lib/explorer/format";

import { periodLabel } from "../../lib/explorer/inflationLabels";
import {
  CATEGORY_TABS,
  DEFAULT_CATEGORY_STATE,
  DIVISION_IDS,
  RESIDUAL_ID,
  buildCategoryIndex,
  buildCategoryLines,
  buildStackModel,
  categoryCoverage,
  changeCategoryTab,
  parseCategoryHash,
  unpackCategoryFacts,
  rangeFromPatch,
  resolveCategoryRange,
  serializeCategoryHash,
  toggleCategory,
  toggleExpanded,
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
import { useAppReady } from "../explorer-shell/use-app-ready";

// Inflation categories (spec §6): the overview's layout, with a stacked column
// chart on the contribution tab where the parts visibly re-add to the published
// headline. No headline value line under the H1 — DESIGN.md §25 carries the unit
// line alone on both overviews, and this page follows the same family.

const PCT_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationCategoriesProps = {
  /** Packed on the server: 27,668 rows cross the wire, so they travel as dense runs. */
  facts: PackedCategorySeries[];
  weights: ClientBasketWeightRow[];
  headline: Array<{ period: number; value: number }>;
  lastReviewedAt: string;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationCategories({ facts, weights, headline, lastReviewedAt, sources, siteOrigin }: InflationCategoriesProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(() => buildCategoryIndex(unpackCategoryFacts(facts), weights), [facts, weights]);
  const headlineByPeriod = useMemo(() => new Map(headline.map((row) => [row.period, row.value])), [headline]);
  const [state, setState] = useState<CategoryState>(DEFAULT_CATEGORY_STATE);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const parsed = parseCategoryHash(window.location.hash);
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(changeCategoryTab(parsed, parsed.tab, index));
    setReady(true);
  }, [index]);
  useAppReady();

  const serializedHash = serializeCategoryHash(state);
  const hashApplied = useRef(false);
  useEffect(() => {
    if (!ready) return;
    // Skip the run that applies the incoming hash: writing it back would stamp a
    // pristine URL with the default state (use-explorer-state.ts has the same rule).
    if (!hashApplied.current) {
      hashApplied.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${serializedHash}`);
    } catch {
      // History can be unavailable in some embedded contexts; the UI still works.
    }
  }, [serializedHash, ready]);

  const range = resolveCategoryRange(state, index);
  const tabPeriods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  const coverage = categoryCoverage(index, "mom");

  const displayDate = locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt;

  const stack = buildStackModel(index, state, range, headlineByPeriod);
  const lines = buildCategoryLines(index, state, range);
  const hasSeries = state.tab === "contrib" ? stack.segments.length > 0 : lines.lines.length > 0;

  // The unit line names the published headline the stack closes on.
  const latestHeadline = [...stack.headline].reverse().find((value) => value !== null) ?? null;
  const unitLine =
    state.tab === "contrib"
      ? // Two decimals, unrounded: displayedValue() would turn a published 5.65 into 5.70.
        t("categoryUnit.contrib", { headline: latestHeadline === null ? "—" : latestHeadline.toFixed(2) })
      : t(`categoryUnit.${state.tab}`);

  function selectTab(tab: CategoryTab) {
    const next = changeCategoryTab(state, tab, index);
    const nextRange = resolveCategoryRange(next, index);
    setState(next);
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
    planned: line.values.map(() => false),
  }));

  return (
    <ExplorerPage testId="inflation-categories">
      <PageHeader
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
          { label: t("categoriesHeading") },
        ]}
        coverage={`${periodLabel(messages, coverage.min, "short")} – ${periodLabel(messages, coverage.max, "short")} · ${message(messages, "main.updated", { date: displayDate })}`}
      />
      <ExplorerHeading>{t("categoriesHeading")}</ExplorerHeading>
      <p data-testid="inflation-category-unit" className="mb-4 text-[13px] text-[var(--muted)]">
        {unitLine}
      </p>

      <div
        data-testid="inflation-category-tabs"
        role="group"
        aria-label={t("tabs")}
        className="mb-3 overflow-x-auto py-2"
        onFocusCapture={(event) => event.target.scrollIntoView({ block: "nearest", inline: "nearest" })}
      >
        <div className="mx-auto flex w-max gap-7 px-1">
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
              onChange={(mode) => setState((current) => ({ ...current, mode }))}
              options={[
                {
                  value: "chart",
                  label: state.tab === "contrib" ? t("chartMode.columns") : message(messages, "controls.chart"),
                  testId: "chart-mode-chart",
                },
                { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
              ]}
            />
            {!hasSeries ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
              </div>
            ) : state.mode === "table" ? (
              <InflationCategoryTable
                index={index}
                state={state}
                range={range}
                onTableSeriesChange={(categoryId) => setState((current) => ({ ...current, tableSeries: categoryId }))}
              />
            ) : state.tab === "contrib" ? (
              <div className="mt-5">
                <StackedColumnChart
                  periods={stack.periods}
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
                  formatPeriod={(period, kind) =>
                    kind === "axis" && periodMonth(period) === 1
                      ? String(periodYear(period))
                      : periodLabel(messages, period, kind === "axis" ? "short" : "long")
                  }
                />
              </div>
            )}
            <RangeStrip
              years={tabPeriods}
              range={range}
              periodsPerYear={12}
              formatPeriod={(period) => periodLabel(messages, period, "short")}
              onChange={(patch) => setState((current) => ({ ...current, range: rangeFromPatch(range, patch) }))}
            />
          </section>
          <div className="mt-[18px] space-y-2">
            <SourceNote testId="source-label">
              {t("categorySource")} {message(messages, "main.lastUpdated", { date: displayDate })}
            </SourceNote>
            {state.tab === "contrib" ? (
              <p data-testid="inflation-derived-note" className="text-xs text-[var(--muted)]">
                {t("categoryContributionNote")}
              </p>
            ) : null}
            <Link
              href={pageHref("/methodology/inflation", locale)}
              className="text-xs text-[var(--muted)] underline underline-offset-4"
            >
              {t("methodology")}
            </Link>
          </div>
        </div>

        <InflationCategoryPanel
          index={index}
          state={state}
          range={range}
          onToggle={(categoryId) => setState((current) => toggleCategory(current, categoryId, index))}
          onToggleExpanded={(categoryId) => setState((current) => toggleExpanded(current, categoryId))}
          onToggleAll={() =>
            // Clearing 55 rows was a one-way door: the selector hides the bulk
            // button when nothing is selected, and the hash keeps it empty.
            setState((current) => ({
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
