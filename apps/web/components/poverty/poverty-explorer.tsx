"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientPovertyFact } from "../../lib/data/poverty/types";
import { buildPovertyModel, changePovertyView, parsePovertyHash, povertyCoverage, povertyViews, serializePovertyHash, type PovertySectionId, type PovertyState, type PovertyView } from "../../lib/explorer/poverty";
import { buildPovertyWorkbookExportModel } from "../../lib/explorer/povertyWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SourceNote, TextTab } from "../ui/editorial";


export type PovertyExplorerProps = {
  section: PovertySectionId; facts: ClientPovertyFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

type PovertyHashData = { section: PovertySectionId; facts: ClientPovertyFact[] };
const parsePoverty = (hash: string, { section, facts }: PovertyHashData) => parsePovertyHash(hash, section, facts);
const serializePoverty = (state: PovertyState, { section }: PovertyHashData) => serializePovertyHash(state, section);

export function PovertyExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin }: PovertyExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `poverty.${key}`, values);
  const povertyHashData = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(povertyHashData, parsePoverty, serializePoverty);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const model = buildPovertyModel(section, facts, state);
  // Rates are percents of the population; the Gini coefficient is a 0–1 index.
  const percent = section === "rates";
  const unit: ValueUnit = { divisor: 1, label: percent ? t("unitPercent") : "", decimals: model.decimals };
  const unitLabel = percent ? t("unitPercentLong") : t("unitIndex");
  const format = (value: number | null | undefined) => formatInUnit(value, unit);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${format(value)}${unit.label}`;
  const reference = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const total = rows.find(row => row.itemId === reference.id) ?? null;
  // The latest-value line names the active tab's reference series (DESIGN §17): Georgia's poverty-line,
  // relative or $3.00 rate, or the Gini coefficient by total income, at that series' own latest year.
  const latest = facts.filter(f => f.indicatorId === reference.indicatorId && f.groupId === reference.groupId).sort((a, b) => a.year - b.year).at(-1)!;
  const latestKey = state.view === "relative" || state.view === "international" ? state.view : section;
  const title = t(`page.${section}.title`);
  const tabLabel = state.view === "main" ? title : t(`tab.${state.view}`);
  const changeView = (view: PovertyView) => { if (view === state.view) return; setQuery(""); setExpanded({}); update(s => changePovertyView(s, section, view, facts), true); };
  const downloadAction = <ExcelDownloadButton testId="poverty-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildPovertyWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  return <div data-testid={`poverty-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="poverty-latest" measure={t(`latest.${latestKey}`)} period={latest.year} value={valueLabel(latest.value)} />
    {povertyViews(section).length > 1 ? <div data-testid="poverty-tabs" role="group" aria-label={t("tabs")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">
      {povertyViews(section).map(view => <TextTab key={view} label={t(`tab.${view}`)} active={state.view === view} testId={`poverty-tab-${view}`} onClick={() => changeView(view)} />)}
    </div> : null}
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit={percent ? "percent" : "index"} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={percent} unit={unit} shareLabel={tabLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${tabLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={percent} showChangeColumn={false} shareValueForYear={(row, year) => { const value = row.valuesByYear[year]; return value == null ? null : value / 100; }} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={povertyCoverage(section, state.view, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildPovertyModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(state.view === "international" ? "sourceNoteInternational" : "sourceNote")} · {unitLabel} · {model.range.start}–{model.range.end} · {lastReviewedAt}
          <Link href={pageHref("/methodology/poverty", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Groups nest under their Georgia line (as on the Wages overview). */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{model.range.end} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: format(series.endValue), parentId: series.parentId }))}
        totalId={model.series.find(series => series.reference)?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS}
        nesting={{ selectedLabel: t("nestedSelected"), expansionLabel: label => t("subcategoriesFor", { label }), expanded, onExpandedChange: setExpanded }} />
    </ExplorerWorkspace>
  </div>;
}
