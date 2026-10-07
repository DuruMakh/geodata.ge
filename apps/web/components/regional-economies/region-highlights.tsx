"use client";

import { useMemo } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import { buildRegionalEconomyHighlights } from "../../lib/explorer/regionalEconomyHighlights";
import { regionalEconomyColor } from "../../lib/explorer/regionalEconomies";
import { formatAmount, formatAmountParts, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { Overline, SectionTitle, SourceNote } from "../ui/editorial";
import { withLari } from "../ui/lari";
import { Sparkline } from "../ui/sparkline";
import type { ClientRegionalEconomyObservation } from "../../lib/servedRows";
import { KPI_GRID_CLASS, SIDE_KPI_LIST_CLASS } from "../main-explorer/kpi-blocks";

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
  const percent = (value: number | null) => formatShare(value === null ? null : value / 100);
  const cards = [
    { id: "total", label: t("totalKpi"), value: formatAmount(model.total?.value, locale), detail: String(year), trend: model.trends.total, color: "var(--ink)" },
    { id: "top-three", label: t("topThree"), value: percent(model.topThreeSharePct), detail: model.topThree.map((row) => name(row.seriesId)).join(" · ") || t("unavailable"), trend: model.trends.topThreeShare, color: "var(--accent)" },
    { id: "count", label: t("sectorCount"), value: String(model.publishedSectorCount), detail: t("highlightsScope"), trend: [] as Array<number | null>, color: "var(--ink)" },
  ];
  return (
    <section data-testid="regional-highlights" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>{t("highlights")}</SectionTitle>
        <p className="text-[0.78125rem] text-[var(--muted)]">{message(messages, "regionalEconomies.rowYear", { year })}</p>
      </div>
      <div className={KPI_GRID_CLASS}>
        <div className="min-w-0 @min-[1100px]:pr-11">
          <Overline>{t("largest")}</Overline>
          <p className="mt-3.5 font-[family-name:var(--font-display)] text-[44px] font-semibold leading-none tracking-[-0.02em] min-[768px]:text-[62px]">
            {amount.num}{amount.unit ? <span className="ml-1.5 font-[family-name:var(--font-numeric)] text-base font-medium text-[var(--body)]">{withLari(amount.unit)}</span> : null}
          </p>
          <div className="mt-7 max-w-[480px]">
            {model.largestSharePct !== null ? <p className="font-[family-name:var(--font-numeric)] text-[0.75rem] text-[var(--muted)]">{percent(model.largestSharePct)} {t("ofRegionalGdp")}</p> : null}
            <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">{model.largest ? name(model.largest.seriesId) : t("unavailable")}</p>
            <Sparkline values={model.trends.largest} color={model.largest ? regionalEconomyColor(model.largest.seriesId) : "var(--ink)"} />
          </div>
        </div>
        <div className={SIDE_KPI_LIST_CLASS}>
          {cards.map((card, index) => (
            <div key={card.id} className={index === 0 ? "pt-0.5 pb-3.5" : "border-t border-[var(--hairline-soft)] py-3.5"}>
              <Overline>{card.label}</Overline>
              <div className="mt-[7px] flex items-baseline justify-between gap-4">
                <p className="whitespace-nowrap font-[family-name:var(--font-display)] text-2xl font-semibold">{card.value}</p>
                <p className="min-w-0 overflow-hidden text-ellipsis text-right text-xs text-[var(--muted)]">{card.detail}</p>
              </div>
              {card.trend.length ? <Sparkline values={card.trend} color={card.color} /> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5"><SourceNote>{t("highlightsScope")}</SourceNote></div>
    </section>
  );
}
