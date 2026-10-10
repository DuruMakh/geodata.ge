"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_MEASURES } from "../../lib/data/tradeProducts/types";
import { buildTradeProductsModel, tradeProductColor, tradeProductLabel } from "../../lib/explorer/tradeProducts";
import { TRADE_PRODUCT_TOTAL_ID } from "../../lib/explorer/tradeProductsState";
import { buildTradeProductsWorkbookModel } from "../../lib/explorer/tradeProductsWorkbook";
import { formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { publicLabel } from "../../lib/i18n/labels";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { Callout, SegmentedTabs, SourceNote, SwatchBar, TextTab } from "../ui/editorial";
import { TradePartnersRanking } from "./trade-partners-ranking";
import { TradeProductsPicker } from "./trade-products-picker";
import { useTradeProductsState } from "./use-trade-products-state";

export function TradeProducts({ data, sources, lastReviewedAt, siteOrigin }: { data: ClientTradeProductsData; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const presentation = useI18n(), { locale, messages, englishLabels } = presentation;
  const t = (key: string) => message(messages, `trade.products.${key}`);
  const { state, selectionReset, update } = useTradeProductsState(data);
  const model = useMemo(() => buildTradeProductsModel(data, state, presentation), [data, state, presentation]);
  const entities = useMemo(() => new Map(data.entities.map(entity => [entity.id, entity])), [data]);
  const labels = useMemo(() => new Map([[TRADE_PRODUCT_TOTAL_ID, message(messages, "trade.partners.total")], ...data.entities.map(entity => [entity.id, tradeProductLabel(entity, presentation)] as const)]), [data, presentation, messages]);
  const [picker, setPicker] = useState<{ view: "categories" | "selected"; opener: HTMLElement } | null>(null);
  const [paging, setPaging] = useState<{ selection: readonly string[]; page: number }>({ selection: [], page: 0 });
  useEffect(() => {
    const close = () => setPicker(null);
    window.addEventListener("popstate", close); window.addEventListener("hashchange", close);
    return () => { window.removeEventListener("popstate", close); window.removeEventListener("hashchange", close); };
  }, []);
  const measureLabel = message(messages, `trade.indicator.${state.measure}`);
  const pageCount = Math.ceil(model.selectedCount / 25), page = Math.min(paging.selection === state.selectedIds ? paging.page : 0, Math.max(0, pageCount - 1));
  const pageIds = model.selectedIds.slice(page * 25, (page + 1) * 25);
  const rows = pageIds.map(id => ({ itemId: id, kaLabel: labels.get(id)!, color: tradeProductColor(id), valuesByYear: model.valuesByEntity[id] }));
  const total = rows.find(row => row.itemId === TRADE_PRODUCT_TOTAL_ID) ?? null;
  const chart = useMemo(() => <EditorialLineChart years={model.years} series={model.selectedIds.map(id => ({ id, label: labels.get(id)!, color: tradeProductColor(id), vals: model.years.map(year => model.valuesByEntity[id][year]), planned: model.years.map(() => false) }))} share={false} unit={model.unit} shareLabel={measureLabel} showAxisUnit={false} formatTooltipValue={value => `${formatInUnit(value, model.unit)} ${model.unit.label}`} />, [model, labels, measureLabel]);
  return <div data-testid="trade-products" className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <p className="mb-4 text-[13px] leading-relaxed text-[var(--body)]">{t("summary")}</p>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label={t("measure")} className="flex items-center gap-5">{TRADE_PRODUCT_MEASURES.map(id => <TextTab key={id} label={message(messages, `trade.indicator.${id}`)} active={state.measure === id} onClick={() => update(previous => ({ ...previous, measure: id }), true)} testId={`trade-products-measure-${id}`} />)}</div>
      <button type="button" data-testid="trade-products-add" onClick={event => setPicker({ view: "categories", opener: event.currentTarget })} className="flex min-h-11 cursor-pointer items-center gap-2 border border-[var(--control)] px-3 text-[0.8125rem] font-medium hover:bg-[var(--tint)]"><Plus size={16} aria-hidden />{t("add")}</button>
    </div>
    {selectionReset ? <p role="status" data-testid="trade-products-selection-reset" className="mb-3 text-xs text-[var(--accent)]">{t("selectionReset")}</p> : null}
    <section data-testid="chart-panel" data-mode={state.mode} data-measure={state.measure} data-unit="usd" data-selected-count={model.selectedCount} className="border-t border-[var(--ink)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(previous => ({ ...previous, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
        <div className="flex flex-wrap items-center gap-3"><span data-testid="trade-products-unit" className="text-[11px] text-[var(--muted)]">{measureLabel} · {model.unit.label}</span><ExcelDownloadButton compact testId="trade-products-excel-download" disabled={!model.selectedCount} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildTradeProductsWorkbookModel({ data, state, sources, siteOrigin }, presentation));
        }} /></div>
      </div>
      {!model.selectedCount ? <div className="my-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
        : state.mode === "line" ? <div className="mt-4" data-testid="trade-products-plot">{chart}</div>
        : <div data-testid="trade-products-table" data-page={page + 1}><ExplorerTable caption={`${t("title")} · ${measureLabel} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== TRADE_PRODUCT_TOTAL_ID)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />
          <nav aria-label={t("tablePages")} className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]"><span>{t("selected")} · {model.selectedCount} · {page + 1} / {pageCount}</span>{pageCount > 1 ? <div className="flex gap-5"><button type="button" data-testid="trade-products-table-previous" disabled={page === 0} onClick={() => setPaging({ selection: state.selectedIds, page: page - 1 })} className="min-h-11 cursor-pointer disabled:opacity-35">{t("previous")}</button><button type="button" data-testid="trade-products-table-next" disabled={page + 1 === pageCount} onClick={() => setPaging({ selection: state.selectedIds, page: page + 1 })} className="min-h-11 cursor-pointer disabled:opacity-35">{t("next")}</button></div> : null}</nav>
        </div>}
      <div data-testid="trade-products-selection" className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-tight">
        {model.selectedIds.slice(0, 4).map((id, index) => {
          const entity = entities.get(id), name = entity ? publicLabel(locale, id, entity.labelKa, englishLabels) : labels.get(id)!;
          return <button key={id} type="button" data-testid="trade-products-selected-label" data-series-id={id} title={labels.get(id)} aria-label={`${t("remove")} ${labels.get(id)}`} onClick={() => update(previous => ({ ...previous, selectedIds: previous.selectedIds.filter(value => value !== id) }), true)} className={`${index >= 2 ? "hidden min-[768px]:flex" : "flex"} h-9 max-w-[230px] cursor-pointer items-center gap-1.5 border border-[var(--control)] px-2 min-[768px]:h-7 hover:bg-[var(--tint)]`}>
            <SwatchBar color={tradeProductColor(id)} /><span className="min-w-0 truncate">{name}</span>{entity ? <span className="shrink-0 whitespace-nowrap text-[10px] text-[var(--muted)]">{entity.code} · {entity.sourceBlock.replace("-", "–")}</span> : null}<X size={12} className="shrink-0" aria-hidden />
          </button>;
        })}
        {model.selectedCount > 2 ? <button type="button" data-testid="trade-products-more" onClick={event => setPicker({ view: "selected", opener: event.currentTarget })} className={`${model.selectedCount <= 4 ? "min-[768px]:hidden" : ""} h-9 cursor-pointer px-1 text-[var(--accent)] min-[768px]:h-7`}><span className="min-[768px]:hidden">+{model.selectedCount - 2}</span><span className="hidden min-[768px]:inline">+{model.selectedCount - 4}</span> {t("more")}</button> : null}
      </div>
      <RangeStrip years={data.years.filter(year => year >= model.range.min && year <= model.range.max)} range={model.range} onChange={patch => update(previous => ({ ...previous, range: rangeFromPatch(model.range, patch) }))} />
    </section>
    <div className="mt-[18px]"><SourceNote testId="source-label">{message(messages, "trade.sourceNote")} · {model.range.start}–{model.range.end} · {lastReviewedAt}<Link href={pageHref("/methodology/trade", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{message(messages, "trade.methodology")}</Link></SourceNote><p className="mt-2 max-w-[850px] text-[11px] leading-relaxed text-[var(--muted)]">{t("historicalNote")} {t("definitions")}</p></div>
    <TradePartnersRanking key={`${state.measure}:${model.range.end}`} model={model} tab="products" measure={state.measure} pageSize={25} />
    {picker ? <TradeProductsPicker data={data} model={model} selectedIds={state.selectedIds} initialView={picker.view} returnFocusTo={picker.opener} onApply={selectedIds => update(previous => ({ ...previous, selectedIds }), true)} onClose={() => setPicker(null)} /> : null}
  </div>;
}
