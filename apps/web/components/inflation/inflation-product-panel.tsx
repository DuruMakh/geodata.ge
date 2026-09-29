"use client";

import { useState, type ReactNode } from "react";
import { productAnnual, productColor, rankProducts, type ProductIndex } from "../../lib/explorer/inflationProducts";
import type { ProductState } from "../../lib/explorer/inflationProductState";
import { formatShare, MISSING } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { InflationProductArt } from "./inflation-product-art";

function normalized(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function filteredProductIds(index: ProductIndex, query: string): string[] {
  const needle = normalized(query);
  return rankProducts(index).filter((id) => {
    const item = index.productById.get(id)!;
    return needle === "" || normalized(item.labelKa).includes(needle) || normalized(item.labelEn).includes(needle);
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
  const visible = filteredProductIds(index, query);

  return <SeriesAside label={message(messages, "inflation.productsSelectorLabel")}>
    <SeriesSelector
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder={message(messages, "inflation.productsSearch")}
      countLabel={message(messages, "inflation.productsCount")}
      selectedCount={state.selected.length}
      totalCount={index.products.length}
      hasSelection={state.selected.length > 0}
      allSelected={false}
      onToggleAll={onClear}
      allowSelectAll={false}
      hasVisibleMatches={visible.length > 0}
    >
      {visible.map((id) => {
        const item = index.productById.get(id)!;
        const annual = productAnnual(index, id, index.latestPeriod);
        const focused = state.selected.at(-1) === id;
        return <SeriesSelectorRow
          key={id}
          id={id}
          label={locale === "ka" ? item.labelKa : item.labelEn}
          color={productColor(id)}
          art={<InflationProductArt productId={id} />}
          meta={focused ? message(messages, "inflation.productsFocusedTag") : undefined}
          value={annual === null ? MISSING : formatShare(annual / 100, true)}
          selected={state.selected.includes(id)}
          showRail={focused}
          onToggle={() => onToggle(id)}
        />;
      })}
    </SeriesSelector>
    {downloadAction}
  </SeriesAside>;
}
