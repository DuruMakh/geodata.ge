"use client";

import { INK } from "../../lib/explorer/colors";
import { formatShare } from "../../lib/explorer/format";
import { categoryLabel, formatContribution } from "../../lib/explorer/inflationCategoryLabels";
import { type CityIndex } from "../../lib/explorer/inflationCities";
import { latestCityCategoryIndicators, type CityCategoryRate } from "../../lib/explorer/inflationCityIndicators";
import { cityLineLabel } from "../../lib/explorer/inflationCityLabels";
import type { CpiCityId } from "../../lib/data/inflation/types";
import { displayedValue } from "../../lib/explorer/inflationGrid";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

// ძირითადი ინდიკატორები on a city page (spec 2026-09-30 §5): the city's total
// against Georgia, then the Categories page's three rate questions over the city's
// divisions, each against Georgia's same division. A fall is never coloured.
export function InflationCityCategoryIndicators({ index, cityId }: { index: CityIndex; cityId: CpiCityId }) {
  const { messages } = useI18n();
  const latest = latestCityCategoryIndicators(index, cityId);
  if (!latest) return null;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const pct = (value: number) => formatShare(displayedValue(value) / 100);
  const delta = (value: number | null) => (value === null ? "—" : formatContribution(value));
  const city = cityLineLabel(messages, cityId);
  const rateKpi = (entry: CityCategoryRate, label: string): SideKpi => ({
    label,
    value: pct(entry.value),
    unit: "",
    color: "var(--ink)",
    detail: t("cityCategoryVsNational", { category: categoryLabel(messages, entry.categoryId), delta: delta(entry.deltaPp) }),
    spark: null,
  });
  const sideKpis: SideKpi[] = [
    rateKpi(latest.fastest, t("fastestRise")),
    rateKpi(latest.slowest, t(latest.slowest.fell ? "biggestFall" : "smallestRise")),
    {
      label: t("inflationBreadth"),
      value: t("breadthValue", { rose: String(latest.breadth.rose), total: String(latest.breadth.total) }),
      unit: "",
      color: "var(--ink)",
      detail: t("breadthDetail"),
      spark: { values: latest.breadth.spark, color: INK },
    },
  ];

  return (
    <section data-testid="inflation-city-category-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
      <div data-testid="period-kpi-cards" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {latest.total ? (
          <HeroKpi label={`${t("categoryTab.yoy")} · ${periodLabel(messages, latest.period, "long")}`} value={pct(latest.total.value)}>
            <p data-testid="inflation-city-category-hero" className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">
              {t("cityHeroDetail", {
                city,
                value: pct(latest.total.value),
                national: latest.total.national === null ? "—" : pct(latest.total.national),
                delta: delta(latest.total.deltaPp),
              })}
            </p>
          </HeroKpi>
        ) : (
          <div />
        )}
        <SideKpiList kpis={sideKpis} />
      </div>
    </section>
  );
}
