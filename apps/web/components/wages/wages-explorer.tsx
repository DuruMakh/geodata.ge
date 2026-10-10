"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import type { ClientWagesFact } from "../../lib/data/wages/types";
import { buildWagesHeatmap, buildWagesModel, changeWagesView, parseWagesHash, serializeWagesHash, wagesCoverage, wagesRegionHref, wagesViews, type WagesSectionId, type WagesSeriesModel, type WagesState, type WagesView } from "../../lib/explorer/wages";
import { buildWagesWorkbookExportModel } from "../../lib/explorer/wagesWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { SeriesAside } from "../explorer-shell/series-aside";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS, SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionIndex } from "../regional-economies/regional-economies-index";
import { RegionPicker } from "../regional-economies/region-picker";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { UnemploymentAgeHeatmap } from "../unemployment/unemployment-age-heatmap";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

const selectClass = "min-w-0 w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent py-2 text-[12px] text-[var(--ink)]";

function useWagesState(section: WagesSectionId, facts: ClientWagesFact[]) {
  const [state, setState] = useState(() => parseWagesHash("", section, facts));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parseWagesHash(window.location.hash, section, facts); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [section, facts]);
  useAppReady();
  const update = useCallback((change: (previous: WagesState) => WagesState, push = false) => {
    const next = change(current.current); current.current = next;
    const hash = `#${serializeWagesHash(next, section)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the view still updates. */ }
    }
    setState(next);
  }, [section]);
  return { state, update };
}

/** The Regions index: the map and ranked list only; each region opens its own page. */
export function WagesRegionsIndex({ regionMap, national }: { regionMap: RegionMapModel; national: { year: number; value: number } }) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `wages.${key}`, values);
  const amount = (value: number) => `${formatInUnit(value, { divisor: 1, label: t("unit"), decimals: 1 })} ${t("unit")}`;
  useAppReady();
  return <div data-testid="wages-regions" className="@container">
    <ExplorerHeading>{t("page.regions.title")}</ExplorerHeading>
    <LatestValueLine testId="wages-latest" measure={t("series.average")} period={national.year} value={amount(national.value)} />
    <p className="mb-2 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("page.regions.summary")}</p>
    <p data-testid="wages-nominal-note" className="mb-5 max-w-[800px] text-[12px] leading-relaxed text-[var(--muted)]">{t("nominalNote")}</p>
    <div data-testid="wages-regions-index">
      <RegionIndex model={regionMap} sourceNote={t("sourceNote")} metric={{
        hrefForRegion: wagesRegionHref, formatValue: amount,
        mapAria: t("regionMapAria", { year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: amount(value), year }),
        legend: t("series.average"), testId: "wages-region-map",
      }} summary={[
        { label: message(messages, "regionalEconomies.regionCount"), value: String(regionMap.regions.length), detail: `${t("series.average")} · ${regionMap.year}` },
        { label: t("series.average"), value: amount(national.value), detail: String(national.year) },
        { label: message(messages, "regionalEconomies.period"), value: `${regionMap.firstYear}–${regionMap.year}`, detail: t("annual") },
      ]} />
      <p className="mt-3 max-w-[900px] text-[11px] leading-relaxed text-[var(--muted)]">{t("regionNote")}</p>
    </div>
  </div>;
}

export type WagesExplorerProps = {
  section: WagesSectionId; facts: ClientWagesFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
  /** Region pages: the region and the regions offered by the picker and previous/next links. */
  regionId?: string; regions?: readonly MunicipalRegion[];
};

export function WagesExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin, regionId, regions }: WagesExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `wages.${key}`, values);
  const { state, update } = useWagesState(section, facts);
  const [pickerOpen, setPickerOpen] = useState(false);
  const regionName = regionId ? labels[regionId] : "";
  const ordered = regions ?? [], regionIndex = ordered.findIndex(region => region.id === regionId);
  const neighbours = regionIndex < 0 ? null : { previous: ordered[(regionIndex - 1 + ordered.length) % ordered.length]!, next: ordered[(regionIndex + 1) % ordered.length]! };
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const model = buildWagesModel(section, facts, state);
  const unit: ValueUnit = { divisor: 1, label: t("unit"), decimals: model.decimals };
  const format = (value: number | null | undefined, decimals = model.decimals) => formatInUnit(value, { ...unit, decimals });
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${format(value)} ${unit.label}`;
  const matches = (id: string) => matchesLabelQuery(query, [labels[id]]);
  const reference = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const total = rows.find(row => row.itemId === reference.id) ?? null;
  const allIds = model.series.map(series => series.id);
  // The Overview nests women, men, public and non-public under the average (as Unemployment nests
  // its subcategories): the count and bulk action cover the top-level rows, nested ticks are counted apart.
  const topIds = model.series.filter(series => !series.parentId).map(series => series.id);
  const selectedTop = topIds.filter(id => state.selectedIds.includes(id)).length;
  const toggleSeries = (id: string) => update(s => ({ ...s, selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter(item => item !== id) : allIds.filter(item => item === id || s.selectedIds.includes(item)) }), true);
  function renderRow(series: WagesSeriesModel): ReactNode {
    const nested = model.series.filter(child => child.parentId === series.id);
    if (!series.reference && !matches(series.id) && !nested.some(child => matches(child.id))) return null;
    const open = Boolean(query.trim()) && nested.some(child => matches(child.id)) || (expanded[series.id] ?? nested.some(child => state.selectedIds.includes(child.id)));
    return <div key={series.id} className={series.parentId ? "ml-4" : undefined}>
      <SeriesSelectorRow id={series.id} label={labels[series.id]} color={series.color} value={format(series.endValue, series.decimals)} selected={state.selectedIds.includes(series.id)} level={series.reference ? "total" : "item"} parentId={series.parentId} isChild={Boolean(series.parentId)} childLabelSize="standard" wrapLabel
        showCaretColumn={section === "overview"} hasChildren={nested.length > 0} expanded={open} expansionLabel={t("subcategoriesFor", { label: labels[series.id] })}
        onToggleExpanded={() => setExpanded(previous => ({ ...previous, [series.id]: !open }))} onToggle={() => toggleSeries(series.id)} />
      {open ? nested.map(renderRow) : null}
    </div>;
  }
  // The latest-value line states the page's own place: Georgia, or the region.
  const latest = facts.filter(f => f.indicatorId === "average_monthly_nominal_earnings" && f.dimension === (regionId ? "region" : "national") && f.sectorId === "total" && f.value !== null).sort((a, b) => a.year - b.year).at(-1)!;
  const title = regionId ? t("regionTitle", { region: regionName }) : t(`page.${section}.title`);
  const changeView = (view: WagesView) => { if (view === state.view) return; setQuery(""); update(s => changeWagesView(s, section, view, facts), true); };
  const downloadAction = <ExcelDownloadButton testId="wages-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildWagesWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  const heatmap = section === "industries" ? buildWagesHeatmap(model) : null;
  return <div data-testid={`wages-${section}`} className="@container">
    {regionId ? <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-3">
      <div className="relative min-w-0 min-[768px]:flex-1">
        <ExplorerHeading>{t("regionHeadingLead")}{" "}
          <button type="button" data-testid="region-picker-trigger" aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {regionName}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </ExplorerHeading>
        <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} regions={ordered} activeRegionId={regionId} hrefForRegion={wagesRegionHref} indexHref="/explorer/wages/regions" />
      </div>
      {neighbours ? <EntityNeighbourLinks testId="wages-region-navigation" className="mb-3"
        previous={{ href: pageHref(wagesRegionHref(neighbours.previous.id), locale), label: labels[neighbours.previous.id] }}
        next={{ href: pageHref(wagesRegionHref(neighbours.next.id), locale), label: labels[neighbours.next.id] }} /> : null}
    </div> : <ExplorerHeading>{title}</ExplorerHeading>}
    <LatestValueLine testId="wages-latest" measure={regionId ? `${t("series.average")} · ${regionName}` : t("series.average")} period={latest.year} value={`${format(latest.value, 1)} ${unit.label}`} />
    {section === "overview" ? null : <>
      <p className="mb-2 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{regionId ? t("regionSummary", { region: regionName }) : t(`page.${section}.summary`)}</p>
      <p data-testid="wages-nominal-note" className="mb-5 max-w-[800px] text-[12px] leading-relaxed text-[var(--muted)]">{t("nominalNote")}</p>
    </>}
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit="gel" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            {section === "industries" ? <label className="min-w-0 w-full text-[11px] min-[768px]:text-[10px] font-semibold text-[var(--muted)] min-[768px]:max-w-[360px]"><span className="sr-only">{t("groupLabel")}</span>
              <select data-testid="wages-group" value={state.view} className={selectClass} onChange={event => changeView(event.target.value as WagesView)}>
                {wagesViews(section).map(view => <option key={view} value={view}>{t(`group.${view}`)}</option>)}
              </select>
            </label> : <span className="text-[11px] text-[var(--muted)]">{t("unitMonthly")}</span>}
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]), planned: model.years.map(() => false) }))} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${title} · ${t("unitMonthly")} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <RangeStrip years={wagesCoverage(section, state.view, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildWagesModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(state.view === "median" || section === "overview" ? "sourceNoteMedian" : "sourceNote")} · {model.range.start}–{model.range.end} · {lastReviewedAt}
          <Link href={pageHref("/methodology/wages", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
        {regionId ? <p className="mt-3 max-w-[800px] text-[11px] leading-relaxed text-[var(--muted)]">{t("regionNote")}</p> : null}
        {state.view === "business" || state.view === "non_business" ? <p className="mt-3 max-w-[800px] text-[11px] leading-relaxed text-[var(--muted)]">{t("nonBusinessNote")}</p> : null}
      </div>
      <SeriesAside label={message(messages, "controls.series")}>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {t("unitMonthly")}</p>
        <SeriesSelector query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={allIds.length > SEARCHABLE_MIN_ROWS} selectedCount={selectedTop} totalCount={topIds.length}
          supplementalSelected={model.selected.length > selectedTop ? { label: t("nestedSelected"), count: model.selected.length - selectedTop } : undefined}
          hasSelection={model.selected.length > 0} allSelected={selectedTop === topIds.length}
          onToggleAll={() => update(s => ({ ...s, selectedIds: s.selectedIds.length ? [] : [...topIds] }), true)} hasVisibleMatches={allIds.some(matches)}>
          {model.series.filter(series => !series.parentId).map(renderRow)}
        </SeriesSelector>
        {downloadAction}
      </SeriesAside>
    </ExplorerWorkspace>
    {heatmap ? <UnemploymentAgeHeatmap indicator={state.view} model={{ ...heatmap, rows: heatmap.rows.map(row => ({ ...row, labelKa: labels[row.id], labelEn: labels[row.id] })) }} copy={{
      testId: "wages-industry-heatmap", title: t("heatmapTitle"), caption: `${t(`group.${state.view}`)} · ${t("unitMonthly")} · ${model.years[0]}–${model.years.at(-1)}`,
      note: t("heatmapNote"), scale: t("heatmapScale"), rowHeader: t("industry"), unit: "gel", format: value => format(value),
    }} /> : null}
  </div>;
}
