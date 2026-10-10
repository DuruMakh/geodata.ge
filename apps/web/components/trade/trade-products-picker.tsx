"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_CATEGORIES, type TradeProductCategoryId } from "../../lib/data/tradeProducts/types";
import { formatInUnit } from "../../lib/explorer/format";
import { findTradeProducts, type TradeProductsBrowseView } from "../../lib/explorer/tradeProductsCatalogue";
import { tradeProductColor, type TradeProductsModel } from "../../lib/explorer/tradeProducts";
import { TRADE_PRODUCT_TOTAL_ID, tradeProductsBulkSelection } from "../../lib/explorer/tradeProductsState";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { TabDivider, TextTab } from "../ui/editorial";

export function TradeProductsPicker({ data, model, selectedIds, initialView, returnFocusTo, onApply, onClose }: { data: ClientTradeProductsData; model: TradeProductsModel; selectedIds: readonly string[]; initialView: "categories" | "selected"; returnFocusTo: HTMLElement | null; onApply: (selectedIds: string[]) => void; onClose: () => void }) {
  const presentation = useI18n(), t = (key: string) => message(presentation.messages, `trade.products.${key}`);
  const dialog = useRef<HTMLDialogElement>(null), close = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(() => [...selectedIds]);
  const [view, setView] = useState<TradeProductsBrowseView>(initialView), [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<TradeProductCategoryId | null>(null), [page, setPage] = useState(0);
  const selected = new Set(draft);
  const results = findTradeProducts({ data, model, presentation, view, categoryId, query, selectedIds: draft, page });
  const showCategories = view === "categories" && !categoryId && !query.trim();
  useEffect(() => {
    const element = dialog.current!, body = document.body;
    const previousOverflow = body.style.overflow, previousPadding = body.style.paddingRight;
    const x = window.scrollX, y = window.scrollY;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`;
    element.showModal(); close.current?.focus({ preventScroll: true });
    return () => {
      element.close(); body.style.overflow = previousOverflow; body.style.paddingRight = previousPadding;
      window.scrollTo(x, y); returnFocusTo?.focus({ preventScroll: true });
    };
  }, [returnFocusTo]);
  const toggle = (id: string) => setDraft(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const changeView = (next: TradeProductsBrowseView) => { setView(next); setCategoryId(null); setQuery(""); setPage(0); };
  const changeCategory = (next: TradeProductCategoryId | null) => { setCategoryId(next); setQuery(""); setPage(0); };
  const row = (id: string, label: string) => <SeriesSelectorRow id={id} label={label} color={tradeProductColor(id)} value={formatInUnit(model.valuesByEntity[id][model.range.end], model.unit)} selected={selected.has(id)} selectionRole="checkbox" wrapLabel onToggle={() => toggle(id)} />;
  return <dialog ref={dialog} aria-labelledby="trade-products-picker-title" data-testid="trade-products-picker" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }} className="m-auto h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[880px] border border-[var(--rule)] bg-[var(--paper)] p-0 text-[var(--ink)] shadow-xl backdrop:bg-black/35 min-[768px]:h-auto min-[768px]:max-h-[min(880px,calc(100dvh-3rem))]">
    <div className="flex h-full max-h-[inherit] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--rule)] px-4 py-3 min-[768px]:px-6">
        <h2 id="trade-products-picker-title" className="text-lg font-semibold">{t("add")}</h2>
        <button ref={close} type="button" data-testid="trade-products-close" aria-label={t("close")} onClick={onClose} className="flex size-11 cursor-pointer items-center justify-center border border-[var(--control)] hover:bg-[var(--tint)]"><X size={18} aria-hidden /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 min-[768px]:px-6">
        <SeriesSelector controls={<div role="group" aria-label={t("browse")} className="flex flex-wrap items-center gap-3">
          <TextTab label={t("categories")} active={view === "categories"} onClick={() => changeView("categories")} testId="trade-products-tab-categories" /><TabDivider />
          <TextTab label={t("all")} active={view === "all"} onClick={() => changeView("all")} testId="trade-products-tab-all" /><TabDivider />
          <TextTab label={t("selected")} active={view === "selected"} onClick={() => changeView("selected")} testId="trade-products-tab-selected" />
        </div>} query={query} onQueryChange={value => { setQuery(value); setPage(0); }} searchPlaceholder={t("search")} searchFocus="local" listLayout="flow" selectedCount={draft.length} totalCount={model.totalCount} hasSelection={draft.length > 0} allSelected={draft.length === model.totalCount} onToggleAll={() => setDraft(draft.length ? [] : tradeProductsBulkSelection(data))} hasVisibleMatches>
          <p className="mb-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("bulkScope")}</p>
          <p className="mb-1 text-[11px] text-[var(--muted)]">{model.range.end} · {model.unit.label}</p>
          <div data-testid="trade-product-reference">{row(TRADE_PRODUCT_TOTAL_ID, message(presentation.messages, "trade.partners.total"))}</div>
          {showCategories ? <div className="mt-4 grid grid-cols-2 gap-2 min-[768px]:grid-cols-4">
            {TRADE_PRODUCT_CATEGORIES.map(id => <button key={id} type="button" data-testid="trade-product-category" data-category={id} onClick={() => changeCategory(id)} className="flex min-h-28 cursor-pointer flex-col justify-between gap-3 border border-[var(--control)] p-3 text-left hover:bg-[var(--tint)]"><span className="text-[0.8125rem] font-medium leading-snug">{t(`category.${id}`)}</span><span className="font-[family-name:var(--font-numeric)] text-xs text-[var(--muted)]">{results.categoryCounts[id]}</span></button>)}
          </div> : <>
            {categoryId ? <button type="button" onClick={() => changeCategory(null)} className="my-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs"><ArrowLeft size={14} aria-hidden />{t("categories")} · {t(`category.${categoryId}`)}</button> : null}
            <p data-testid="trade-products-match-count" className="my-3 text-xs text-[var(--muted)]">{t("matches")} {results.totalMatches}</p>
            {results.rows.map(result => <div key={result.entityId} data-testid="trade-product-result">{row(result.entityId, result.label)}</div>)}
            {!results.totalMatches ? <p className="py-4 text-sm text-[var(--muted)]">{t(view === "selected" && !query ? "emptySelected" : "noMatches")}</p> : null}
            {results.pageCount > 1 ? <nav aria-label={t("pages")} className="mt-4 flex items-center justify-between gap-3 text-xs">
              <button type="button" disabled={results.page === 0} data-testid="trade-products-previous" onClick={() => setPage(results.page - 1)} className="flex min-h-11 cursor-pointer items-center gap-2 disabled:opacity-35"><ArrowLeft size={14} aria-hidden />{t("previous")}</button>
              <span>{results.page + 1} / {results.pageCount}</span>
              <button type="button" disabled={results.page + 1 === results.pageCount} data-testid="trade-products-next" onClick={() => setPage(results.page + 1)} className="flex min-h-11 cursor-pointer items-center gap-2 disabled:opacity-35">{t("next")}<ArrowRight size={14} aria-hidden /></button>
            </nav> : null}
          </>}
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">{t("unavailable")}</p>
        </SeriesSelector>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] bg-[var(--paper)] px-4 py-3 min-[768px]:px-6">
        <span data-testid="trade-products-draft-count" className="text-xs text-[var(--muted)]">{t("selected")} · {draft.length}</span>
        <button type="button" data-testid="trade-products-compare" onClick={() => { onApply(draft); onClose(); }} className="min-h-11 cursor-pointer bg-[var(--ink)] px-4 py-2 text-[0.8125rem] font-medium text-[var(--paper)]">{t("compare")}</button>
      </footer>
    </div>
  </dialog>;
}
