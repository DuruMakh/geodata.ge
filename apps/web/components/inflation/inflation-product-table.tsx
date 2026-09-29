"use client";

import { useState } from "react";
import { makePeriod, periodKey } from "../../lib/data/inflation/periods";
import { formatShare, MISSING } from "../../lib/explorer/format";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { productAnnual, productCumulative, rankProducts, type ProductIndex } from "../../lib/explorer/inflationProducts";
import type { ProductState } from "../../lib/explorer/inflationProductState";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HorizontalScrollHint } from "../ui/horizontal-scroll-hint";
import { SectionTitle } from "../ui/editorial";
import { InflationProductArt } from "./inflation-product-art";

const BATCH_SIZE = 40;

export function nextProductCount(shown: number, total: number): number {
  return Math.min(shown + BATCH_SIZE, total);
}

export function visibleProductIds(index: ProductIndex, shown: number): string[] {
  return rankProducts(index).slice(0, shown);
}

export function InflationProductTable({ index, state, onToggle }: {
  index: ProductIndex;
  state: ProductState;
  onToggle: (id: string) => void;
}) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `inflation.${key}`, values);
  const [shown, setShown] = useState(Math.min(BATCH_SIZE, index.products.length));
  const ids = visibleProductIds(index, shown);
  const endPeriod = Math.min(makePeriod(state.range.endYear, 12), index.latestPeriod);
  const latestLabel = periodLabel(messages, index.latestPeriod, "long");
  const endLabel = periodLabel(messages, endPeriod, "long");

  return <section data-testid="product-list" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
    <SectionTitle>{t("productsAllHeading")}</SectionTitle>
    <p data-testid="product-list-count" className="mt-2 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
      {shown} / {index.products.length}
    </p>
    <div className="mt-[18px]">
      <HorizontalScrollHint testId="product-table-scroll-hint" />
      <div
        data-testid="product-table"
        role="region"
        tabIndex={0}
        aria-label={message(messages, "controls.tableScrollable")}
        className="max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <table className="w-full min-w-[560px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[185px] min-[768px]:w-[45%]" />
            <col className="w-[160px] min-[768px]:w-[25%]" />
            <col className="w-[215px] min-[768px]:w-[30%]" />
          </colgroup>
          <caption className="sr-only">{t("productsTableCaption", { latest: latestLabel, start: state.range.startYear, end: endLabel })}</caption>
          <thead><tr>
            <th scope="col" className="sticky left-0 z-[2] border-b-2 border-[var(--ink)] bg-[var(--paper)] py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] shadow-[1px_0_0_var(--hairline-soft)]">
              {t("productsProductColumn")}
            </th>
            <th scope="col" className="border-b-2 border-[var(--ink)] px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              {t("productsAnnualColumn", { period: latestLabel })}
            </th>
            <th scope="col" className="border-b-2 border-[var(--ink)] py-2 pl-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              {t("productsCumulativeColumn", { start: state.range.startYear, end: endLabel })}
            </th>
          </tr></thead>
          <tbody>
            {ids.map((id) => {
              const product = index.productById.get(id)!;
              const primary = locale === "ka" ? product.labelKa : product.labelEn;
              const secondary = locale === "ka" ? product.labelEn : product.labelKa;
              const selected = state.selected.includes(id);
              const annual = productAnnual(index, id, index.latestPeriod);
              const cumulative = productCumulative(index, id, state.range.startYear, endPeriod);
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
                  {annual === null ? MISSING : formatShare(annual / 100, true)}
                </td>
                <td className="py-2 pl-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap text-[var(--ink)]">
                  {cumulative.value === null ? MISSING : formatShare(cumulative.value / 100, true)}
                  {missing ? <span className="block max-w-[230px] whitespace-normal text-[10px] leading-snug text-[var(--muted)]">{missing}</span> : null}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
    {shown < index.products.length ? <button
      type="button"
      data-testid="product-more"
      onClick={() => setShown((current) => nextProductCount(current, index.products.length))}
      className="mt-5 cursor-pointer border-b border-[var(--accent)] pb-0.5 text-[12.5px] font-semibold text-[var(--ink)] hover:text-[var(--accent)]"
    >{t("productsMore")}</button> : null}
  </section>;
}
