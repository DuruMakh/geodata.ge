"use client";

import { useMemo } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import { buildRegionalEconomyHighlights } from "../../lib/explorer/regionalEconomyHighlights";
import { regionalEconomyColor } from "../../lib/explorer/regionalEconomies";
import { formatAmount, formatAmountParts, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SectionTitle, SourceNote } from "../ui/editorial";
import { Sparkline } from "../ui/sparkline";
import type { ClientRegionalEconomyObservation } from "../../lib/servedRows";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";

export function RegionHighlights({ facts, registry, year }: {
  facts: ClientRegionalEconomyObservation[];
  registry: SectorDefinition[];
  year: number;
}) {
  const { locale, messages } = useI18n();
  const model = useMemo(() => buildRegionalEconomyHighlights(facts, registry, year), [facts, registry, year]);
  const t = (key: string) => message(messages, `regionalEconomies.${key}`);
  const name = (seriesId: string) => {
    const sector = registry.find((definition) => definition.id === seriesId);
    return sector ? locale === "en" ? sector.labelEn : sector.labelKa : t("unavailable");
  };
  const amount = formatAmountParts(model.largest?.value, false, locale);
  const scope = message(messages, "regionalEconomies.highlightsScope", { sectorCount: model.publishedSectorCount });
  const percent = (value: number | null) => formatShare(value === null ? null : value / 100);
  const cards = [
    { id: "total", label: t("totalKpi"), value: formatAmount(model.total?.value, locale), detail: String(year), trend: model.trends.total, color: "var(--ink)" },
    { id: "top-three", label: t("topThree"), value: percent(model.topThreeSharePct), detail: model.topThree.map((row) => name(row.seriesId)).join(" · ") || t("unavailable"), trend: model.trends.topThreeShare, color: "var(--accent)" },
    { id: "count", label: t("sectorCount"), value: String(model.publishedSectorCount), detail: scope, trend: [] as Array<number | null>, color: "var(--ink)" },
  ];
  return (
    <section data-testid="regional-highlights" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>{t("highlights")}</SectionTitle>
        <p className="text-[0.78125rem] text-[var(--muted)]">{message(messages, "regionalEconomies.rowYear", { year })}</p>
      </div>
      <div className={KPI_GRID_CLASS}>
        <HeroKpi label={t("largest")} value={amount.num} unit={amount.unit || undefined}>
          {model.largestSharePct !== null ? <p className="font-[family-name:var(--font-numeric)] text-[0.75rem] text-[var(--muted)]">{percent(model.largestSharePct)} {t("ofRegionalGdp")}</p> : null}
          <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">{model.largest ? name(model.largest.seriesId) : t("unavailable")}</p>
          <Sparkline values={model.trends.largest} color={model.largest ? regionalEconomyColor(model.largest.seriesId) : "var(--ink)"} />
        </HeroKpi>
        <SideKpiList kpis={cards.map((card) => ({ label: card.label, value: card.value, unit: "", color: "var(--ink)", detail: card.detail, spark: card.trend.length ? { values: card.trend, color: card.color } : null }))} />
      </div>
      <div className="mt-5"><SourceNote>{scope}</SourceNote></div>
    </section>
  );
}
