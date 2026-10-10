"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientWagesFact } from "../../lib/data/wages/types";
import { buildWagesHeatmap, buildWagesModel, changeWagesView, parseWagesHash, serializeWagesHash, wagesCoverage, wagesViews, type WagesSectionId, type WagesState, type WagesView } from "../../lib/explorer/wages";
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
import { UnemploymentAgeHeatmap } from "../unemployment/unemployment-age-heatmap";
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";

const selectClass = "min-w-0 w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent py-2 text-[12px] text-[var(--ink)]";

function useWagesState(section: WagesSectionId, facts: ClientWagesFact[]) {
  const [state, setState] = useState(() => parseWagesHash("", section, facts));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parseWagesHash(window.location.hash, section, facts); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [section, facts]);
  // A region link on this page changes only the hash, which client navigation does not announce:
  // once the address shows the link's hash, apply it. A first tap that only previews a region never does.
  const followLink = useCallback((hash: string) => {
    const apply = (frames: number) => {
      if (window.location.hash === hash) { const next = parseWagesHash(hash, section, facts); current.current = next; setState(next); }
      else if (frames) window.requestAnimationFrame(() => apply(frames - 1));
    };
    window.requestAnimationFrame(() => apply(60));
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
  return { state, update, followLink };
}

export type WagesExplorerProps = {
  section: WagesSectionId; facts: ClientWagesFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string; regionMap?: RegionMapModel;
};

export function WagesExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin, regionMap }: WagesExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `wages.${key}`, values);
  const { state, update, followLink } = useWagesState(section, facts);
  const [query, setQuery] = useState("");
  const model = buildWagesModel(section, facts, state);
  const unit: ValueUnit = { divisor: 1, label: t("unit"), decimals: model.decimals };
  const format = (value: number | null | undefined, decimals = model.decimals) => formatInUnit(value, { ...unit, decimals });
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${format(value)} ${unit.label}`;
  const matches = (id: string) => matchesLabelQuery(query, [labels[id]]);
  const reference = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const total = rows.find(row => row.itemId === reference.id) ?? null;
  const allIds = model.series.map(series => series.id);
  const national = facts.filter(f => f.indicatorId === "average_monthly_nominal_earnings" && f.dimension === "national" && f.sectorId === "total" && f.value !== null).sort((a, b) => a.year - b.year).at(-1)!;
  const changeView = (view: WagesView) => { if (view === state.view) return; setQuery(""); update(s => changeWagesView(s, section, view, facts), true); };
  const downloadAction = <ExcelDownloadButton testId="wages-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildWagesWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin }, presentation));
  }} />;
  const heatmap = section === "industries" ? buildWagesHeatmap(model) : null;
  const regionAverage = (value: number) => `${formatInUnit(value, { ...unit, decimals: 1 })} ${unit.label}`;
  return <div data-testid={`wages-${section}`} className="@container">
    <ExplorerHeading>{t(`page.${section}.title`)}</ExplorerHeading>
    <LatestValueLine testId="wages-latest" measure={t("series.average")} period={national.year} value={`${format(national.value, 1)} ${unit.label}`} />
    <p className="mb-2 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t(`page.${section}.summary`)}</p>
    <p data-testid="wages-nominal-note" className="mb-5 max-w-[800px] text-[12px] leading-relaxed text-[var(--muted)]">{t("nominalNote")}</p>
    {regionMap ? <div data-testid="wages-regions-index" className="mb-10" onClickCapture={event => { const link = (event.target as Element).closest("a"); if (link?.hash) followLink(link.hash); }}>
      <RegionIndex model={regionMap} sourceNote={t("sourceNote")} metric={{
        hrefForRegion: id => `/explorer/wages/regions#view=line&sel=average,${id}&range=all`, formatValue: regionAverage,
        mapAria: t("regionMapAria", { year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: regionAverage(value), year }),
        legend: t("series.average"), testId: "wages-region-map",
      }} summary={[
        { label: message(messages, "regionalEconomies.regionCount"), value: String(regionMap.regions.length), detail: `${t("series.average")} · ${regionMap.year}` },
        { label: t("series.average"), value: regionAverage(national.value!), detail: String(national.year) },
        { label: message(messages, "regionalEconomies.period"), value: `${regionMap.firstYear}–${regionMap.year}`, detail: t("annual") },
      ]} />
      <p className="mt-3 max-w-[900px] text-[11px] leading-relaxed text-[var(--muted)]">{t("regionNote")}</p>
    </div> : null}
    {section === "overview" ? <div data-testid="wages-tabs" role="group" aria-label={t("tabsLabel")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">
      {wagesViews(section).map(view => <TextTab key={view} label={t(`tab.${view}`)} active={state.view === view} testId={`wages-tab-${view}`} onClick={() => changeView(view)} />)}
    </div> : null}
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
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]), planned: model.years.map(() => false) }))} share={false} unit={unit} shareLabel={t(`page.${section}.title`)} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${t(`page.${section}.title`)} · ${t("unitMonthly")} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <RangeStrip years={wagesCoverage(section, state.view, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildWagesModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(state.view === "median" || (section === "overview" && state.view === "overview") ? "sourceNoteMedian" : "sourceNote")} · {model.range.start}–{model.range.end} · {lastReviewedAt}
          <Link href={pageHref("/methodology/wages", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
        {section === "overview" && state.view === "business_sector" ? <p className="mt-3 max-w-[800px] text-[11px] leading-relaxed text-[var(--muted)]">{t("nonBusinessNote")}</p> : null}
      </div>
      <SeriesAside label={message(messages, "controls.series")}>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {t("unitMonthly")}</p>
        <SeriesSelector query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={allIds.length > SEARCHABLE_MIN_ROWS} selectedCount={model.selected.length} totalCount={allIds.length} hasSelection={model.selected.length > 0} allSelected={model.selected.length === allIds.length}
          onToggleAll={() => update(s => ({ ...s, selectedIds: s.selectedIds.length ? [] : [...allIds] }), true)} hasVisibleMatches={allIds.some(matches)}>
          {model.series.filter(series => series.reference || matches(series.id)).map(series => <SeriesSelectorRow key={series.id} id={series.id} label={labels[series.id]} color={series.color} value={format(series.endValue, series.decimals)} selected={state.selectedIds.includes(series.id)} level={series.reference ? "total" : "item"} wrapLabel
            onToggle={() => update(s => ({ ...s, selectedIds: s.selectedIds.includes(series.id) ? s.selectedIds.filter(id => id !== series.id) : allIds.filter(id => id === series.id || s.selectedIds.includes(id)) }), true)} />)}
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
