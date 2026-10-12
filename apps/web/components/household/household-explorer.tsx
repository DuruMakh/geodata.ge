"use client";
import Link from "next/link";
import { ChevronDown, User } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import type { ClientHouseholdFact, HouseholdArea, HouseholdMeasure } from "../../lib/data/household/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { buildHouseholdModel, changeHouseholdMeasure, HOUSEHOLD_SECTIONS, householdCoverage, householdMeasureHash, householdRegionHref, parseHouseholdHash, parseHouseholdMeasure, sectionTotal, serializeHouseholdHash, serializeHouseholdMeasure, type HouseholdSectionId, type HouseholdSeriesModel } from "../../lib/explorer/household";
import { buildHouseholdWorkbookExportModel } from "../../lib/explorer/householdWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
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
import { RegionPicker } from "../regional-economies/region-picker";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { HouseholdIcon } from "../ui/household-icon";
import { useHashState } from "../explorer-shell/use-hash-state";

/** The per household / per person icon switch. */
function MeasureTabs({ value, onChange }: { value: HouseholdMeasure; onChange: (measure: HouseholdMeasure) => void }) {
  const { messages } = useI18n();
  const t = (key: string) => message(messages, `household.${key}`);
  return <SegmentedTabs<HouseholdMeasure> ariaLabel={t("measureLabel")} value={value} onChange={onChange} options={[
    { value: "per_household", label: t("measure.per_household"), testId: "household-measure-per_household", icon: <HouseholdIcon aria-hidden="true" size={18} strokeWidth={1.5} /> },
    { value: "per_capita", label: t("measure.per_capita"), testId: "household-measure-per_capita", icon: <User aria-hidden="true" size={18} strokeWidth={1.5} /> },
  ]} />;
}

/**
 * The Income or Spending index: Georgia's latest value, the measure switch and the map and ranked list of the section total.
 * Georgia (the list's first row) and each region open their own page, carrying the per person choice.
 */
export function HouseholdIndex({ section, facts, regionMaps }: {
  section: HouseholdSectionId;
  /** Georgia's section total, both measures. */
  facts: ClientHouseholdFact[];
  regionMaps: Record<HouseholdMeasure, RegionMapModel>;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `household.${key}`, values);
  const { state: measure, update } = useHashState(section, parseHouseholdMeasure, serializeHouseholdMeasure);
  const unitLabel = t(`unitLong.${measure}`);
  const valueLabel = (value: number) => `${formatInUnit(value, { divisor: 1, label: t("unitGel"), decimals: 1 })} ${t("unitGel")}`;
  const georgia = (m: HouseholdMeasure) => facts.filter(f => f.indicatorId === sectionTotal(section) && f.areaId === "georgia" && f.measure === m).sort((a, b) => a.year - b.year);
  // The latest-value line is the page's headline: Georgia per household, whichever measure the map shows.
  const latest = georgia("per_household").at(-1)!;
  // The map of the section total, in the latest year every region has, for the chosen measure.
  const regionMap = regionMaps[measure];
  const totalLabel = t(`series.${sectionTotal(section)}`);
  const georgiaValue = georgia(measure).find(f => f.year === regionMap.year)?.value;
  return <div data-testid={`household-${section}`} className="@container">
    <ExplorerHeading>{t(`page.${section}.title`)}</ExplorerHeading>
    <LatestValueLine testId="household-latest" measure={t(`latest.${section}`)} period={latest.year} value={valueLabel(latest.value)} />
    <section data-testid="household-regions" data-measure={measure} className="mt-4">
      <RegionIndex model={regionMap} summary={[]} sourceNote={`${t("sourceNote")} · ${unitLabel} · ${regionMap.year}.`}
        mapControls={<MeasureTabs value={measure} onChange={next => update(() => next, true)} />}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: id => `${householdRegionHref(section, id)}${householdMeasureHash(measure)}`, formatValue: valueLabel, legend: `${totalLabel} · ${unitLabel}`, testId: "household-region-map",
          mapAria: t("regionMapAria", { total: totalLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: valueLabel(value), year }),
        }} />
    </section>
  </div>;
}

export type HouseholdExplorerProps = {
  section: HouseholdSectionId; facts: ClientHouseholdFact[];
  /** Names of the section's lines; areaLabels names Georgia, towns, villages and the regions. */
  labels: Record<string, string>; areaLabels: Record<HouseholdArea, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string;
  /** The page's area (Georgia or a region), and the areas offered by the picker and previous/next links, Georgia first. */
  area: HouseholdArea; areas: readonly MunicipalRegion[];
};

/** An area's page: Georgia's or a region's chart, series list and Excel, with the area picker in the heading. */
export function HouseholdExplorer({ section, facts, labels: lineLabels, areaLabels, sources, siteOrigin, area, areas }: HouseholdExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `household.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the page.
  const parse = useCallback((hash: string, f: ClientHouseholdFact[]) => parseHouseholdHash(hash, section, area, f), [section, area]);
  const { state, update } = useHashState(facts, parse, serializeHouseholdHash);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const model = buildHouseholdModel(section, area, facts, state);
  const labels: Record<string, string> = { ...lineLabels, ...areaLabels };
  const unit: ValueUnit = { divisor: 1, label: t("unitGel"), decimals: 1 };
  const unitLabel = t(`unitLong.${state.measure}`);
  const format = (value: number | null | undefined) => formatInUnit(value, unit);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${format(value)} ${unit.label}`;
  const matches = (id: string) => matchesLabelQuery(query, [labels[id]]);
  const reference = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]), planned: model.years.map(() => false) }));
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
  // The latest-value line is the page's headline: its own area per household, whatever is chosen below.
  const latest = facts.filter(f => f.indicatorId === sectionTotal(section) && f.areaId === area && f.measure === "per_household").sort((a, b) => a.year - b.year).at(-1)!;
  const areaName = areaLabels[area];
  const title = t(`page.${section}.title`);
  const chartLabel = `${t(`tab.parts.${section}`)} · ${areaLabels[area]}`;
  const pagePath = HOUSEHOLD_SECTIONS.find(item => item.id === section)!.href;
  // Links to another area's page carry the per household or per person choice, and nothing else.
  const areaHref = (id: string) => `${householdRegionHref(section, id)}${householdMeasureHash(state.measure)}`;
  const index = areas.findIndex(item => item.id === area);
  const neighbours = { previous: areas[(index - 1 + areas.length) % areas.length]!, next: areas[(index + 1) % areas.length]! };
  return <div data-testid={`household-${section}`} className="@container">
    <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-3">
      <div className="relative min-w-0 min-[768px]:flex-1">
        <ExplorerHeading>{t(`page.${section}.regionHeadingLead`)}{" "}
          <button type="button" data-testid="region-picker-trigger" aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {areaName}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </ExplorerHeading>
        <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} regions={areas} activeRegionId={area} hrefForRegion={areaHref} indexHref={`${pagePath}${householdMeasureHash(state.measure)}`} />
      </div>
      <EntityNeighbourLinks testId="household-region-navigation" className="mb-3"
        previous={{ href: pageHref(areaHref(neighbours.previous.id), locale), label: areaLabels[neighbours.previous.id as HouseholdArea] }}
        next={{ href: pageHref(areaHref(neighbours.next.id), locale), label: areaLabels[neighbours.next.id as HouseholdArea] }} />
    </div>
    <LatestValueLine testId="household-latest" measure={`${t(`latest.${section}`)} · ${areaName}`} period={latest.year} value={valueLabel(latest.value)} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-area={area} data-unit="gel" data-measure={state.measure} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            <MeasureTabs value={state.measure} onChange={measure => update(s => changeHouseholdMeasure(s, section, area, measure, facts), true)} />
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={householdCoverage(section, area, state.measure, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildHouseholdModel(section, area, facts, s).range, patch) }))} />
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
        <ExcelDownloadButton testId="household-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildHouseholdWorkbookExportModel({ section, area, facts, state, labels, areaLabel: areaLabels[area], sources, siteOrigin, title }, presentation));
        }} />
      </SeriesAside>
    </ExplorerWorkspace>
  </div>;
}
