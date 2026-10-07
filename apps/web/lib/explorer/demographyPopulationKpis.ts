import type { SideKpi } from "../../components/main-explorer/kpi-blocks";
import { message } from "../i18n/messages";
import type { Locale, Messages, TemplateValues } from "../i18n/types";
import { placeColor, placeLabel, type DemographyPlace } from "./demographyAreas";
import { populationBasisKey, type PopulationHighlights } from "./demographyPopulation";
import { formatInUnit, formatShare, MISSING, UNIT_DENSITY, UNIT_PERSONS } from "./format";
import type { MunicipalKpi } from "./municipalData";

type Figure = { place: DemographyPlace; value: number; trend: Array<number | null> };

export type PopulationKpis = {
  heroLabel: string;
  heroValue: string;
  /** `1 January 2026 · based on the 2024 census`. */
  heroBasis: string;
  /** One sentence under the hero: the place's share of Georgia or of its region; empty when there is none. */
  shareLine: string;
  /** Why a figure is missing (a range that ends before regional data starts); empty otherwise. */
  unavailable: string;
  side: SideKpi[];
};

/** The hero and side figures that describe one place for the end year of the range. Nothing here is a change over time. */
export function buildPopulationKpis(highlights: PopulationHighlights, messages: Messages, locale: Locale): PopulationKpis {
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
  return {
    heroLabel: t("heroLabel", { place: name(highlights.place) }),
    heroValue: persons(highlights.persons),
    heroBasis: t("heroBasis", { year: highlights.year, basis: message(messages, populationBasisKey(highlights.year)) }),
    shareLine,
    unavailable: highlights.persons === null && highlights.kind !== "country" ? regionalFromNote : "",
    side,
  };
}

/** The four tiles of the index: Georgia's hero and its three side figures. A unit the tile cannot carry moves into its detail line. */
export function populationIndexKpis(kpis: PopulationKpis, unitInDetail: string): MunicipalKpi[] {
  return [
    { label: kpis.heroLabel, value: kpis.heroValue, detail: kpis.heroBasis },
    ...kpis.side.map((kpi) => ({ label: kpi.label, value: kpi.value, detail: kpi.unit ? `${kpi.detail} · ${unitInDetail}` : kpi.detail })),
  ];
}
