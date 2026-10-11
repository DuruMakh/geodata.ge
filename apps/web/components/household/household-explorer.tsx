"use client";
import Link from "next/link";
import { User, Users } from "lucide-react";
import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import type { ClientHouseholdFact, HouseholdArea, HouseholdMeasure } from "../../lib/data/household/types";
import { buildHouseholdModel, changeHouseholdArea, changeHouseholdMeasure, changeHouseholdView, defaultHouseholdState, HOUSEHOLD_SECTIONS, householdCoverage, parseHouseholdHash, sectionTotal, serializeHouseholdHash, type HouseholdSectionId, type HouseholdSeriesModel, type HouseholdState, type HouseholdView } from "../../lib/explorer/household";
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
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { useHashState } from "../external/use-money-from-abroad-state";

const VIEWS: readonly HouseholdView[] = ["parts", "areas"];
/** The first tab's area switch; a region reached from the map shows as a fourth, active option beside it. */
const AREA_OPTIONS: readonly HouseholdArea[] = ["georgia", "settlement.urban", "settlement.rural"];

/**
 * RegionIndex's list rows are Next links, and Next changes a same-page hash without a hashchange event.
 * Following such a link as a plain hash change lets useHashState pick up the region in place.
 */
function followSamePageHash(event: MouseEvent<HTMLElement>) {
  const link = (event.target as Element).closest("a");
  if (!(link instanceof HTMLAnchorElement) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
  event.preventDefault();
  window.location.hash = url.hash;
}

export type HouseholdExplorerProps = {
  section: HouseholdSectionId; facts: ClientHouseholdFact[];
  /** Names of the section's lines; areaLabels names Georgia, towns, villages and the regions. */
  labels: Record<string, string>; areaLabels: Record<HouseholdArea, string>;
  /** The Regions tab's map for each measure. */
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
  const changeView = (view: HouseholdView) => { if (view === state.view) return; setQuery(""); setExpanded({}); update(s => changeHouseholdView(s, section, view, facts), true); };
  const download = (exported: HouseholdState) => <ExcelDownloadButton testId="household-excel-download" disabled={!exported.selectedIds.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildHouseholdWorkbookExportModel({ section, facts, state: exported, labels, areaLabel: areaLabels[exported.area], sources, siteOrigin, title }, presentation));
  }} />;
  const measureTabs = <SegmentedTabs<HouseholdMeasure> ariaLabel={t("measureLabel")} value={state.measure} onChange={measure => update(s => changeHouseholdMeasure(s, section, measure, facts), true)} options={[
    { value: "per_household", label: t("measure.per_household"), testId: "household-measure-per_household", icon: <Users aria-hidden="true" size={18} strokeWidth={1.5} /> },
    { value: "per_capita", label: t("measure.per_capita"), testId: "household-measure-per_capita", icon: <User aria-hidden="true" size={18} strokeWidth={1.5} /> },
  ]} />;
  // Regions tab: the map of the section total, in the latest year every region has, for the chosen measure.
  const regionMap = regionMaps[state.measure];
  const pagePath = HOUSEHOLD_SECTIONS.find(item => item.id === section)!.href;
  // A region opens the first tab for it, keeping the measure.
  const regionHref = (regionId: string) => `${pagePath}#${serializeHouseholdHash({ ...defaultHouseholdState(section), area: regionId as HouseholdArea, measure: state.measure })}`;
  // The regions in the map's year with Georgia first, as the areas view lists them.
  const regionsExport: HouseholdState = { ...state, mode: "table", area: "georgia", range: { kind: "manual", start: regionMap.year, end: regionMap.year }, selectedIds: ["georgia", ...regionMap.regions.map(region => region.regionId)] };
  const totalLabel = labels[sectionTotal(section)];
  const regionArea = !AREA_OPTIONS.includes(state.area);
  return <div data-testid={`household-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="household-latest" measure={t(`latest.${section}`)} period={latest.year} value={valueLabel(latest.value)} />
    <div data-testid="household-tabs" role="group" aria-label={t("tabs")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">
      {VIEWS.map(view => <TextTab key={view} label={view === "parts" ? t(`tab.parts.${section}`) : t("tab.areas")} active={state.view === view} testId={`household-tab-${view}`} onClick={() => changeView(view)} />)}
    </div>
    {state.view === "areas" ? <section data-testid="household-regions" data-measure={state.measure}>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--ink)] pt-4">{measureTabs}</div>
      <div onClickCapture={followSamePageHash}>
        <RegionIndex model={regionMap} sourceNote={`${t("sourceNote")} · ${unitLabel} · ${regionMap.year}`} summary={[]} listFooter={download(regionsExport)} metric={{
          hrefForRegion: regionHref, formatValue: valueLabel, legend: `${totalLabel} · ${unitLabel}`, testId: "household-region-map",
          mapAria: t("regionMapAria", { total: totalLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: valueLabel(value), year }),
        }} />
      </div>
    </section> : <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit="gel" data-measure={state.measure} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            {measureTabs}
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <SegmentedTabs<HouseholdArea> ariaLabel={t("areaLabel")} value={state.area} onChange={area => update(s => changeHouseholdArea(s, section, area, facts), true)}
              options={AREA_OPTIONS.map(area => ({ value: area, label: areaLabels[area], testId: `household-area-${area}` }))} />
            {/* A region is its own active pill, so a long name wraps to the next line on a phone instead of squeezing the three. */}
            {regionArea ? <SegmentedTabs<HouseholdArea> ariaLabel={t("areaLabel")} value={state.area} onChange={() => undefined} options={[{ value: state.area, label: areaLabels[state.area], testId: `household-area-${state.area}` }]} /> : null}
            {regionArea ? <button type="button" data-testid="household-all-regions" onClick={() => changeView("areas")} className="cursor-pointer text-[12px] text-[var(--accent)] underline underline-offset-4">{message(messages, "regionalEconomies.allRegions")}</button> : null}
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]), planned: model.years.map(() => false) }))} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <RangeStrip years={householdCoverage(section, state.view, state.area, state.measure, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildHouseholdModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} · {unitLabel} · {model.range.start}–{model.range.end} · <Link href={pageHref("/methodology/household-income", locale)} className="text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
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
        {download(state)}
      </SeriesAside>
    </ExplorerWorkspace>}
  </div>;
}
