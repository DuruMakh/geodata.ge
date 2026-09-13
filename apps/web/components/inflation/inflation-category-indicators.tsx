"use client";

import { periodMonth } from "../../lib/data/inflation/periods";
import { INK } from "../../lib/explorer/colors";
import { formatShare } from "../../lib/explorer/format";
import { displayedValue } from "../../lib/explorer/inflationGrid";
import { latestCategoryIndicators, type CategoryIndex, type CategoryIndicatorEntry } from "../../lib/explorer/inflationCategories";
import { categoryColor, categoryLabel, formatContribution } from "../../lib/explorer/inflationCategoryLabels";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { Message } from "../../lib/i18n/message";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

// ძირითადი ინდიკატორები for the categories page: always the latest published
// month, regardless of tab or range (spec §6). Four different questions rather
// than one measure ranked four ways — which group drives the headline, what rose
// fastest, what is weakest, and how many groups are rising at all. A negative
// contributor is described as გაიაფდა, never coloured as good or bad.

const mono = (text: string) => <span className="font-[family-name:var(--font-numeric)] text-xs">{text}</span>;

export function InflationCategoryIndicators({ index }: { index: CategoryIndex }) {
  const { messages } = useI18n();
  const latest = latestCategoryIndicators(index);
  if (!latest) return null;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const { hero } = latest;
  const month = periodMonth(latest.period);
  const pct = (value: number) => formatShare(displayedValue(value) / 100);

  // The rate is the headline figure of these two rows; the contribution it makes
  // is the supporting detail, so the two rows never repeat the hero's measure.
  const rateKpi = (entry: CategoryIndicatorEntry, label: string): SideKpi => ({
    label,
    value: pct(entry.changePct),
    unit: "",
    color: "var(--ink)",
    detail: t("contributionDetail", {
      category: categoryLabel(messages, entry.categoryId),
      value: entry.contribution === null ? "—" : `${formatContribution(entry.contribution)} ${t("pp")}`,
    }),
    spark: { values: entry.spark, color: categoryColor(entry.categoryId) },
  });

  const sideKpis: SideKpi[] = [];
  if (latest.fastestRise) sideKpis.push(rateKpi(latest.fastestRise, t("fastestRise")));
  if (latest.weakest) {
    // Only claim something got cheaper when it actually did.
    sideKpis.push(rateKpi(latest.weakest, t(latest.weakest.fell ? "biggestFall" : "smallestRise")));
  }
  sideKpis.push({
    label: t("inflationBreadth"),
    value: t("breadthValue", { rose: String(latest.breadth.rose), total: String(latest.breadth.total) }),
    unit: "",
    color: "var(--ink)",
    detail: t("breadthDetail"),
    spark: { values: latest.breadth.spark, color: INK },
  });

  return (
    <section data-testid="inflation-category-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
      <div data-testid="period-kpi-cards" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <HeroKpi
          label={`${t("largestContributor")} · ${periodLabel(messages, latest.period, "long")}`}
          value={`${formatContribution(hero.value)} ${t("pp")}`}
        >
          <p data-testid="inflation-category-hero" className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
            <Message
              messages={messages}
              id={hero.value >= 0 ? "inflation.categoryHeroRise" : "inflation.categoryHeroFall"}
              values={{
                monthIn: message(messages, `inflation.monthIn.${month}`),
                category: categoryLabel(messages, hero.categoryId),
                change: mono(hero.changePct === null ? "—" : pct(hero.changePct)),
                share: mono(hero.weightPct === null ? "—" : `${hero.weightPct.toFixed(1)}%`),
                value: mono(`${formatContribution(Math.abs(hero.value))} ${t("pp")}`),
              }}
            />
          </p>
        </HeroKpi>
        <SideKpiList kpis={sideKpis} />
      </div>
    </section>
  );
}
