"use client";

import { makePeriod, periodKey } from "../../lib/data/inflation/periods";
import { formatShare, MISSING } from "../../lib/explorer/format";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { productAnnual, productColor, productCumulative, rankProducts, type ProductCumulative, type ProductIndex } from "../../lib/explorer/inflationProducts";
import type { ProductState } from "../../lib/explorer/inflationProductState";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

const pct = (value: number | null) => formatShare(value === null ? null : value / 100, true);

export function productRatePosition(value: number, min: number, max: number): number {
  return min === max ? 50 : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function productIndicatorSummary(index: ProductIndex, state: ProductState): {
  heroProductId: string | null;
  heroAnnual: number | null;
  highestId: string | null;
  lowestId: string | null;
  min: number | null;
  max: number | null;
  cumulative: ProductCumulative;
  cumulativeSpark: Array<number | null> | null;
  endPeriod: number;
} {
  const ranked = rankProducts(index);
  const published = ranked.filter((id) => productAnnual(index, id, index.latestPeriod) !== null);
  const highestId = published[0] ?? null;
  const lowestId = published.at(-1) ?? null;
  const max = highestId ? productAnnual(index, highestId, index.latestPeriod) : null;
  const min = lowestId ? productAnnual(index, lowestId, index.latestPeriod) : null;
  const heroProductId = state.selected.at(-1) ?? null;
  const heroAnnual = heroProductId ? productAnnual(index, heroProductId, index.latestPeriod) : null;
  const endPeriod = Math.min(makePeriod(state.range.endYear, 12), index.latestPeriod);
  const cumulative = heroProductId ? productCumulative(index, heroProductId, state.range.startYear, endPeriod) :
    { value: null, reason: null, missingPeriod: null } as ProductCumulative;
  const cumulativeSpark = heroProductId && cumulative.value !== null ?
    Array.from({ length: endPeriod - makePeriod(state.range.startYear, 1) + 1 }, (_, offset) =>
      productCumulative(index, heroProductId, state.range.startYear, makePeriod(state.range.startYear, 1) + offset).value) : null;
  return { heroProductId, heroAnnual, highestId, lowestId, min, max, cumulative, cumulativeSpark, endPeriod };
}

function ProductRateScale({ value, min, max }: { value: number | null; min: number | null; max: number | null }) {
  return <div data-testid="product-rate-scale">
    <div className="relative h-[3px] bg-[var(--hairline-soft)]">
      {value !== null && min !== null && max !== null ? <span
        data-testid="product-rate-marker"
        aria-hidden="true"
        className="absolute -top-1.5 h-[15px] w-[2px] bg-[var(--ink)]"
        style={{ left: `${productRatePosition(value, min, max).toFixed(1)}%` }}
      /> : null}
    </div>
    <div className="mt-2 flex justify-between font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
      <span>{pct(min)}</span><span>{pct(max)}</span>
    </div>
  </div>;
}

export function InflationProductIndicators({ index, state }: { index: ProductIndex; state: ProductState }) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `inflation.${key}`, values);
  const latest = productIndicatorSummary(index, state);
  const name = (id: string | null) => id === null ? t("productsChooseProduct") :
    (locale === "ka" ? index.productById.get(id)?.labelKa : index.productById.get(id)?.labelEn) ?? id;
  const annualHistory = (id: string | null) => id === null ? null :
    Array.from({ length: index.latestPeriod - makePeriod(index.earliestYear, 1) + 1 }, (_, offset) =>
      productAnnual(index, id, makePeriod(index.earliestYear, 1) + offset));
  const cumulativeReason = latest.cumulative.reason === "late_start" && latest.heroProductId ?
    t("productsLateStart", { period: index.productById.get(latest.heroProductId)!.firstPeriod }) :
    latest.cumulative.reason === "missing_month" && latest.cumulative.missingPeriod !== null ?
      t("productsMissingMonth", { period: periodKey(latest.cumulative.missingPeriod) }) : null;
  const endLabel = periodLabel(messages, latest.endPeriod, "long");
  const sideKpis: SideKpi[] = [
    {
      label: `${t("productsKpiCumulative")} · ${name(latest.heroProductId)}`,
      value: pct(latest.cumulative.value), unit: "", color: "var(--ink)",
      detail: `${state.range.startYear}–${endLabel}${cumulativeReason ? ` · ${cumulativeReason}` : ""}`,
      wrapDetail: true,
      spark: latest.cumulativeSpark && latest.heroProductId ? { values: latest.cumulativeSpark, color: productColor(latest.heroProductId) } : null,
    },
    {
      label: `${t("productsKpiHighest")} · ${name(latest.highestId)}`,
      value: latest.highestId ? pct(productAnnual(index, latest.highestId, index.latestPeriod)) : MISSING,
      unit: "", color: "var(--ink)", detail: periodLabel(messages, index.latestPeriod, "long"),
      spark: latest.highestId ? { values: annualHistory(latest.highestId)!, color: productColor(latest.highestId) } : null,
    },
    {
      label: `${t("productsKpiLowest")} · ${name(latest.lowestId)}`,
      value: latest.lowestId ? pct(productAnnual(index, latest.lowestId, index.latestPeriod)) : MISSING,
      unit: "", color: "var(--ink)", detail: periodLabel(messages, index.latestPeriod, "long"),
      spark: latest.lowestId ? { values: annualHistory(latest.lowestId)!, color: productColor(latest.lowestId) } : null,
    },
  ];

  return <section data-testid="product-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
    <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
    <div data-testid="period-kpi-cards" className={KPI_GRID_CLASS}>
      <HeroKpi
        label={`${t("productsKpiFocus")} · ${name(latest.heroProductId)} · ${periodLabel(messages, index.latestPeriod, "long")}`}
        value={pct(latest.heroAnnual)}
      >
        <ProductRateScale value={latest.heroAnnual} min={latest.min} max={latest.max} />
        <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
          {latest.heroProductId ? t("productsHeroComparison", {
            current: periodLabel(messages, index.latestPeriod, "long"),
            previous: periodLabel(messages, index.latestPeriod - 12, "long"),
          }) : t("productsChooseProduct")}
        </p>
      </HeroKpi>
      <SideKpiList kpis={sideKpis} />
    </div>
  </section>;
}
