"use client";

import { useState } from "react";
import { makePeriod, periodKey } from "../../lib/data/inflation/periods";
import { formatShare, MISSING } from "../../lib/explorer/format";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { productAnnual, productCumulative, type ProductIndex } from "../../lib/explorer/inflationProducts";
import type { ProductState } from "../../lib/explorer/inflationProductState";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SectionTitle } from "../ui/editorial";
import { InflationProductArt } from "./inflation-product-art";
import { filteredProductIds } from "./inflation-product-panel";

const BATCH_SIZE = 40;

export function nextProductCount(shown: number, total: number): number {
  return Math.min(shown + BATCH_SIZE, total);
}

export function InflationProductTable({ index, state, onToggle }: {
  index: ProductIndex;
  state: ProductState;
  onToggle: (id: string) => void;
}) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `inflation.${key}`, values);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(Math.min(BATCH_SIZE, index.products.length));
  const endPeriod = Math.min(makePeriod(state.range.endYear, 12), index.latestPeriod);
  const matches = filteredProductIds(index, query);
  const cumulativeById = new Map(matches.map((id) => [id, productCumulative(index, id, state.range.startYear, endPeriod)] as const));
  matches.sort((a, b) => {
    const left = cumulativeById.get(a)!.value;
    const right = cumulativeById.get(b)!.value;
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return right - left;
  });
  const ids = matches.slice(0, shown);
  const latestLabel = periodLabel(messages, index.latestPeriod, "long");
  const endLabel = periodLabel(messages, endPeriod, "long");

  return <section data-testid="product-list" className="mt-12">
    <div className="flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between">
      <SectionTitle>{t("productsBrowseHeading")}</SectionTitle>
      <input
        data-testid="product-list-search"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setShown(Math.min(BATCH_SIZE, index.products.length)); }}
        placeholder={t("productsSearch")}
        aria-label={t("productsSearch")}
        className="h-[34px] w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent px-0.5 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus-visible:border-[var(--accent)] min-[768px]:w-[280px]"
      />
    </div>
    {ids.length === 0 ? <p data-testid="product-list-empty" className="mt-6 text-[13px] text-[var(--muted)]">{t("productsNoMatches")}</p> : <div className="mt-[18px]">
      <div
        data-testid="product-table"
        role="region"
        tabIndex={0}
        aria-label={message(messages, "controls.tableScrollable")}
        className="max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {/* Short column headers with the periods in the visible caption: on a phone the name and
            both rate columns fit without a horizontal swipe (DESIGN.md §25.2). */}
        <table className="w-full table-fixed border-collapse min-[768px]:min-w-[560px]">
          <colgroup>
            <col className="min-[768px]:w-[45%]" />
            <col className="w-[92px] min-[768px]:w-[25%]" />
            <col className="w-[72px] min-[768px]:w-[30%]" />
          </colgroup>
          <caption data-testid="product-table-caption" className="pb-2 text-left text-[12px] leading-[1.5] text-[var(--muted)]">{t("productsTableCaption", { latest: latestLabel, start: state.range.startYear, end: endLabel })}</caption>
          <thead><tr>
            <th scope="col" className="sticky left-0 z-[2] border-b-2 border-[var(--ink)] bg-[var(--paper)] py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] shadow-[1px_0_0_var(--hairline-soft)]">
              {t("productsProductColumn")}
            </th>
            <th scope="col" className="border-b-2 border-[var(--ink)] px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              {t("productsCumulativeColumn")}
            </th>
            <th scope="col" className="border-b-2 border-[var(--ink)] py-2 pl-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              {t("productsAnnualColumn")}
            </th>
          </tr></thead>
          <tbody>
            {ids.map((id) => {
              const product = index.productById.get(id)!;
              const primary = locale === "ka" ? product.labelKa : product.labelEn;
              const secondary = locale === "ka" ? product.labelEn : product.labelKa;
              const selected = state.selected.includes(id);
              const annual = productAnnual(index, id, index.latestPeriod);
              const cumulative = cumulativeById.get(id)!;
              const missing = cumulative.reason === "late_start" ? t("productsLateStart", { period: product.firstPeriod }) :
                cumulative.reason === "missing_month" && cumulative.missingPeriod !== null ?
                  t("productsMissingMonth", { period: periodKey(cumulative.missingPeriod) }) : null;
              return <tr key={id} data-product-id={id} className={`border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)] ${selected ? "bg-[var(--tint)]" : ""}`}>
                <td className={`sticky left-0 z-[1] py-2 pr-3 shadow-[1px_0_0_var(--hairline-soft)] ${selected ? "bg-[var(--tint)]" : "bg-[var(--paper)]"}`}>
                  <button
                    type="button"
                    data-testid="product-row-toggle"
                    aria-pressed={selected}
                    aria-label={`${t(selected ? "productsDeselect" : "productsSelect")} ${primary}`}
                    onClick={() => onToggle(id)}
                    className="flex min-h-9 w-full cursor-pointer items-center gap-2 text-left"
                  >
                    <InflationProductArt productId={id} />
                    <span className="min-w-0">
                      <span className="block break-words text-[12.5px] font-medium text-[var(--ink)]">{primary}</span>
                      <span
                        className="block break-words text-[11px] text-[var(--muted)]"
                        data-original-language="product"
                        data-product-id={id}
                        lang={locale === "ka" ? "en" : "ka"}
                      >{secondary}</span>
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-numeric)] text-[12.5px] font-semibold whitespace-nowrap text-[var(--ink)]">
                  {cumulative.value === null ? MISSING : formatShare(cumulative.value / 100, true)}
                  {missing ? <span className="block max-w-[230px] whitespace-normal text-[10px] leading-snug text-[var(--muted)]">{missing}</span> : null}
                </td>
                <td className="py-2 pl-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap text-[var(--ink)]">
                  {annual === null ? MISSING : formatShare(annual / 100, true)}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>}
    {shown < matches.length ? <button
      type="button"
      data-testid="product-more"
      onClick={() => setShown((current) => nextProductCount(current, matches.length))}
      className="mt-5 cursor-pointer border-b border-[var(--accent)] pb-0.5 text-[12.5px] font-semibold text-[var(--ink)] hover:text-[var(--accent)]"
    >{t("productsMore")}</button> : null}
  </section>;
}
