"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { BedDouble, Hospital, Stethoscope, Users, type LucideIcon } from "lucide-react";
import type { ClientHealthFact, HealthSeriesBreak } from "../../lib/data/health/types";
import { buildHealthModel, changeHealthView, healthCoverage, healthDisplay, healthViews, healthViewSeries, parseHealthHash, serializeHealthHash, type HealthNationalSectionId, type HealthState, type HealthView } from "../../lib/explorer/health";
import { buildHealthWorkbookExportModel } from "../../lib/explorer/healthWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

export type HealthExplorerProps = {
  section: HealthNationalSectionId; facts: ClientHealthFact[];
  /** The counting changes that touch the page's series; the model draws those inside the range that touch a selected one. */
  breaks: HealthSeriesBreak[];
  labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

type HealthHashData = { section: HealthNationalSectionId; facts: ClientHealthFact[] };
const parseHealthState = (hash: string, data: HealthHashData) => parseHealthHash(hash, data.section, data.facts);
const serializeHealthState = (state: HealthState, data: HealthHashData) => serializeHealthHash(state, data.section);

/** The Doctors and hospitals measure switch: icons only, named by their tooltips (DESIGN §7.2a). */
const VIEW_ICONS: Partial<Record<HealthView, LucideIcon>> = { staff: Users, hospitals: Hospital, beds: BedDouble, visits: Stethoscope };
/** The latest-value line on Illnesses names respiratory disease, the largest group, whatever is selected. */
const ILLNESSES_HEADLINE = "health.illness.respiratory";
const scaled = (value: number, multiplier: number) => multiplier === 1 ? value : Number((value * multiplier).toPrecision(15));

/** Doctors and hospitals (four measures) or Illnesses (disease groups and single diseases under their headings), for Georgia. */
export function HealthExplorer({ section, facts, breaks, labels, sources, lastReviewedAt, siteOrigin }: HealthExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `health.${key}`, values);
  const hashData = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(hashData, parseHealthState, serializeHealthState);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const model = buildHealthModel(section, facts, state, breaks);
  // The panel names the unit, so axis ticks and cells carry numbers only. The table shows the most decimals among the
  // selected series; the list, the tooltip and the latest line show each series to its own.
  const unit: ValueUnit = { divisor: 1, label: "", decimals: model.decimals };
  const unitLabel = message(messages, model.unitKey);
  const decimalsOf = (id: string) => model.series.find(series => series.id === id)?.decimals ?? model.decimals;
  const format = (value: number | null | undefined, decimals = model.decimals) => formatInUnit(value, { ...unit, decimals });
  const valueLabel = (value: number | null | undefined, id: string) => value == null ? "—" : format(value, decimalsOf(id));
  const reference = model.series.find(series => series.reference);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  const total = reference ? rows.find(row => row.itemId === reference.id) ?? null : null;
  const newCounting = t("break.newCounting");
  // The latest-value line is the current view's headline series (a touch reader sees which measure the switch chose,
  // DESIGN §7.2a); on Illnesses it is respiratory disease, shown in thousand to one decimal.
  const views = healthViews(section);
  const headline = section === "illnesses" ? ILLNESSES_HEADLINE : healthViewSeries(section, state.view)[0].id;
  const latest = facts.filter(f => f.indicatorId === headline).sort((a, b) => a.year - b.year).at(-1)!;
  const latestValue = section === "illnesses" ? `${format(latest.value, 1)} ${t("thousand")}`
    : `${format(scaled(latest.value, healthDisplay(state.view, headline).multiplier), decimalsOf(headline))}${state.view === "visits" ? ` ${message(messages, "format.mln")}` : ""}`;
  const measureLabel = section === "illnesses" || state.view === views[0] ? t(`latest.${section}`) : labels[headline];
  const title = t(`page.${section}.title`);
  const chartLabel = views.length > 1 ? t(`view.${state.view}`) : title;
  const changeView = (view: HealthView) => {
    if (view === state.view) return;
    setExpanded({}); setQuery("");
    update(s => changeHealthView(s, section, view, facts), true);
  };
  const downloadAction = <ExcelDownloadButton testId="health-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildHealthWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`health-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="health-latest" measure={measureLabel} period={latest.year} value={latestValue} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} className="border-t border-[var(--ink)] pt-4">
          <div className={`flex flex-wrap ${views.length > 1 ? "items-center" : "items-end"} justify-between gap-3`}>
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <div className="flex items-center gap-3.5">
              <span data-testid="health-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
              {views.length > 1 ? <SegmentedTabs ariaLabel={t("measure")} value={state.view} onChange={changeView} options={views.map(view => {
                const Icon = VIEW_ICONS[view]!;
                return { value: view, label: t(`view.${view}`), testId: `health-view-${view}`, icon: <Icon aria-hidden="true" size={18} strokeWidth={1.5} /> };
              })} /> : null}
            </div>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} breaks={model.breaks.map(item => ({ year: item.year, label: newCounting }))} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null}
              breakYears={model.breaks.map(item => item.year)} breakLabel={newCounting} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={healthCoverage(section, state.view, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildHealthModel(section, facts, s, breaks).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span> · <Link href={pageHref("/methodology/health", locale)} prefetch={false} className="text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Staff nest under Doctors and Nurses; illnesses sit under their two headings. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{model.range.end} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: format(series.endValue, series.decimals), parentId: series.parentId, heading: series.heading ? t(`heading.${series.heading}`) : undefined }))}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS}
        nesting={model.series.some(series => series.parentId) ? { selectedLabel: t("nestedSelected"), expansionLabel: label => t("subcategoriesFor", { label }), expanded, onExpandedChange: setExpanded } : undefined} />
    </ExplorerWorkspace>
  </div>;
}
