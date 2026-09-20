"use client";

import { useMemo } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import type { ServedRegionalEconomyObservation } from "../../lib/data/regionalEconomies/types";
import { buildRegionalEconomyHighlights } from "../../lib/explorer/regionalEconomyHighlights";
import { regionalEconomyColor } from "../../lib/explorer/regionalEconomies";
import { formatAmount, formatAmountParts, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { Overline, SectionTitle, SourceNote } from "../ui/editorial";
import { Sparkline } from "../ui/sparkline";

export function RegionHighlights({ facts, registry, year }: {
  facts: ServedRegionalEconomyObservation[];
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
        <p className="text-[12.5px] text-[var(--muted)]">{message(messages, "regionalEconomies.rowYear", { year })}</p>
      </div>
      <div className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0 @min-[1100px]:pr-11">
          <Overline>{t("largest")}</Overline>
          <p className="mt-3.5 font-[family-name:var(--font-display)] text-[44px] font-semibold leading-none tracking-[-0.02em] min-[768px]:text-[62px]">
            {amount.num}{amount.unit ? <span className="ml-1.5 font-[family-name:var(--font-numeric)] text-base font-medium text-[var(--body)]">{amount.unit}</span> : null}
          </p>
          <div className="mt-7 max-w-[480px]">
            {model.largestSharePct !== null ? <p className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--muted)]">{percent(model.largestSharePct)} {t("ofRegionalGdp")}</p> : null}
            <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">{model.largest ? name(model.largest.seriesId) : t("unavailable")}</p>
            <Sparkline values={model.trends.largest} color={model.largest ? regionalEconomyColor(model.largest.seriesId) : "var(--ink)"} />
          </div>
        </div>
        <div className="mt-[26px] flex min-w-0 flex-col border-t border-[var(--hairline)] pt-[18px] @min-[1100px]:mt-0 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:pt-0 @min-[1100px]:pl-9">
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
