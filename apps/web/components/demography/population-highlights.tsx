"use client";

import { placeColor } from "../../lib/explorer/demographyAreas";
import type { PopulationHighlights } from "../../lib/explorer/demographyPopulation";
import { buildPopulationKpis } from "../../lib/explorer/demographyPopulationKpis";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { TemplateValues } from "../../lib/i18n/types";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";
import { SectionTitle, SourceNote } from "../ui/editorial";
import { Sparkline } from "../ui/sparkline";

/** The hero and side KPIs the explorers share, describing one place; nothing here is a change over time. */
export function PopulationHighlightsSection({
  highlights,
  densityNote,
}: {
  highlights: PopulationHighlights;
  /** The area note for a page that shows a density; it renders under the highlights note, and nothing renders without it. */
  densityNote?: string;
}) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const kpis = buildPopulationKpis(highlights, messages, locale);
  return (
    <section data-testid="population-highlights" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>{t("highlights")}</SectionTitle>
        <p className="text-[0.78125rem] text-[var(--muted)]">{t("rowYear", { year: highlights.year })}</p>
      </div>
      <div className={KPI_GRID_CLASS}>
        <HeroKpi label={kpis.heroLabel} value={kpis.heroValue}>
          <p className="font-[family-name:var(--font-numeric)] text-[0.75rem] text-[var(--muted)]">{kpis.heroBasis}</p>
          {kpis.shareLine ? <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">{kpis.shareLine}</p> : null}
          {kpis.unavailable ? <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">{kpis.unavailable}</p> : null}
          <Sparkline values={highlights.trend} color={placeColor(highlights.place)} />
        </HeroKpi>
        <SideKpiList kpis={kpis.side} />
      </div>
      <div className="mt-5"><SourceNote>{t("highlightsNote")}</SourceNote></div>
      {densityNote ? <div className="mt-1"><SourceNote testId="population-density-note">{densityNote}</SourceNote></div> : null}
    </section>
  );
}
