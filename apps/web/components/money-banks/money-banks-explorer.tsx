"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChartPie, CircleDollarSign } from "lucide-react";
import type { ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import type { ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { buildMoneyBanksModel, changeMoneyBanksView, moneyBanksCoverage, moneyBanksHasTotalRow, moneyBanksViewFacts, moneyBanksViews, moneyBanksViewSeries, parseMoneyBanksHash, serializeMoneyBanksHash, type MoneyBanksSectionId, type MoneyBanksSeriesModel, type MoneyBanksState, type MoneyBanksView } from "../../lib/explorer/moneyBanks";
import { buildMoneyBanksWorkbookExportModel } from "../../lib/explorer/moneyBanksWorkbook";
import { formatAmount, formatInUnit, unitFor, unitsFor, type ValueUnit } from "../../lib/explorer/format";
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
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS, SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

type MoneyBanksHashData = { section: MoneyBanksSectionId; facts: ClientMoneyBanksFact[]; gdpFacts: ClientNationalGdpFact[] };
const parseMoneyBanksState = (hash: string, data: MoneyBanksHashData) => parseMoneyBanksHash(hash, data.section, data.facts, data.gdpFacts);
const serializeMoneyBanksState = (state: MoneyBanksState, data: MoneyBanksHashData) => serializeMoneyBanksHash(state, data.section);

function useMoneyBanksState(section: MoneyBanksSectionId, facts: ClientMoneyBanksFact[], gdpFacts: ClientNationalGdpFact[]) {
  const data = useMemo(() => ({ section, facts, gdpFacts }), [section, facts, gdpFacts]);
  return useHashState(data, parseMoneyBanksState, serializeMoneyBanksState);
}

export type MoneyBanksExplorerProps = {
  section: MoneyBanksSectionId; facts: ClientMoneyBanksFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  /** National GDP and its Geostat files, for the % of GDP view (Money supply only; empty elsewhere). */
  gdpFacts: ClientNationalGdpFact[]; gdpSources: WorkbookPublicSource[];
  lastReviewedAt: string; siteOrigin: string;
};

export function MoneyBanksExplorer({ section, facts, labels, sources, gdpFacts, gdpSources, lastReviewedAt, siteOrigin }: MoneyBanksExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `moneyBanks.${key}`, values);
  const { state, update } = useMoneyBanksState(section, facts, gdpFacts);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const model = buildMoneyBanksModel(section, facts, state, gdpFacts);
  // Each view has one unit. Amounts share the site's billion-GEL scale, its decimals read from every value the view can show;
  // percents keep each series' own precision (two decimals for the National Bank rate, one elsewhere).
  const percent = model.unit === "percent";
  const viewIds = new Set<string>(model.series.map(series => series.id));
  const unit: ValueUnit = percent ? { divisor: 1, label: t("unitPercent"), decimals: 1 } : unitFor(facts.filter(f => viewIds.has(f.indicatorId)).map(f => f.value), unitsFor(locale).bn);
  const unitLabel = percent ? t("unitPercent") : message(messages, "format.bnGel");
  const decimalsOf = (id: string) => model.series.find(series => series.id === id)?.decimals ?? 1;
  const format = (value: number | null | undefined, id: string) => formatInUnit(value, percent ? { divisor: 1, label: "", decimals: decimalsOf(id) } : unit);
  const valueLabel = (value: number | null | undefined, id: string) => value == null ? "—" : percent ? `${format(value, id)}${unitLabel}` : `${format(value, id)} ${unitLabel}`;
  const matches = (id: string) => matchesLabelQuery(query, [labels[id]]);
  const reference = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const total = moneyBanksHasTotalRow(section) ? rows.find(row => row.itemId === reference.id) ?? null : null;
  const allIds = model.series.map(series => series.id);
  // Parts nest under their total (as on Poverty): the count and bulk action cover the top-level rows, nested ticks are counted apart.
  const topIds = model.series.filter(series => !series.parentId).map(series => series.id);
  const selectedTop = topIds.filter(id => state.selectedIds.includes(id)).length;
  const toggleSeries = (id: string) => update(s => ({ ...s, selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter(item => item !== id) : allIds.filter(item => item === id || s.selectedIds.includes(item)) }), true);
  const hasNesting = model.series.some(series => series.parentId);
  function renderRow(series: MoneyBanksSeriesModel): ReactNode {
    const nested = model.series.filter(child => child.parentId === series.id);
    if (!series.reference && !matches(series.id) && !nested.some(child => matches(child.id))) return null;
    const open = Boolean(query.trim()) && nested.some(child => matches(child.id)) || (expanded[series.id] ?? nested.some(child => state.selectedIds.includes(child.id)));
    return <div key={series.id} className={series.parentId ? "ml-4" : undefined}>
      <SeriesSelectorRow id={series.id} label={labels[series.id]} color={series.color} value={format(series.endValue, series.id)} selected={state.selectedIds.includes(series.id)} level={series.reference ? "total" : "item"} parentId={series.parentId} isChild={Boolean(series.parentId)} childLabelSize="standard" wrapLabel
        showCaretColumn={hasNesting} hasChildren={nested.length > 0} expanded={open} expansionLabel={t("subcategoriesFor", { label: labels[series.id] })}
        onToggleExpanded={() => setExpanded(previous => ({ ...previous, [series.id]: !open }))} onToggle={() => toggleSeries(series.id)} />
      {open ? nested.map(renderRow) : null}
    </div>;
  }
  // The latest-value line is the page's headline: the first series of the current view, in that series' own unit. A share
  // view names its series, so touch readers, who get no tooltip, see which measure the switch selected (DESIGN §7.2a).
  const views = moneyBanksViews(section);
  const headline = moneyBanksViewSeries(section, state.view)[0].id;
  const latest = moneyBanksViewFacts(state.view, facts, gdpFacts).filter(f => f.indicatorId === headline).sort((a, b) => a.year - b.year).at(-1)!;
  const measureLabel = state.view === views[0] ? t(`latest.${section}`) : state.view === "gdp" ? t("latest.gdp") : labels[headline];
  // % of GDP divides by the debt page's GDP: the source line names it and its preliminary years, as on the debt page.
  const preliminaryGdpYears = state.view === "gdp" ? model.years.filter(year => gdpFacts.some(f => f.year === year && f.status === "preliminary")) : [];
  const latestValue = latest.unit === "gel" ? formatAmount(latest.value, locale) : `${formatInUnit(latest.value, { divisor: 1, label: "", decimals: latest.decimals })}${t("unitPercent")}`;
  const title = t(`page.${section}.title`);
  const tabLabel = state.view === "main" ? title : t(`tab.${state.view}`);
  // Money supply and Loans and deposits switch between their amounts and a share with the icon measure switch (DESIGN §7.2a), not tabs.
  const changeView = (view: MoneyBanksView) => { if (view === state.view) return; setQuery(""); setExpanded({}); update(s => changeMoneyBanksView(s, section, view, facts, gdpFacts), true); };
  const downloadAction = <ExcelDownloadButton testId="money-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildMoneyBanksWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title, gdpFacts, gdpSources }, presentation));
  }} />;
  return <div data-testid={`money-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="money-latest" measure={measureLabel} period={latest.year} value={latestValue} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className={`flex flex-wrap ${views.length > 1 ? "items-center" : "items-end"} justify-between gap-3`}>
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            <div className="flex items-center gap-3.5">
              <span data-testid="money-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
              {views.length > 1 ? <SegmentedTabs ariaLabel={t("measure")} value={state.view} onChange={changeView} options={views.map(view => ({
                value: view, label: t(`tab.${view}`), testId: `money-measure-${view}`,
                icon: view === "amount" ? <span aria-hidden="true" className="text-base">₾</span> : view === "gdp" ? <ChartPie aria-hidden="true" size={18} strokeWidth={1.5} /> : <CircleDollarSign aria-hidden="true" size={18} strokeWidth={1.5} />,
              }))} /> : null}
            </div>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]), planned: model.years.map(() => false) }))} share={percent} unit={unit} shareLabel={tabLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${tabLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={percent} showChangeColumn={false}
              shareValueForYear={(row, year) => { const value = row.valuesByYear[year]; return value == null ? null : value / 100; }} shareDecimalsForRow={row => decimalsOf(row.itemId)} />}
          <RangeStrip years={moneyBanksCoverage(section, state.view, facts, gdpFacts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildMoneyBanksModel(section, facts, s, gdpFacts).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")}
          {state.view === "gdp" ? <> · {message(messages, "main.gdpSource")}{preliminaryGdpYears.length ? ` ${message(messages, "main.preliminaryGdp", { years: preliminaryGdpYears.join(", ") })}` : null}</> : null}
          {" · "}{unitLabel} · {model.range.start}–{model.range.end} · {lastReviewedAt}
          <Link href={pageHref("/methodology/money", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
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
