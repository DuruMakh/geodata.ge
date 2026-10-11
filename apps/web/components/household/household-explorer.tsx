"use client";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { HOUSEHOLD_AREAS, type ClientHouseholdFact, type HouseholdArea, type HouseholdMeasure } from "../../lib/data/household/types";
import { buildHouseholdModel, changeHouseholdArea, changeHouseholdMeasure, changeHouseholdView, householdCoverage, parseHouseholdHash, serializeHouseholdHash, type HouseholdSectionId, type HouseholdSeriesModel, type HouseholdView } from "../../lib/explorer/household";
import { buildHouseholdWorkbookExportModel } from "../../lib/explorer/householdWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
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
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { useHashState } from "../external/use-money-from-abroad-state";

const VIEWS: readonly HouseholdView[] = ["parts", "areas"];
const selectClass = "min-w-0 w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent py-2 text-[12px] text-[var(--ink)]";

export type HouseholdExplorerProps = {
  section: HouseholdSectionId; facts: ClientHouseholdFact[];
  /** Names of the section's lines; areaLabels names Georgia, towns, villages and the regions (the Compare areas lines). */
  labels: Record<string, string>; areaLabels: Record<HouseholdArea, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string;
};

export function HouseholdExplorer({ section, facts, labels: lineLabels, areaLabels, sources, siteOrigin }: HouseholdExplorerProps) {
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
  const latest = facts.filter(f => f.indicatorId === (section === "income" ? "income.total" : "spending.consumption") && f.areaId === "georgia" && f.measure === "per_household").sort((a, b) => a.year - b.year).at(-1)!;
  const title = t(`page.${section}.title`);
  const tabLabel = state.view === "parts" ? t(`tab.parts.${section}`) : t("tab.areas");
  const chartLabel = state.view === "parts" ? `${tabLabel} · ${areaLabels[state.area]}` : tabLabel;
  const changeView = (view: HouseholdView) => { if (view === state.view) return; setQuery(""); setExpanded({}); update(s => changeHouseholdView(s, section, view, facts), true); };
  const downloadAction = <ExcelDownloadButton testId="household-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildHouseholdWorkbookExportModel({ section, facts, state, labels, areaLabel: areaLabels[state.area], sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`household-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="household-latest" measure={t(`latest.${section}`)} period={latest.year} value={valueLabel(latest.value)} />
    <div data-testid="household-tabs" role="group" aria-label={t("tabs")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">
      {VIEWS.map(view => <TextTab key={view} label={view === "parts" ? t(`tab.parts.${section}`) : t("tab.areas")} active={state.view === view} testId={`household-tab-${view}`} onClick={() => changeView(view)} />)}
    </div>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit="gel" data-measure={state.measure} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
              <SegmentedTabs<HouseholdMeasure> ariaLabel={t("measureLabel")} value={state.measure} onChange={measure => update(s => changeHouseholdMeasure(s, section, measure, facts), true)} options={[
                { value: "per_household", label: t("measure.per_household"), testId: "household-measure-per_household" },
                { value: "per_capita", label: t("measure.per_capita"), testId: "household-measure-per_capita" },
              ]} />
            </div>
            {state.view === "parts" ? <label className="min-w-0 w-full text-[11px] min-[768px]:text-[10px] font-semibold text-[var(--muted)] min-[768px]:max-w-[260px]"><span className="sr-only">{t("areaLabel")}</span>
              <select data-testid="household-area" value={state.area} className={selectClass} onChange={event => update(s => changeHouseholdArea(s, section, event.target.value as HouseholdArea, facts), true)}>
                {HOUSEHOLD_AREAS.map(area => <option key={area} value={area}>{areaLabels[area]}</option>)}
              </select>
            </label> : <span className="text-[11px] text-[var(--muted)]">{unitLabel}</span>}
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
        {downloadAction}
      </SeriesAside>
    </ExplorerWorkspace>
  </div>;
}
