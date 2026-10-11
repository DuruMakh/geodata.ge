"use client";
import Link from "next/link";
import { HouseHeart, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { ClientHouseholdFact, HouseholdArea, HouseholdMeasure } from "../../lib/data/household/types";
import { buildHouseholdModel, changeHouseholdArea, changeHouseholdMeasure, HOUSEHOLD_SECTIONS, householdCoverage, parseHouseholdHash, sectionTotal, serializeHouseholdHash, type HouseholdSectionId, type HouseholdSeriesModel } from "../../lib/explorer/household";
import { buildHouseholdWorkbookExportModel } from "../../lib/explorer/householdWorkbook";
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
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS, SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionIndex } from "../regional-economies/regional-economies-index";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { useHashState } from "../external/use-money-from-abroad-state";

/** The same-page hash a plain left click on a link of the map or list goes to, or null. */
function samePageHash(event: MouseEvent<HTMLElement>): string | null {
  const link = (event.target as Element).closest("a");
  if (!link || link.hasAttribute("target") || link.hasAttribute("download") || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const url = new URL(link.getAttribute("href") ?? "", window.location.href);
  return url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search && url.hash ? url.hash : null;
}

/** The area a page hash names; Georgia is the one it leaves out. */
const areaOf = (hash: string) => new URLSearchParams(hash.replace(/^#/, "")).get("area") ?? "georgia";

/** Brings the chart to the top (clear of the phone header) and gives it focus. */
function bringIntoView(chart: HTMLElement | null) {
  if (!chart) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  chart.focus({ preventScroll: true });
  chart.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
}

export type HouseholdExplorerProps = {
  section: HouseholdSectionId; facts: ClientHouseholdFact[];
  /** Names of the section's lines; areaLabels names Georgia, towns, villages and the regions. */
  labels: Record<string, string>; areaLabels: Record<HouseholdArea, string>;
  /** The area-picking map for each measure. */
  regionMaps: Record<HouseholdMeasure, RegionMapModel>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string;
};

export function HouseholdExplorer({ section, facts, labels: lineLabels, areaLabels, regionMaps, sources, siteOrigin }: HouseholdExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `household.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the section.
  const parse = useCallback((hash: string, f: ClientHouseholdFact[]) => parseHouseholdHash(hash, section, f), [section]);
  const { state, update } = useHashState(facts, parse, serializeHouseholdHash);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const model = buildHouseholdModel(section, facts, state);
  const labels: Record<string, string> = { ...lineLabels, ...areaLabels };
  const unit: ValueUnit = { divisor: 1, label: t("unitGel"), decimals: 1 };
  const unitLabel = t(`unitLong.${state.measure}`);
  const format = (value: number | null | undefined) => formatInUnit(value, unit);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${format(value)} ${unit.label}`;
  const matches = (id: string) => matchesLabelQuery(query, [labels[id]]);
  const reference = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const total = rows.find(row => row.itemId === reference.id) ?? null;
  const allIds = model.series.map(series => series.id);
  // Parts nest under their total (as on the Poverty page): the count and bulk action cover the top-level rows, nested ticks are counted apart.
  const topIds = model.series.filter(series => !series.parentId).map(series => series.id);
  const selectedTop = topIds.filter(id => state.selectedIds.includes(id)).length;
  const toggleSeries = (id: string) => update(s => ({ ...s, selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter(item => item !== id) : allIds.filter(item => item === id || s.selectedIds.includes(item)) }), true);
  const hasNesting = model.series.some(series => series.parentId);
  function renderRow(series: HouseholdSeriesModel): ReactNode {
    const nested = model.series.filter(child => child.parentId === series.id);
    if (!series.reference && !matches(series.id) && !nested.some(child => matches(child.id))) return null;
    const open = Boolean(query.trim()) && nested.some(child => matches(child.id)) || (expanded[series.id] ?? nested.some(child => state.selectedIds.includes(child.id)));
    return <div key={series.id} className={series.parentId ? "ml-4" : undefined}>
      <SeriesSelectorRow id={series.id} label={labels[series.id]} color={series.color} value={format(series.endValue)} selected={state.selectedIds.includes(series.id)} level={series.reference ? "total" : "item"} parentId={series.parentId} isChild={Boolean(series.parentId)} childLabelSize="standard" wrapLabel
        showCaretColumn={hasNesting} hasChildren={nested.length > 0} expanded={open} expansionLabel={t("subcategoriesFor", { label: labels[series.id] })}
        onToggleExpanded={() => setExpanded(previous => ({ ...previous, [series.id]: !open }))} onToggle={() => toggleSeries(series.id)} />
      {open ? nested.map(renderRow) : null}
    </div>;
  }
  // The latest-value line is the page's headline: Georgia per household, whatever is chosen below.
  const latest = facts.filter(f => f.indicatorId === sectionTotal(section) && f.areaId === "georgia" && f.measure === "per_household").sort((a, b) => a.year - b.year).at(-1)!;
  const title = t(`page.${section}.title`);
  const chartLabel = `${t(`tab.parts.${section}`)} · ${areaLabels[state.area]}`;
  const measureTabs = <SegmentedTabs<HouseholdMeasure> ariaLabel={t("measureLabel")} value={state.measure} onChange={measure => update(s => changeHouseholdMeasure(s, section, measure, facts), true)} options={[
    { value: "per_household", label: t("measure.per_household"), testId: "household-measure-per_household", icon: <HouseHeart aria-hidden="true" size={18} strokeWidth={1.5} /> },
    { value: "per_capita", label: t("measure.per_capita"), testId: "household-measure-per_capita", icon: <User aria-hidden="true" size={18} strokeWidth={1.5} /> },
  ]} />;
  // The map of the section total, in the latest year every region has, for the chosen measure; Georgia leads its list.
  const regionMap = regionMaps[state.measure];
  const totalLabel = labels[sectionTotal(section)];
  const georgiaValue = facts.find(f => f.indicatorId === sectionTotal(section) && f.areaId === "georgia" && f.measure === state.measure && f.year === regionMap.year)?.value;
  const pagePath = HOUSEHOLD_SECTIONS.find(item => item.id === section)!.href;
  // Georgia or a region becomes the page's area, keeping the ticked lines it has and the measure.
  const areaHref = (area: string) => `${pagePath}#${serializeHouseholdHash(changeHouseholdArea(state, section, area as HouseholdArea, facts))}`;
  // After a pick the chart comes into view and takes focus once the new area has rendered, so it is announced with
  // that area's name; picking the area already shown brings the chart up at once.
  const chartRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef(false);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    bringIntoView(chartRef.current);
  }, [state.area]);
  const pick = (area: string) => { if (area === state.area) bringIntoView(chartRef.current); else pendingFocus.current = true; };
  // List rows are Next links, and Next changes a same-page hash without a hashchange event: follow them as a plain
  // hash change, so useHashState picks up the area in place. Map paths are SVG links the browser follows itself.
  const followSamePageHash = (event: MouseEvent<HTMLElement>) => {
    if (!((event.target as Element).closest("a") instanceof HTMLAnchorElement)) return;
    const hash = samePageHash(event);
    if (!hash) return;
    event.preventDefault();
    window.location.hash = hash;
    pick(areaOf(hash));
  };
  const followMapPath = (event: MouseEvent<HTMLElement>) => {
    // A map path a first touch only previews has its click prevented, and the page stays on the map.
    if (event.defaultPrevented) return;
    const hash = samePageHash(event);
    if (hash) return pick(areaOf(hash));
    // Tbilisi's fingertip target opens its area with location.assign, which has already changed the hash unless the tap only previewed it.
    const target = (event.target as Element).closest("[data-map-touch-target]")?.getAttribute("data-map-touch-target");
    if (target && target !== state.area && areaOf(window.location.hash) === target) pendingFocus.current = true;
  };
  return <div data-testid={`household-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="household-latest" measure={t(`latest.${section}`)} period={latest.year} value={valueLabel(latest.value)} />
    <section data-testid="household-regions" data-measure={state.measure} className="mt-4 mb-10" onClickCapture={followSamePageHash} onClick={followMapPath}>
      <RegionIndex model={regionMap} summary={[]} selectedId={state.area} leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: areaLabels.georgia, value: georgiaValue }} metric={{
        hrefForRegion: areaHref, formatValue: valueLabel, legend: `${totalLabel} · ${unitLabel}`, testId: "household-region-map",
        mapAria: t("regionMapAria", { total: totalLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: valueLabel(value), year }),
      }} />
    </section>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section ref={chartRef} tabIndex={-1} aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-area={state.area} data-unit="gel" data-measure={state.measure} className="scroll-mt-[72px] min-[900px]:scroll-mt-3 border-t border-[var(--ink)] pt-4">
          <h2 data-testid="household-chosen-area" className="mb-3 break-words font-[family-name:var(--font-display)] text-[19px] font-semibold">{areaLabels[state.area]}</h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            {measureTabs}
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]), planned: model.years.map(() => false) }))} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <RangeStrip years={householdCoverage(section, state.area, state.measure, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildHouseholdModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} · {unitLabel} · {model.range.start}–{model.range.end} · <Link href={pageHref("/methodology/household-income", locale)} className="text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
          {" · "}{message(messages, "regionalEconomies.boundaries")} <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer" className="underline underline-offset-2">geoBoundaries</a> (CC BY 3.0)
        </SourceNote></div>
      </div>
      <SeriesAside label={message(messages, "controls.series")}>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {unitLabel}</p>
        <SeriesSelector query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={allIds.length > SEARCHABLE_MIN_ROWS} selectedCount={selectedTop} totalCount={topIds.length}
          supplementalSelected={model.selected.length > selectedTop ? { label: t("nestedSelected"), count: model.selected.length - selectedTop } : undefined}
          hasSelection={model.selected.length > 0} allSelected={selectedTop === topIds.length}
          onToggleAll={() => update(s => ({ ...s, selectedIds: s.selectedIds.length ? [] : [...topIds] }), true)} hasVisibleMatches={allIds.some(matches)}>
          {model.series.filter(series => !series.parentId).map(renderRow)}
        </SeriesSelector>
        <ExcelDownloadButton testId="household-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildHouseholdWorkbookExportModel({ section, facts, state, labels, areaLabel: areaLabels[state.area], sources, siteOrigin, title }, presentation));
        }} />
      </SeriesAside>
    </ExplorerWorkspace>
  </div>;
}
