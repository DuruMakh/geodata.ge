"use client";
import Link from "next/link";
import type { ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { TRADE_OVERVIEW_INDICATORS } from "../../lib/data/tradeOverview/types";
import { buildTradePartnersModel, tradePartnerColor } from "../../lib/explorer/tradePartners";
import { TRADE_PARTNER_TOTAL_ID, setTradePartnersTab, tradePartnersCoverage } from "../../lib/explorer/tradePartnersState";
import { buildTradePartnersWorkbookModel } from "../../lib/explorer/tradePartnersWorkbook";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { formatInUnit } from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { publicLabel } from "../../lib/i18n/labels";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { useTradePartnersState } from "./use-trade-partners-state";
import { TradePartnersSeriesPanel } from "./trade-partners-series-panel";
import { TradePartnersRanking } from "./trade-partners-ranking";

export function TradePartners({ data, sources, lastReviewedAt, siteOrigin }: { data: ClientTradePartnersData; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const presentation = useI18n(), { locale, messages, englishLabels } = presentation;
  const t = (key: string) => message(messages, `trade.partners.${key}`);
  const { state, update } = useTradePartnersState(data), model = buildTradePartnersModel(data, state, presentation);
  const entities = new Map(data.entities.map(entity => [entity.id, entity]));
  const label = (id: string) => id === TRADE_PARTNER_TOTAL_ID ? t("total") : publicLabel(locale, id, entities.get(id)!.labelKa, englishLabels);
  const measureLabel = message(messages, `trade.indicator.${state.measure}`);
  const scale = t(model.unit.divisor === 1_000_000_000 ? "scale.billion" : "scale.million");
  const rows = model.selectedIds.map(id => ({ itemId: id, kaLabel: label(id), color: tradePartnerColor(id), valuesByYear: model.valuesByEntity[id] }));
  const total = rows.find(row => row.itemId === TRADE_PARTNER_TOTAL_ID) ?? null;
  const downloadAction = <ExcelDownloadButton testId="trade-partners-excel-download" disabled={!model.selectedCount} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildTradePartnersWorkbookModel({ data, state, sources, siteOrigin }, presentation));
  }} />;
  return <div data-testid="trade-partners" className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <p className="mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{message(messages, "trade.partners.summaryWithScale", { scale })}</p>
    <div role="group" aria-label={t("measure")} className="mb-6 flex flex-wrap gap-x-5 gap-y-3">{TRADE_OVERVIEW_INDICATORS.map(id => <TextTab key={id} label={message(messages, `trade.indicator.${id}`)} active={state.measure === id} onClick={() => update(s => ({ ...s, measure: id }), true)} testId={`trade-partners-measure-${id}`} />)}</div>
    {state.tab === "groups" || model.selectedIds.some(id => entities.get(id)?.kind === "group") ? <p data-testid="trade-partners-group-note" className="mb-4 max-w-[850px] border-l-2 border-[var(--accent)] pl-3 text-[12px] leading-relaxed text-[var(--muted)]">{t("groupOverlap")}</p> : null}
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-measure={state.measure} data-unit="usd" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} /><span className="text-[11px] text-[var(--muted)]">{measureLabel} · {model.unit.label}</span></div>
          {!model.selectedCount ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selectedIds.map(id => ({ id, label: label(id), color: tradePartnerColor(id), vals: model.years.map(year => model.valuesByEntity[id][year]), planned: model.years.map(() => false) }))} share={false} unit={model.unit} shareLabel={measureLabel} showAxisUnit={false} formatTooltipValue={value => `${formatInUnit(value, model.unit)} ${model.unit.label}`} /></div>
            : <ExplorerTable caption={`${t("title")} · ${measureLabel} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== TRADE_PARTNER_TOTAL_ID)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <RangeStrip years={tradePartnersCoverage(data).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildTradePartnersModel(data, s, presentation).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{message(messages, "trade.sourceNote")} · {model.range.start}–{model.range.end} · {lastReviewedAt}<Link href={pageHref("/methodology/trade", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{message(messages, "trade.methodology")}</Link></SourceNote><p className="mt-2 max-w-[850px] text-[11px] leading-relaxed text-[var(--muted)]">{t("definitions")}</p></div>
      </div>
      <SeriesAside label={message(messages, "controls.series")}><TradePartnersSeriesPanel key={state.tab} data={data} state={state} model={model} onTabChange={tab => update(s => setTradePartnersTab(s, tab), true)} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)} downloadAction={downloadAction} /></SeriesAside>
    </ExplorerWorkspace>
    <TradePartnersRanking key={`${state.tab}:${state.measure}:${model.range.end}`} model={model} tab={state.tab} measure={state.measure} />
  </div>;
}
