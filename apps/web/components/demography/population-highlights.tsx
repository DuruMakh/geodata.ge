"use client";

import { placeColor, placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { populationBasisKey, type PopulationHighlights } from "../../lib/explorer/demographyPopulation";
import { formatInUnit, formatShare, MISSING, UNIT_DENSITY, UNIT_PERSONS } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { TemplateValues } from "../../lib/i18n/types";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle, SourceNote } from "../ui/editorial";
import { Sparkline } from "../ui/sparkline";

type Figure = { place: DemographyPlace; value: number; trend: Array<number | null> };

/** The hero and side KPIs the explorers share, describing the first selected place; nothing here is a change over time. */
export function PopulationHighlightsSection({ highlights }: { highlights: PopulationHighlights }) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const ink = "var(--ink)";
  const persons = (value: number | null) => formatInUnit(value, UNIT_PERSONS);
  const name = (place: DemographyPlace) => placeLabel(place, locale);
  const regionalFromNote = highlights.regionalFrom === null ? "" : t("regionalFrom", { year: highlights.regionalFrom });

  const figureKpi = (
    label: string,
    figure: Figure | null,
    value: (figure: Figure) => string,
    unit: string,
    detail: (figure: Figure) => string,
  ): SideKpi => ({
    label,
    value: figure ? value(figure) : MISSING,
    unit: figure ? unit : "",
    color: ink,
    detail: figure ? detail(figure) : regionalFromNote,
    wrapDetail: true,
    spark: figure ? { values: figure.trend, color: placeColor(figure.place) } : null,
  });

  let side: SideKpi[];
  let shareLine = "";
  if (highlights.kind === "country") {
    const georgia = highlights.persons;
    side = [
      figureKpi(t("sideLargestRegion"), highlights.largestRegion, (f) => persons(f.value), "", (f) =>
        georgia === null ? name(f.place) : `${name(f.place)} · ${formatShare(f.value / georgia)}`),
      figureKpi(t("sideDensestRegion"), highlights.densestRegion, (f) => formatInUnit(f.value, UNIT_DENSITY), t("densityUnit"), (f) => name(f.place)),
      figureKpi(t("sideSmallestMunicipality"), highlights.smallestMunicipality, (f) => persons(f.value), "", (f) => name(f.place)),
    ];
  } else if (highlights.kind === "region") {
    if (highlights.shareOfGeorgia !== null) shareLine = t("shareOfGeorgia", { share: formatShare(highlights.shareOfGeorgia) });
    side = [
      {
        label: t("sideRank"),
        value: highlights.rank === null ? MISSING : String(highlights.rank),
        unit: highlights.rank === null ? "" : `/ ${highlights.ofRegions}`,
        color: ink,
        detail: highlights.rank === null ? regionalFromNote : t("byPopulation"),
        spark: null,
      },
      {
        label: t("sideDensity"),
        value: highlights.density === null ? MISSING : formatInUnit(highlights.density, UNIT_DENSITY),
        unit: highlights.density === null ? "" : t("densityUnit"),
        color: ink,
        detail: highlights.densityRank === null ? regionalFromNote : t("densityRank", { rank: highlights.densityRank, of: highlights.ofRegions }),
        spark: { values: highlights.densityTrend, color: placeColor(highlights.place) },
      },
      { label: t("sideMunicipalities"), value: String(highlights.municipalityCount), unit: "", color: ink, detail: "", spark: null },
    ];
  } else {
    if (highlights.shareOfRegion !== null && highlights.region) {
      shareLine = t("shareOfRegion", { share: formatShare(highlights.shareOfRegion), region: name(highlights.region) });
    }
    side = [
      {
        label: t("sideRankMunicipalities"),
        value: highlights.rank === null ? MISSING : String(highlights.rank),
        unit: highlights.rank === null ? "" : `/ ${highlights.ofMunicipalities}`,
        color: ink,
        detail: highlights.rank === null ? regionalFromNote : t("byPopulation"),
        spark: null,
      },
      { label: t("sideShareOfGeorgia"), value: formatShare(highlights.shareOfGeorgia), unit: "", color: ink, detail: "", spark: null },
      {
        label: t("sideRegion"),
        value: persons(highlights.regionPersons),
        unit: "",
        color: ink,
        detail: highlights.region ? name(highlights.region) : "",
        wrapDetail: true,
        spark: null,
      },
    ];
  }

  const unavailable = highlights.persons === null && highlights.kind !== "country" ? regionalFromNote : "";
  return (
    <section data-testid="population-highlights" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>{t("highlights")}</SectionTitle>
        <p className="text-[12.5px] text-[var(--muted)]">{t("rowYear", { year: highlights.year })}</p>
      </div>
      <div className={KPI_GRID_CLASS}>
        <HeroKpi label={t("heroLabel", { place: name(highlights.place) })} value={persons(highlights.persons)}>
          <p className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--muted)]">
            {t("heroBasis", { year: highlights.year, basis: message(messages, populationBasisKey(highlights.year)) })}
          </p>
          {shareLine ? <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">{shareLine}</p> : null}
          {unavailable ? <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">{unavailable}</p> : null}
          <Sparkline values={highlights.trend} color={placeColor(highlights.place)} />
        </HeroKpi>
        <SideKpiList kpis={side} />
      </div>
      <div className="mt-5"><SourceNote>{t("highlightsNote")}</SourceNote></div>
    </section>
  );
}
