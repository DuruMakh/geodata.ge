"use client";

import { periodMonth } from "../../lib/data/inflation/periods";
import { formatShare } from "../../lib/explorer/format";
import { displayedValue } from "../../lib/explorer/inflationGrid";
import { latestContributors, type CategoryIndex } from "../../lib/explorer/inflationCategories";
import { categoryColor, categoryLabel, formatContribution } from "../../lib/explorer/inflationCategoryLabels";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { Message } from "../../lib/i18n/message";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

// ძირითადი ინდიკატორები for the categories page: always the latest published
// month, regardless of tab or range (spec §6). The hero answers the question the
// page exists for — which group drives the headline. A negative contributor is
// described as გაიაფდა, never coloured as good or bad.

const mono = (text: string) => <span className="font-[family-name:var(--font-numeric)] text-xs">{text}</span>;

export function InflationCategoryIndicators({ index }: { index: CategoryIndex }) {
  const { messages } = useI18n();
  const latest = latestContributors(index, 4);
  if (!latest) return null;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const [hero, ...rest] = latest.contributors;
  if (hero === undefined) return null;
  const month = periodMonth(latest.period);

  const sideKpis: SideKpi[] = rest.map((entry) => ({
    label: categoryLabel(messages, entry.categoryId),
    value: formatContribution(entry.value),
    unit: t("pp"),
    color: "var(--ink)",
    detail:
      entry.changePct === null
        ? t("basketShare")
        : `${formatShare(displayedValue(entry.changePct) / 100)} · ${t("basketShare")} ${entry.weightPct === null ? "—" : `${entry.weightPct.toFixed(1)}%`}`,
    spark: { values: entry.spark, color: categoryColor(entry.categoryId) },
  }));

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
                change: mono(hero.changePct === null ? "—" : formatShare(displayedValue(hero.changePct) / 100)),
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
