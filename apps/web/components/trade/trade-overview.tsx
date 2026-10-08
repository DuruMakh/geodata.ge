"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TRADE_OVERVIEW_INDICATORS, type ClientTradeOverviewFact, type TradeOverviewIndicator } from "../../lib/data/tradeOverview/types";
import { buildTradeOverviewModel, TRADE_OVERVIEW_COLORS } from "../../lib/explorer/tradeOverview";
import { parseTradeOverviewHash, serializeTradeOverviewHash, tradeOverviewCoverage, type TradeOverviewState } from "../../lib/explorer/tradeOverviewState";
import { buildTradeOverviewWorkbookExportModel } from "../../lib/explorer/tradeOverviewWorkbook";
import { formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SectionTitle, SegmentedTabs, SourceNote, SwatchBar } from "../ui/editorial";

function useTradeOverviewState(facts: ClientTradeOverviewFact[]) {
  const [state, setState] = useState(() => parseTradeOverviewHash("", facts));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parseTradeOverviewHash(window.location.hash, facts); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [facts]);
  useAppReady();
  const update = useCallback((change: (previous: TradeOverviewState) => TradeOverviewState, push = false) => {
    const next = change(current.current); current.current = next;
    const hash = `#${serializeTradeOverviewHash(next)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the view still updates. */ }
    }
    setState(next);
  }, []);
  return { state, update };
}

export function TradeOverview({ facts, sources, lastReviewedAt, siteOrigin }: { facts: ClientTradeOverviewFact[]; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string) => message(messages, `trade.${key}`);
  const { state, update } = useTradeOverviewState(facts);
  const [query, setQuery] = useState("");
  const model = buildTradeOverviewModel(facts, state, presentation);
  const label = (id: TradeOverviewIndicator) => t(`indicator.${id}`);
  const matches = (id: TradeOverviewIndicator) => matchesLabelQuery(query, [label(id)]);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${formatInUnit(value, model.unit)} ${model.unit.label}`;
  const rows = model.selectedIds.map(id => ({ itemId: id, kaLabel: label(id), color: TRADE_OVERVIEW_COLORS[id], valuesByYear: model.valuesByIndicator[id] }));
  const total = rows.find(row => row.itemId === "trade.turnover") ?? null;
  const downloadAction = <ExcelDownloadButton testId="trade-excel-download" disabled={!model.selectedIds.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildTradeOverviewWorkbookExportModel({ facts, state, sources, siteOrigin }, presentation));
  }} />;
  return <div data-testid="trade-overview" className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <p className="mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("summary")}</p>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-unit="usd" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            <span className="text-[11px] text-[var(--muted)]">{model.unit.label}</span>
          </div>
          {!model.selectedIds.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selectedIds.map(id => ({ id, label: label(id), color: TRADE_OVERVIEW_COLORS[id], vals: model.years.map(year => model.valuesByIndicator[id][year]), planned: model.years.map(() => false) }))} share={false} unit={model.unit} shareLabel={t("title")} axisLeftPadding={180} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${t("title")} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== "trade.turnover")} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <RangeStrip years={tradeOverviewCoverage(facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildTradeOverviewModel(facts, s, presentation).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} · {model.range.start}–{model.range.end} · {lastReviewedAt}
          <Link href={pageHref("/methodology/trade", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      <SeriesAside label={message(messages, "controls.series")}>
        <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {model.unit.label}</p>
        <SeriesSelector query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} selectedCount={model.selectedIds.length} totalCount={4} hasSelection={model.selectedIds.length > 0} allSelected={model.selectedIds.length === 4} onToggleAll={() => update(s => ({ ...s, selectedIds: s.selectedIds.length ? [] : [...TRADE_OVERVIEW_INDICATORS] }), true)} hasVisibleMatches={TRADE_OVERVIEW_INDICATORS.some(matches)}>
          {TRADE_OVERVIEW_INDICATORS.filter(id => id === "trade.turnover" || matches(id)).map(id => <SeriesSelectorRow key={id} id={id} label={label(id)} color={TRADE_OVERVIEW_COLORS[id]} value={formatInUnit(model.endValues[id], model.unit)} selected={model.selectedIds.includes(id)} level={id === "trade.turnover" ? "total" : "item"} wrapLabel onToggle={() => update(s => ({ ...s, selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter(selected => selected !== id) : [...s.selectedIds, id] }), true)} />)}
        </SeriesSelector>
        {downloadAction}
      </SeriesAside>
    </ExplorerWorkspace>
    <section data-testid="trade-summary" data-end-year={model.range.end} className="mt-10 border-t-2 border-[var(--ink)] pt-5">
      <SectionTitle>{message(messages, "trade.summaryTitle", { year: model.range.end })}</SectionTitle>
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 min-[480px]:grid-cols-2 min-[1100px]:grid-cols-4">
        {TRADE_OVERVIEW_INDICATORS.map(id => <div key={id} data-indicator={id} className="min-w-0 border-t border-[var(--hairline)] pt-3">
          <dt className="flex items-start gap-2 text-[12px] text-[var(--muted)]"><span className="mt-2"><SwatchBar color={TRADE_OVERVIEW_COLORS[id]} /></span>{label(id)}</dt>
          <dd className="mt-2 font-[family-name:var(--font-numeric)] text-[24px] leading-tight text-[var(--ink)]">{formatInUnit(model.endValues[id], model.unit)}</dd>
          <dd className="mt-1 text-[11px] text-[var(--muted)]">{model.unit.label}</dd>
        </div>)}
      </dl>
    </section>
    <section data-testid="trade-balance-context" className="mt-10 border-t-2 border-[var(--ink)] pt-5">
      <SectionTitle>{t("balanceTitle")}</SectionTitle>
      <p className="mt-2 max-w-[900px] text-[12px] leading-relaxed text-[var(--muted)]">{t("balanceNote")}</p>
      <p className="my-4 text-[11px] text-[var(--muted)]">{model.unit.label} · {model.range.start}–{model.range.end}</p>
      <StackedColumnChart periods={model.years} segments={[{ id: "trade.balance", label: label("trade.balance"), color: TRADE_OVERVIEW_COLORS["trade.balance"], values: model.balanceValues.map(value => value === null ? null : value / model.unit.divisor) }]} overlay={null} formatPeriod={String} formatValue={value => valueLabel(value * model.unit.divisor)} ariaLabel={t("balanceAria")} />
    </section>
  </div>;
}
