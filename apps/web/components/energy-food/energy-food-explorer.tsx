"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ClientEnergyFoodFact } from "../../lib/data/energyFood/types";
import { buildEnergyFoodModel, energyFoodCoverage, energyFoodUnit, parseEnergyFoodHash, serializeEnergyFoodHash, type EnergyFoodSectionId, type EnergyFoodSeriesModel, type EnergyFoodState } from "../../lib/explorer/energyFood";
import { buildEnergyFoodWorkbookExportModel } from "../../lib/explorer/energyFoodWorkbook";
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
import { useAppReady } from "../explorer-shell/use-app-ready";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS, SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

function useEnergyFoodState(section: EnergyFoodSectionId, facts: ClientEnergyFoodFact[]) {
  const [state, setState] = useState(() => parseEnergyFoodHash("", section, facts));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parseEnergyFoodHash(window.location.hash, section, facts); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [section, facts]);
  useAppReady();
  const update = useCallback((change: (previous: EnergyFoodState) => EnergyFoodState, push = false) => {
    const next = change(current.current); current.current = next;
    const hash = `#${serializeEnergyFoodHash(next, section)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the view still updates. */ }
    }
    setState(next);
  }, [section]);
  return { state, update };
}

export type EnergyFoodExplorerProps = {
  section: EnergyFoodSectionId; facts: ClientEnergyFoodFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

export function EnergyFoodExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin }: EnergyFoodExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `energyFood.${key}`, values);
  const { state, update } = useEnergyFoodState(section, facts);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const model = buildEnergyFoodModel(section, facts, state);
  // Energy is in thousand tonnes of oil equivalent or GWh; food is a self-sufficiency percent, drawn on a percent axis.
  const unitKind = energyFoodUnit(section), percent = unitKind === "percent";
  const unit: ValueUnit = { divisor: 1, label: unitKind === "gwh" ? t("unit.gwh") : "", decimals: model.decimals };
  const unitLabel = t(`unit.${unitKind}Long`);
  const format = (value: number | null | undefined, decimals = model.decimals) => formatInUnit(value, { ...unit, decimals });
  const suffix = percent ? "%" : unit.label ? ` ${unit.label}` : "";
  const valueLabel = (value: number | null | undefined, decimals?: number) => value == null ? "—" : `${format(value, decimals)}${suffix}`;
  const matches = (id: string) => matchesLabelQuery(query, [labels[id]]);
  const reference = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const total = rows.find(row => row.itemId === reference.id) ?? null;
  const allIds = model.series.map(series => series.id);
  // Breakdowns nest under their total: the count and bulk action cover the top-level rows, nested ticks are counted apart.
  const topIds = model.series.filter(series => !series.parentId).map(series => series.id);
  const selectedTop = topIds.filter(id => state.selectedIds.includes(id)).length;
  const toggleSeries = (id: string) => update(s => ({ ...s, selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter(item => item !== id) : allIds.filter(item => item === id || s.selectedIds.includes(item)) }), true);
  const hasNesting = model.series.some(series => series.parentId);
  function renderRow(series: EnergyFoodSeriesModel): ReactNode {
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
  // The latest-value line is the page's total in its latest year; supply and electricity add that year's imports (and exports).
  const factFor = (id: string, year: number) => facts.find(f => f.indicatorId === id && f.year === year);
  const latest = facts.filter(f => f.indicatorId === reference.id).sort((a, b) => a.year - b.year).at(-1)!;
  const plain = (id: string) => { const fact = factFor(id, latest.year); return format(fact?.value, fact?.decimals); };
  const note = section === "energy-supply" ? t("latestNote.energy-supply", { value: plain("energy.imports.total") })
    : section === "electricity" ? t("latestNote.electricity", { imports: plain("electricity.imports"), exports: plain("electricity.exports") }) : undefined;
  const title = t(`page.${section}.title`);
  const downloadAction = <ExcelDownloadButton testId="energy-food-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildEnergyFoodWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`energy-food-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="energy-food-latest" measure={t(`latest.${section}`)} period={latest.year} value={valueLabel(latest.value, latest.decimals)} note={note} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-unit={unitKind} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            <span className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]), planned: model.years.map(() => false) }))} share={percent} unit={unit} shareLabel={title} formatTooltipValue={value => valueLabel(value)} /></div>
            // Food ratios are whole numbers as Geostat prints them, so table cells stay in the unit rather than the one-decimal share format; the caption names the percent.
            : <ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <RangeStrip years={energyFoodCoverage(section, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildEnergyFoodModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(percent ? "sourceNote.food" : "sourceNote.energy")} · {unitLabel} · {model.range.start}–{model.range.end} · {lastReviewedAt}
          <Link href={pageHref("/methodology/energy-food", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
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
