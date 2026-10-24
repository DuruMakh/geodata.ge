"use client";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { TRADE_OVERVIEW_INDICATORS, type TradeChartIndicator } from "../../lib/data/tradeOverview/types";
import { buildTradePartnersModel, tradePartnerColor } from "../../lib/explorer/tradePartners";
import { tradePartnersTotalId, setTradePartnersTab, tradePartnersCoverage } from "../../lib/explorer/tradePartnersState";
import { buildTradePartnersWorkbookModel } from "../../lib/explorer/tradePartnersWorkbook";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { formatInUnit } from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { publicLabel } from "../../lib/i18n/labels";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { useI18n } from "../../lib/i18n/provider";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SourceNote, TabDivider, TextTab } from "../ui/editorial";
import { useTradePartnersState } from "./use-trade-partners-state";
import { TablePager, useTablePage } from "./table-pager";
import { TradePartnersSeriesPanel } from "./trade-partners-series-panel";
import { TradePartnersRanking } from "./trade-partners-ranking";

export function TradePartners({ data, sources, lastReviewedAt, siteOrigin, navigation, seriesControls }: { data: ClientTradePartnersData; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string; navigation?: (measure: TradeChartIndicator, changeMeasure: (next: TradeChartIndicator) => void) => ReactNode; seriesControls?: ReactNode }) {
  const services = data.dataset === "services", countries = services && data.dimension === "countries", composition = data.dataset === "composition", domestic = !services && !composition && Boolean(data.measures), embedded = services || domestic || composition;
  const totalId = tradePartnersTotalId(data);
  const presentation = useI18n(), { locale, messages, englishLabels } = presentation;
  const t = (key: string) => {
    if (countries && key === "series") return message(messages, "trade.partners.country");
    if (countries && key === "emptySelection") return message(messages, "trade.services.countryEmptySelection");
    const serviceKey = services && ["title", "total", "series", "emptySelection"].includes(key) && !(countries && key === "total");
    return message(messages, `trade.${composition ? "composition" : serviceKey ? "services" : "partners"}.${key}`);
  };
  const { state, update } = useTradePartnersState(data), model = buildTradePartnersModel(data, state, presentation);
  const entities = new Map(data.entities.map(entity => [entity.id, entity]));
  const label = (id: string) => id === totalId ? t("total") : publicLabel(locale, id, entities.get(id)!.labelKa, englishLabels);
  const measureLabel = message(messages, `trade.${composition ? "composition." : services ? "services." : ""}indicator.${state.measure}`);
  // The table pages 25 rows at a time, like Products: all 218 partners ticked was one 11,000px table (U21-17).
  const { page, pageCount, setPage, pageItems } = useTablePage(state.selectedIds, model.selectedIds.length);
  const rows = pageItems(model.selectedIds).map(id => ({ itemId: id, kaLabel: label(id), color: tradePartnerColor(id), valuesByYear: model.valuesByEntity[id] }));
  const total = rows.find(row => row.itemId === totalId) ?? null;
  const measureControls = <div role="group" aria-label={t("measure")} className={embedded ? "flex flex-wrap items-center gap-2 text-[12px]" : "mb-6 flex flex-wrap gap-x-5 gap-y-3"}>{(data.measures ?? TRADE_OVERVIEW_INDICATORS).map((id, index) => <Fragment key={id}>{embedded && index > 0 ? <TabDivider /> : null}<TextTab label={message(messages, `trade.${composition ? "composition." : services ? "services." : ""}indicator.${id}`)} active={state.measure === id} onClick={() => update(s => ({ ...s, measure: id }), true)} testId={`trade-partners-measure-${id}`} /></Fragment>)}</div>;
  const downloadAction = <ExcelDownloadButton testId="trade-partners-excel-download" disabled={!model.selectedCount} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildTradePartnersWorkbookModel({ data, state, sources, siteOrigin }, presentation));
  }} />;
  const valueLabel = (value: number) => `${formatInUnit(value, model.unit)} ${model.unit.label}`;
  const lineSeries = model.selectedIds.map(id => ({ id, label: label(id), color: tradePartnerColor(id), vals: model.years.map(year => model.valuesByEntity[id][year]) }));
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={false} unit={model.unit} shareLabel={measureLabel} showAxisUnit={false} formatTooltipValue={valueLabel} />;
  const shareAction = model.selectedCount ? <ChartShareButton title={t("title")} caption={`${measureLabel} · ${model.unit.label} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={message(messages, composition ? "trade.composition.sourceNote" : services ? "trade.services.sourceNote" : "trade.sourceNote")} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid="trade-partners" className="@container">
    {!embedded ? <ExplorerHeading>{t("title")}</ExplorerHeading> : null}
    {navigation ? navigation(state.measure, measure => update(s => ({ ...s, measure }), true)) : !embedded ? measureControls : null}
    {!composition && (state.tab === "groups" || model.selectedIds.some(id => entities.get(id)?.kind === "group")) ? <p data-testid="trade-partners-group-note" className="mb-4 max-w-[850px] border-l-2 border-[var(--accent)] pl-3 text-[12px] leading-relaxed text-[var(--muted)]">{t("groupOverlap")}</p> : null}
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-measure={state.measure} data-unit="usd" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} /><span className="text-[11px] text-[var(--muted)]">{measureLabel} · {model.unit.label}</span></div>
          {!model.selectedCount ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5">{chart}</div>
            : <><ExplorerTable caption={`${t("title")} · ${measureLabel} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== totalId)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />
              {pageCount > 1 ? <TablePager label={message(messages, "trade.partners.tablePages")} summary={`${message(messages, "trade.products.selected")} · ${model.selectedIds.length}`} page={page} pageCount={pageCount} onPage={setPage} previous={message(messages, "trade.products.previous")} next={message(messages, "trade.products.next")} testIdPrefix="trade-partners-table" /> : null}</>}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={model.unit} formatValue={valueLabel} />
          <RangeStrip years={tradePartnersCoverage(data).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildTradePartnersModel(data, s, presentation).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{message(messages, composition ? "trade.composition.sourceNote" : services ? "trade.services.sourceNote" : "trade.sourceNote")} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span><Link href={pageHref("/methodology/trade", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{message(messages, "trade.methodology")}</Link></SourceNote><p className="mt-2 max-w-[850px] text-[11px] leading-relaxed text-[var(--muted)]">{composition ? t("definitions") : services ? message(messages, countries ? "trade.services.countryDefinitions" : "trade.services.definitions") : domestic ? message(messages, "trade.domestic.countryDefinitions") : t("definitions")}</p></div>
      </div>
      <SeriesAside label={message(messages, "controls.series")}><TradePartnersSeriesPanel key={state.tab} data={data} state={state} model={model} onTabChange={tab => update(s => setTradePartnersTab(s, tab), true)} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)} measureControls={seriesControls ?? (navigation ? undefined : measureControls)} downloadAction={downloadAction} /></SeriesAside>
    </ExplorerWorkspace>
    <TradePartnersRanking key={`${state.tab}:${state.measure}:${model.range.end}`} model={model} tab={state.tab} measure={state.measure} services={services} />
  </div>;
}
