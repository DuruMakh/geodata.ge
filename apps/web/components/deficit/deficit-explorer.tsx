"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ServedGeneralGovernmentBalanceFact } from "../../lib/servedRows";
import { buildDeficitExplorerModel, DEFICIT_ITEM } from "../../lib/explorer/deficitExplorer";
import { parseDeficitHash, serializeDeficitHash } from "../../lib/explorer/deficitUrlState";
import { buildDeficitWorkbookExportModel } from "../../lib/explorer/deficitWorkbook";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { pageHref } from "../../lib/i18n/routes";
import { publicLabel } from "../../lib/i18n/labels";
import { useI18n } from "../../lib/i18n/provider";
import { formatAmount, formatShare, unitFor, unitsFor, formatDisplayDate } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

type DeficitExplorerProps = {
  facts: ServedGeneralGovernmentBalanceFact[];
  workbookSources: WorkbookPublicSource[];
  edition: string;
  siteOrigin?: string;
  lastUpdatedAt: string;
};

export function DeficitExplorer({ facts, workbookSources, edition, siteOrigin, lastUpdatedAt }: DeficitExplorerProps) {
  const presentation = useI18n();
  const { locale, messages, englishLabels } = presentation;
  const years = useMemo(
    () => [...new Set(facts.map((fact) => fact.year))].sort((left, right) => left - right),
    [facts],
  );
  const min = years[0] ?? 0;
  const max = years.at(-1) ?? min;
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [percentage, setPercentage] = useState(true);
  const [selected, setSelected] = useState(true);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState({ start: min, end: max, min, max });
  const parsedRef = useRef(false);
  const writtenRef = useRef(false);
  const model = useMemo(
    () => buildDeficitExplorerModel({ facts, range, percentage, selected }, presentation),
    [facts, range, percentage, selected, presentation],
  );
  const forecastBoundaryYear = facts.find((fact) => fact.status === "projection")?.year ?? null;
  const actualYears = facts.filter((fact) => fact.status === "actual").map((fact) => fact.year);
  const projectionYears = facts.filter((fact) => fact.status === "projection").map((fact) => fact.year);
  const latestActual = facts.filter((fact) => fact.status === "actual").at(-1) ?? null;
  const unit = useMemo(
    () => unitFor(facts.map((fact) => fact.generalGovernmentBalanceGel), unitsFor(locale).bn, 2),
    [facts, locale],
  );
  const forecastYears = model.years.filter((year) => year >= (model.forecastStartYear ?? Infinity));
  const label = publicLabel(locale, DEFICIT_ITEM.id, DEFICIT_ITEM.kaLabel, englishLabels);
  const chartSeries: ChartSeries[] = selected
    ? [{
        id: DEFICIT_ITEM.id,
        label,
        color: DEFICIT_ITEM.color,
        vals: model.points.map((point) => point.value),
        planned: model.years.map(() => false),
        ...(model.forecastStartYear === null
          ? {}
          : { forecastFromYear: model.forecastStartYear }),
      }]
    : [];
  const queryMatches = matchesLabelQuery(query, [DEFICIT_ITEM.kaLabel, model.tableRow.enLabel, DEFICIT_ITEM.id]);
  const headlineValue = latestActual
    ? percentage
      ? formatShare(latestActual.generalGovernmentBalancePctGdp / 100)
      : formatAmount(latestActual.generalGovernmentBalanceGel, locale)
    : "—";
  const coverage = [
    years.length > 0 ? `${min}–${max}` : "",
    lastUpdatedAt ? message(messages, "main.updated", { date: locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt }) : "",
  ].filter(Boolean).join(" · ");

  useEffect(() => {
    if (parsedRef.current) return;
    parsedRef.current = true;
    const parsed = parseDeficitHash(window.location.hash);
    const rawStart = parsed.range?.start ?? min;
    const rawEnd = parsed.range?.end ?? max;
    const start = Math.min(Math.max(rawStart, min), max);
    const end = Math.min(Math.max(rawEnd, min), max);

    /* eslint-disable react-hooks/set-state-in-effect */
    if (parsed.chartMode) setChartMode(parsed.chartMode);
    if (parsed.percentage !== undefined) setPercentage(parsed.percentage);
    if (parsed.selected !== undefined) setSelected(parsed.selected);
    setRange({ start: Math.min(start, end), end: Math.max(start, end), min, max });
    /* eslint-enable react-hooks/set-state-in-effect */
    // The hash belongs to the initial browser location, not to later prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hash = serializeDeficitHash({
    chartMode,
    percentage,
    rangeStart: range.start,
    rangeEnd: range.end,
    selected,
  });

  useEffect(() => {
    if (!writtenRef.current) {
      writtenRef.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${hash}`);
    } catch {
      // Browser history may be unavailable in embedded contexts; the explorer remains usable.
    }
  }, [hash]);

  useEffect(() => {
    document.body.dataset.appReady = "true";
    return () => {
      delete document.body.dataset.appReady;
    };
  }, []);

  return (
    <main
      data-testid="deficit-explorer"
      className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px] min-[768px]:pb-16"
    >
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: message(messages, "common.home"), href: pageHref("/", locale) },
            { label: message(messages, "common.data") },
            { label: message(messages, "common.budget"), href: pageHref("/explorer", locale) },
            { label: message(messages, "common.deficit") },
          ]}
          coverage={coverage}
        />
        <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {message(messages, "deficit.heading")}
        </h1>
        <p data-testid="deficit-deck" className="mb-[30px] flex min-h-[18px] flex-wrap items-baseline gap-2 text-[13px] text-[var(--body)]">
          <span className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--ink)]">
            {latestActual?.year}: {label} · {headlineValue}
          </span>
          <span>{message(messages, "deficit.negative")}</span>
        </p>

        <div data-testid="explorer-workspace" className="grid items-start gap-8 @min-[1100px]:grid-cols-[minmax(0,1fr)_292px] @min-[1100px]:gap-10">
          <div className="flex min-w-0 flex-col">
            <section
              data-testid="chart-panel"
              data-mode={chartMode}
              data-measure={percentage ? "percent" : "amount"}
              className="border-t border-[var(--ink)] pt-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedTabs<ChartMode>
                  ariaLabel={message(messages, "controls.viewMode")}
                  value={chartMode}
                  onChange={setChartMode}
                  options={[
                    { value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" },
                    { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
                  ]}
                />
                <div className="flex items-center gap-3.5">
                  <span data-testid="deficit-measure-label" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                    {percentage ? message(messages, "main.percentGdp") : message(messages, "format.bnGel")}
                  </span>
                  <button
                    type="button"
                    data-testid="measure-share-toggle"
                    aria-pressed={percentage}
                    onClick={() => setPercentage((current) => !current)}
                    className={`h-[27px] flex-none cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors duration-150 ${percentage
                      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                      : "border-[var(--control)] bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}
                  >
                    {message(messages, "main.percentGdp")}
                  </button>
                </div>
              </div>

              {!selected ? (
                <div className="mt-5">
                  <Callout testId="no-selection-callout">
                    {message(messages, "main.noSelection")}
                  </Callout>
                </div>
              ) : chartMode === "table" ? (
                <ExplorerTable
                  caption={message(messages, "deficit.caption", { start: range.start, end: range.end })}
                  rows={[model.tableRow]}
                  totalRow={null}
                  showTotal={false}
                  years={model.years}
                  firstColumnLabel={message(messages, "controls.seriesColumn")}
                  unit={unit}
                  share={percentage}
                  showChangeColumn={false}
                  forecastYears={forecastYears}
                  forecastLabel={message(messages, "deficit.forecast")}
                  shareValueForYear={(row, year) => row.shareByYear?.[year] ?? null}
                />
              ) : (
                <div className="mt-5">
                  <EditorialLineChart
                    years={model.years}
                    series={chartSeries}
                    share={percentage}
                    unit={unit}
                    shareLabel={message(messages, "main.shareGdp")}
                  />
                </div>
              )}

              <RangeStrip
                years={years}
                range={range}
                onChange={(patch) => setRange((current) => ({
                  ...current,
                  start: patch.start ?? current.start,
                  end: patch.end ?? current.end,
                }))}
                marker={forecastBoundaryYear === null
                  ? undefined
                  : { year: forecastBoundaryYear, label: message(messages, "deficit.forecast") }}
              />
              <p data-testid="deficit-forecast-note" className="mt-3 max-w-[680px] text-xs leading-relaxed text-[var(--muted)]">
                {message(messages, "deficit.forecastNote", {
                  projectionFirst: projectionYears[0] ?? "",
                  projectionLast: projectionYears.at(-1) ?? "",
                  actualFirst: actualYears[0] ?? "",
                  actualLast: actualYears.at(-1) ?? "",
                })}
              </p>
            </section>

            <div className="mt-[18px]">
              <SourceNote testId="source-label">
                {message(messages, "deficit.source", { edition })}
                {" "}{message(messages, "deficit.definition")}
                {lastUpdatedAt ? (
                  <>{" "}<Message messages={messages} id="main.lastUpdated" values={{ date: <span className="font-[family-name:var(--font-numeric)]">{locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt}</span> }} /></>
                ) : null}
              </SourceNote>
            </div>
          </div>

          <aside
            aria-label={message(messages, "controls.series")}
            className="min-w-0 max-w-full border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:sticky @min-[1100px]:top-5 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]"
          >
            <SeriesSelector
              query={query}
              onQueryChange={setQuery}
              searchPlaceholder={message(messages, "controls.searchSeries")}
              selectedCount={selected ? 1 : 0}
              totalCount={1}
              hasSelection={selected}
              allSelected={selected}
              onToggleAll={() => setSelected(false)}
              allowSelectAll={false}
              hasVisibleMatches={queryMatches}
            >
              {queryMatches ? (
                <SeriesSelectorRow
                  id={DEFICIT_ITEM.id}
                  label={label}
                  color={DEFICIT_ITEM.color}
                  value={latestActual ? formatShare(latestActual.generalGovernmentBalancePctGdp / 100) : "—"}
                  selected={selected}
                  level="total"
                  onToggle={() => setSelected((current) => !current)}
                />
              ) : null}
            </SeriesSelector>
            <ExcelDownloadButton
              testId="deficit-excel"
              disabled={!selected}
              onDownload={() => downloadWorkbook(buildDeficitWorkbookExportModel({
                facts,
                range,
                percentage,
                sources: workbookSources,
                siteOrigin: siteOrigin ?? window.location.origin,
              }, presentation))}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
