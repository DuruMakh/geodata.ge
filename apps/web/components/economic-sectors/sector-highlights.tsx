"use client";

import { useMemo } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import type { ClientSectorObservation } from "../../lib/servedRows";
import { buildSectorHighlights } from "../../lib/explorer/sectorHighlights";
import { formatAmountParts, formatShare } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { SectionTitle, SourceNote } from "../ui/editorial";
import { sectorColor } from "../../lib/explorer/economicSectors";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";

export function SectorHighlights({ facts, registry, year }: {
  facts: ClientSectorObservation[]; registry: SectorDefinition[]; year: number;
}) {
  const { locale, messages } = useI18n();
  const model = useMemo(() => buildSectorHighlights(facts, registry, year), [facts, registry, year]);
  const t = (key: string) => message(messages, `sectors.${key}`);
  const name = (id: string) => {
    const sector = registry.find(r => r.id === id)!;
    return locale === "en" ? sector.labelEn : sector.labelKa;
  };
  const percentage = (value: number | null | undefined, signed = false) => formatShare(value == null ? null : value / 100, signed);
  const unavailable = model.growthFirstYear == null ? t("unavailable")
    : message(messages, "sectors.growthFrom", { year: model.growthFirstYear });
  const growthColor = (value: number | undefined) => value == null || value === 0 ? "var(--ink)" : value < 0 ? NEGATIVE : POSITIVE;
  const amount = formatAmountParts(model.largest?.value, false, locale);
  const cards = [
    { id: "fastest", label: t(model.fastest && model.fastest.value < 0 ? "leastDecline" : "fastest"),
      available: model.fastest !== null,
      value: percentage(model.fastest?.value, true), detail: model.fastest ? name(model.fastest.seriesId) : unavailable, color: growthColor(model.fastest?.value),
      trend: model.trends.fastest, trendColor: model.fastest ? sectorColor(model.fastest.seriesId) : "var(--ink)" },
    { id: "slowest", label: t(model.slowest && model.slowest.value >= 0 ? "slowest" : "largestDecline"),
      available: model.slowest !== null,
      value: percentage(model.slowest?.value, true), detail: model.slowest ? name(model.slowest.seriesId) : unavailable, color: growthColor(model.slowest?.value),
      trend: model.trends.slowest, trendColor: model.slowest ? sectorColor(model.slowest.seriesId) : "var(--ink)" },
    { id: "top-three", label: t("topThree"), value: percentage(model.topThreeShare),
      available: model.topThreeShare !== null,
      detail: model.topThreeShare == null ? t("unavailable") : model.topThree.map(f => name(f.seriesId)).join(" · "), color: "var(--ink)",
      trend: model.trends.topThree, trendColor: "var(--accent)" },
  ];
  return (
    <section data-testid="sector-highlights" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>{t("highlights")}</SectionTitle>
        <p className="text-[0.78125rem] text-[var(--muted)]"><Message messages={messages} id="sectors.rowYear" values={{ year: <span className="font-[family-name:var(--font-numeric)]">{year}</span> }} /></p>
      </div>
      <div data-testid="sector-kpi-layout" className={KPI_GRID_CLASS}>
        <HeroKpi label={t("largest")} value={amount.num} unit={amount.unit || undefined} testId="sector-highlight-largest" valueTestId="sector-hero-value">
          {model.largestShare != null ? (
            <>
              <div aria-hidden="true" className="flex h-[3px] bg-[var(--hairline-soft)]">
                <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${Math.max(0, Math.min(100, model.largestShare))}%` }} />
              </div>
              <p className="mt-2 font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--muted)]">{percentage(model.largestShare)} {t("ofGdp")}</p>
            </>
          ) : null}
          <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">{model.largest ? name(model.largest.seriesId) : t("unavailable")}</p>
        </HeroKpi>
        <SideKpiList
          testId="sector-side-kpis"
          kpis={cards.map((card) => ({
            label: card.label, value: card.value, unit: "", color: card.color, detail: card.detail, wrapDetail: !card.available,
            spark: { values: card.trend, color: card.trendColor }, testId: `sector-highlight-${card.id}`,
          }))}
        />
      </div>
      <div className="mt-5">
        <SourceNote>{t("highlightsScope")}{model.preliminary ? ` · ${t("preliminary")}` : ""}</SourceNote>
      </div>
    </section>
  );
}
