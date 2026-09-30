"use client";

import { INK } from "../../lib/explorer/colors";
import { formatShare } from "../../lib/explorer/format";
import { formatContribution } from "../../lib/explorer/inflationCategoryLabels";
import { type CityIndex } from "../../lib/explorer/inflationCities";
import { latestCityIndicators } from "../../lib/explorer/inflationCityIndicators";
import { cityLineLabel } from "../../lib/explorer/inflationCityLabels";
import { displayedValue } from "../../lib/explorer/inflationGrid";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

// ძირითადი ინდიკატორები for the cities page (spec §6): the latest published month,
// year on year, for the picked category. Cities only; Georgia is the benchmark.
// A negative rate reads as გაიაფდა, never coloured good or bad.
export function InflationCityIndicators({ index, category }: { index: CityIndex; category: string }) {
  const { messages } = useI18n();
  const latest = latestCityIndicators(index, category);
  if (!latest) return null;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const pct = (value: number) => formatShare(displayedValue(value) / 100);
  const names = (ids: string[]) => ids.map((id) => cityLineLabel(messages, id)).join(", ");
  const delta = (value: number | null) => (value === null ? "—" : formatContribution(value));
  const { highest, lowest } = latest;

  const sideKpis: SideKpi[] = [
    {
      label: t("cityLowest"),
      value: pct(lowest.value),
      unit: "",
      color: "var(--ink)",
      detail: t(lowest.fell ? "cityFellDetail" : "cityVsNational", { city: names(lowest.cityIds), delta: delta(lowest.deltaPp) }),
      spark: null,
    },
    {
      label: t("cityGap"),
      value: displayedValue(latest.gap.value).toFixed(1),
      unit: t("pp"),
      color: "var(--ink)",
      detail: t("cityGapDetail"),
      spark: { values: latest.gap.spark, color: INK },
    },
  ];
  if (latest.aboveNational) {
    sideKpis.push({
      label: t("cityAboveNational"),
      value: t("cityAboveNationalValue", { count: String(latest.aboveNational.count), total: String(latest.aboveNational.total) }),
      unit: "",
      color: "var(--ink)",
      detail: t("cityAboveNationalDetail"),
      spark: { values: latest.aboveNational.spark, color: INK },
    });
  }

  return (
    <section data-testid="inflation-city-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
      <div data-testid="period-kpi-cards" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <HeroKpi label={`${t("cityHighest")} · ${periodLabel(messages, latest.period, "long")}`} value={pct(highest.value)}>
          <p data-testid="inflation-city-hero" className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
            {t("cityHeroDetail", {
              city: names(highest.cityIds),
              value: pct(highest.value),
              national: latest.national === null ? "—" : pct(latest.national),
              delta: delta(highest.deltaPp),
            })}
          </p>
        </HeroKpi>
        <SideKpiList kpis={sideKpis} />
      </div>
    </section>
  );
}
