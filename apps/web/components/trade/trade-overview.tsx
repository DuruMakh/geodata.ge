"use client";
import Link from "next/link";
import { useState } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { type ClientTradeOverviewFact, type TradeChartIndicator } from "../../lib/data/tradeOverview/types";
import { buildTradeOverviewModel, TRADE_OVERVIEW_COLORS } from "../../lib/explorer/tradeOverview";
import { parseTradeOverviewHash, serializeTradeOverviewHash, tradeOverviewCoverage, tradeOverviewIndicators, type TradeOverviewState } from "../../lib/explorer/tradeOverviewState";
import { buildTradeOverviewWorkbookExportModel } from "../../lib/explorer/tradeOverviewWorkbook";
import { formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { useHashState, type HashStateOptions } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS, SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SectionTitle, SourceNote, SwatchBar } from "../ui/editorial";
import { toggleId } from "../../lib/explorer/selection";

// Inside Domestic exports and Services the hash also names the section, and each change tells the page which hash to keep for it.
const isDomestic = (facts: readonly ClientTradeOverviewFact[]) => facts.some(f => f.indicatorId === "trade.domestic_exports");
const serializeOverview = (state: TradeOverviewState, facts: readonly ClientTradeOverviewFact[]) => `${serializeTradeOverviewHash(state)}${isDomestic(facts) ? "&section=overview" : ""}`;
const serializeServicesOverview = (state: TradeOverviewState) => `${serializeTradeOverviewHash(state)}&section=overview`;
const OVERVIEW_OPTIONS: HashStateOptions<ClientTradeOverviewFact[], TradeOverviewState> = { afterWrite: facts => { if (isDomestic(facts)) window.dispatchEvent(new Event("trade-domestic-state")); } };
const SERVICES_OVERVIEW_OPTIONS: HashStateOptions<ClientTradeOverviewFact[], TradeOverviewState> = { afterWrite: () => window.dispatchEvent(new Event("trade-services-state")) };

export function TradeOverview({ facts, sources, lastReviewedAt, siteOrigin, dataset }: { dataset?: "services"; facts: ClientTradeOverviewFact[]; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string) => message(messages, `trade.${key}`);
  const indicators = tradeOverviewIndicators(facts), domestic = facts.some(f => f.indicatorId === "trade.domestic_exports"), totalId = indicators[0];
  const services = dataset === "services";
  const title = t(services ? "services.title" : domestic ? "domestic.title" : "title");
  const { state, update } = useHashState(facts, parseTradeOverviewHash, services ? serializeServicesOverview : serializeOverview, services ? SERVICES_OVERVIEW_OPTIONS : OVERVIEW_OPTIONS);
  const [query, setQuery] = useState("");
  const model = buildTradeOverviewModel(facts, state, presentation);
  const label = (id: TradeChartIndicator) => t(services ? `services.indicator.${id}` : domestic && id === "trade.exports" ? "domestic.totalExports" : `indicator.${id}`);
  const matches = (id: TradeChartIndicator) => matchesLabelQuery(query, [label(id)]);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${formatInUnit(value, model.unit)} ${model.unit.label}`;
  const rows = model.selectedIds.map(id => ({ itemId: id, kaLabel: label(id), color: TRADE_OVERVIEW_COLORS[id], valuesByYear: model.valuesByIndicator[id] }));
  const total = rows.find(row => row.itemId === totalId) ?? null;
  const downloadAction = <ExcelDownloadButton testId="trade-excel-download" disabled={!model.selectedIds.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildTradeOverviewWorkbookExportModel({ facts, state, sources, siteOrigin, dataset }, presentation));
  }} />;
  const lineSeries = model.selectedIds.map(id => ({ id, label: label(id), color: TRADE_OVERVIEW_COLORS[id], vals: model.years.map(year => model.valuesByIndicator[id][year]) }));
  return <div data-testid="trade-overview" className="@container">
    {!domestic && !services ? <ExplorerHeading>{title}</ExplorerHeading> : null}
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-unit="usd" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span className="text-[11px] text-[var(--muted)]">{model.unit.label}</span>
          </div>
          {!model.selectedIds.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t(domestic ? "domestic.emptySelection" : "emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={model.unit} shareLabel={t("title")} showAxisUnit={false} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${title} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== totalId)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={model.unit} formatValue={valueLabel} />
          <RangeStrip years={tradeOverviewCoverage(facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildTradeOverviewModel(facts, s, presentation).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(services ? "services.sourceNote" : "sourceNote")} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/trade", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote>{domestic ? <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("domestic.definitions")}</p> : null}</div>
      </div>
      <SeriesAside label={message(messages, "controls.series")}>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {model.unit.label}</p>
        <SeriesSelector query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={indicators.length > SEARCHABLE_MIN_ROWS} selectedCount={model.selectedIds.length} totalCount={indicators.length} hasSelection={model.selectedIds.length > 0} allSelected={model.selectedIds.length === indicators.length} onToggleAll={() => update(s => ({ ...s, selectedIds: s.selectedIds.length ? [] : [...indicators] }), true)} hasVisibleMatches={indicators.some(matches)}>
          {indicators.filter(id => id === totalId || matches(id)).map(id => <SeriesSelectorRow key={id} id={id} label={label(id)} color={TRADE_OVERVIEW_COLORS[id]} value={formatInUnit(model.endValues[id], model.unit)} selected={model.selectedIds.includes(id)} level={id === totalId ? "total" : "item"} wrapLabel onToggle={() => update(s => ({ ...s, selectedIds: toggleId(s.selectedIds, id) }), true)} />)}
        </SeriesSelector>
        {downloadAction}
      </SeriesAside>
    </ExplorerWorkspace>
    <section data-testid="trade-summary" data-end-year={model.range.end} className="mt-10 border-t-2 border-[var(--ink)] pt-5">
      <SectionTitle>{message(messages, "trade.summaryTitle", { year: model.range.end })}</SectionTitle>
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 min-[480px]:grid-cols-2 min-[1100px]:grid-cols-4">
        {indicators.map(id => <div key={id} data-indicator={id} className="min-w-0 border-t border-[var(--hairline)] pt-3">
          <dt className="flex items-start gap-2 text-[12px] text-[var(--muted)]"><span className="mt-2"><SwatchBar color={TRADE_OVERVIEW_COLORS[id]} /></span>{label(id)}</dt>
          <dd className="mt-2 font-[family-name:var(--font-numeric)] text-[24px] leading-tight text-[var(--ink)]">{formatInUnit(model.endValues[id], model.unit)}</dd>
          <dd className="mt-1 text-[11px] text-[var(--muted)]">{model.unit.label}</dd>
        </div>)}
      </dl>
    </section>
    {!domestic ? <section data-testid="trade-balance-context" className="mt-10 border-t-2 border-[var(--ink)] pt-5">
      <SectionTitle>{t(services ? "services.balanceTitle" : "balanceTitle")}</SectionTitle>
      <p className="mt-2 max-w-[900px] text-[12px] leading-relaxed text-[var(--muted)]">{t(services ? "services.balanceNote" : "balanceNote")}</p>
      <p className="my-4 text-[11px] text-[var(--muted)]">{model.unit.label} · {model.range.start}–{model.range.end}</p>
      <StackedColumnChart periods={model.years} periodsPerYear={1} segments={[{ id: "trade.balance", label: label("trade.balance"), color: TRADE_OVERVIEW_COLORS["trade.balance"], values: model.balanceValues.map(value => value === null ? null : value / model.unit.divisor) }]} overlay={null} formatPeriod={String} formatValue={value => valueLabel(value * model.unit.divisor)} ariaLabel={t(services ? "services.balanceAria" : "balanceAria")} frameLabel={label("trade.balance")} />
    </section> : null}
  </div>;
}
