"use client";

import { Fragment, memo, useState, type ReactNode } from "react";
import { productColor, type ProductIndex } from "../../lib/explorer/inflationProducts";
import type { ProductState } from "../../lib/explorer/inflationProductState";
import { formatShare, MISSING } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { InflationProductArt } from "./inflation-product-art";

/** Rows a stacked (phone) list shows before its "more products" button. */
export const PHONE_PRODUCT_ROWS = 10;

/** The products a query matches, in `order` (the latest annual ranking unless given). */
export function filteredProductIds(index: ProductIndex, query: string, order: readonly string[] = index.ranked): string[] {
  return order.filter((id) => {
    const item = index.productById.get(id)!;
    return matchesLabelQuery(query, [item.labelKa, item.labelEn]);
  });
}

export function InflationProductPanel({ index, state, onToggle, onClear, downloadAction }: {
  index: ProductIndex;
  state: ProductState;
  onToggle: (id: string) => void;
  onClear: () => void;
  downloadAction: ReactNode;
}) {
  const { locale, messages } = useI18n();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const visible = filteredProductIds(index, query);
  // 305 rows scroll inside the panel at every width (DESIGN §7.7), behind a "skip the
  // list" button for keyboards (U14-05). Stacked, phones also list only the top ten (plus
  // anything already selected) behind a "more products" button. A search always looks
  // through every product.
  const collapsed = !showAll && query === "" && visible.length > PHONE_PRODUCT_ROWS;
  // A product stays listed once it has been selected, so unticking it does not make
  // the row vanish from under the finger.
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set(state.selected));
  if (state.selected.some((id) => !kept.has(id))) setKept(new Set([...kept, ...state.selected]));
  const phoneHidden = (id: string, rank: number) => collapsed && rank >= PHONE_PRODUCT_ROWS && !kept.has(id);

  return <SeriesAside label={message(messages, "inflation.productsSelectorLabel")}>
    <SeriesSelector
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder={message(messages, "controls.search")}
      listLayout="scroll"
      countLabel={message(messages, "inflation.productsCount")}
      selectedCount={state.selected.length}
      totalCount={index.products.length}
      hasSelection={state.selected.length > 0}
      allSelected={false}
      onToggleAll={onClear}
      allowSelectAll={false}
      hasVisibleMatches={visible.length > 0}
    >
      {visible.map((id, rank) => {
        const item = index.productById.get(id)!;
        const row = <ProductSelectorRow
          id={id}
          label={locale === "ka" ? item.labelKa : item.labelEn}
          annual={index.latestAnnual.get(id) ?? null}
          selected={state.selected.includes(id)}
          focused={state.selected.at(-1) === id}
          onToggle={onToggle}
        />;
        return phoneHidden(id, rank)
          ? <div key={id} data-phone-hidden className="contents @max-[1100px]:hidden">{row}</div>
          : <Fragment key={id}>{row}</Fragment>;
      })}
    </SeriesSelector>
    {collapsed ? <button
      type="button"
      data-testid="product-panel-more"
      onClick={() => setShowAll(true)}
      className="min-h-11 w-full cursor-pointer border-b border-[var(--row-border)] text-left text-[12.5px] font-semibold text-[var(--ink)] hover:text-[var(--accent)] @min-[1100px]:hidden"
    >
      {message(messages, "inflation.productsMore")}{" "}
      <span className="font-[family-name:var(--font-numeric)] text-[11px] font-normal text-[var(--muted)]">+{visible.filter(phoneHidden).length}</span>
    </button> : null}
    {downloadAction}
  </SeriesAside>;
}

/** One selector row. Memoised, so a click re-renders only the rows whose selection or focus changed (U14-03). */
const ProductSelectorRow = memo(function ProductSelectorRow({ id, label, annual, selected, focused, onToggle }: {
  id: string;
  label: string;
  annual: number | null;
  selected: boolean;
  focused: boolean;
  onToggle: (id: string) => void;
}) {
  const { messages } = useI18n();
  return <SeriesSelectorRow
    id={id}
    label={label}
    color={productColor(id)}
    art={<InflationProductArt productId={id} />}
    meta={focused ? message(messages, "inflation.productsFocusedTag") : undefined}
    value={annual === null ? MISSING : formatShare(annual / 100, true)}
    selected={selected}
    showRail={focused}
    onToggle={() => onToggle(id)}
  />;
});
