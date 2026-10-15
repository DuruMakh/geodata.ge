import {
  BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_SECTOR_UNKNOWN, BUSINESS_SIZES, BUSINESS_SURVEY_SECTORS, businessFactKey, businessIndicator,
  type BusinessGroup, type BusinessIndicator, type BusinessMeasure, type ClientBusinessFact,
} from "../data/business/types";
import { INK, OTHER_COLOR } from "./colors";
import { refitRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";

export const BUSINESS_HUB_PATH = "/explorer/business";
export const BUSINESS_SECTIONS = [
  { id: "sales", href: "/explorer/business/sales", labelKey: "common.businessSales" },
  { id: "jobs", href: "/explorer/business/jobs", labelKey: "common.businessJobs" },
  { id: "investment-profit", href: "/explorer/business/investment-profit", labelKey: "common.businessInvestmentProfit" },
  { id: "firms", href: "/explorer/business/firms", labelKey: "common.businessFirms" },
  { id: "regions", href: "/explorer/business/regions", labelKey: "common.businessRegions" },
] as const;
export type BusinessSectionId = typeof BUSINESS_SECTIONS[number]["id"];
/** The four pages with a chart of national series; Regions is the map index of the area pages (businessAreas.ts). */
export type BusinessTopicId = Exclude<BusinessSectionId, "regions">;

/** Firms switches between counts and Geostat's published rates with the icon measure switch; the other pages have one view. */
export type BusinessView = "main" | "count" | "rate";
export function businessViews(section: BusinessTopicId): readonly BusinessView[] {
  return section === "firms" ? ["count", "rate"] : ["main"];
}

/** `heading` places a top-level row under the Firm size or Industry heading of the Sales and Jobs lists. */
export type BusinessSeriesDefinition = { id: BusinessIndicator; reference: boolean; parentId?: BusinessIndicator; heading?: "size" | "industry" };

/** The survey's breakdown (3 sizes, 14 industries); business demography's (18 NACE sections, then Geostat's unknown activity for counts only). */
const SURVEY_PARTS: readonly BusinessGroup[] = [...BUSINESS_SIZES, ...BUSINESS_SURVEY_SECTORS];
const COUNT_PARTS: readonly BusinessGroup[] = [...BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_SECTOR_UNKNOWN];
// The unknown activity's rates (a reclassification bucket, up to a 628% death rate) mislead, so the rate view does not list it.
const RATE_PARTS: readonly BusinessGroup[] = BUSINESS_DEMOGRAPHY_SECTORS;

/** A measure's total followed by its parts, nested under it. */
const withParts = (measure: BusinessMeasure, reference: boolean, parts: readonly BusinessGroup[]): BusinessSeriesDefinition[] => {
  const total = businessIndicator(measure, "total");
  return [{ id: total, reference }, ...parts.map(group => ({ id: businessIndicator(measure, group), reference: false, parentId: total }))];
};
const sectionMeasure = { sales: "turnover", jobs: "employed" } as const;

/** The series a view offers, the reference (if any) first. Topic pages never list a region. */
export function businessViewSeries(section: BusinessTopicId, view: BusinessView): BusinessSeriesDefinition[] {
  switch (section) {
    case "sales": case "jobs": {
      const measure = sectionMeasure[section];
      return [
        { id: businessIndicator(measure, "total"), reference: true },
        ...BUSINESS_SIZES.map(group => ({ id: businessIndicator(measure, group), reference: false, heading: "size" as const })),
        ...BUSINESS_SURVEY_SECTORS.map(group => ({ id: businessIndicator(measure, group), reference: false, heading: "industry" as const })),
      ];
    }
    case "investment-profit": return [...withParts("investment", true, SURVEY_PARTS), ...withParts("profit", false, SURVEY_PARTS), ...withParts("loss", false, SURVEY_PARTS)];
    case "firms": return view === "rate"
      ? [...withParts("birth_rate", false, RATE_PARTS), ...withParts("death_rate", false, RATE_PARTS)]
      : [...withParts("active", false, COUNT_PARTS), ...withParts("births", false, COUNT_PARTS), ...withParts("deaths", false, COUNT_PARTS)];
  }
}

/** A view's initial selection: the reference alone, except that Firms compares new and closed firms (the approved default). */
export function businessDefaultSelection(section: BusinessTopicId, view: BusinessView): string[] {
  if (section === "firms") return view === "rate" ? ["business.birth_rate.total", "business.death_rate.total"] : ["business.births.total", "business.deaths.total"];
  return [businessViewSeries(section, view)[0].id];
}

/**
 * Fixed colours for the firm sizes and for each measure's total (on the topic and area pages alike), so none takes a
 * palette colour by position that an industry already wears. Each is an existing palette hex that is no economic-sector
 * colour and sits at CIEDE2000 >= 11 from every sector of the lists it appears in. A rate wears its count's colour:
 * the two are never in one view. Sales and jobs totals are always the ink reference.
 */
const SIZE_COLORS: Readonly<Record<string, string>> = { size_large: "#4A707A", size_medium: "#A5822B", size_small: "#5B5347" };
const MEASURE_COLORS: Partial<Record<BusinessMeasure, string>> = {
  investment: "#4E5D74", profit: "#667722", loss: "#B3402A",
  active: "#5B5347", births: "#667722", deaths: "#B3402A", birth_rate: "#667722", death_rate: "#B3402A",
};

/**
 * The reference is ink. An industry wears its economic-sector colour under every parent (the survey's combined B–E group
 * wears manufacturing's, `sector.c`); Geostat's unknown activity is no sector and wears the shared "other" colour.
 * A size and a measure's total or region row wear their fixed colour.
 */
export function businessSeriesColor(series: BusinessSeriesDefinition, index: number): string {
  const [, measure, group] = series.id.split(".");
  if (series.reference) return INK;
  if (group === BUSINESS_SECTOR_UNKNOWN) return OTHER_COLOR;
  if (group.startsWith("sector_")) return topicSeriesColor(series, index, `sector.${group === "sector_b_e" ? "c" : group.slice("sector_".length)}`);
  return SIZE_COLORS[group] ?? MEASURE_COLORS[measure as BusinessMeasure] ?? topicSeriesColor(series, index);
}

export type BusinessState = TopicState & { view: BusinessView };

/** A view's years: every year any of its series has a value. */
export function businessCoverage(section: BusinessTopicId, view: BusinessView, facts: readonly ClientBusinessFact[]) {
  const ids = new Set<string>(businessViewSeries(section, view).map(s => s.id));
  return topicCoverage(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year), `No business years for ${section}:${view}`);
}

export function defaultBusinessState(section: BusinessTopicId): BusinessState {
  const view = businessViews(section)[0];
  return { mode: "line", range: { kind: "all" }, view, selectedIds: businessDefaultSelection(section, view) };
}

export function parseBusinessHash(hash: string, section: BusinessTopicId, facts: readonly ClientBusinessFact[]): BusinessState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const view = topicHashView(p, businessViews(section));
  return { ...parseTopicHash(p, businessViewSeries(section, view), businessDefaultSelection(section, view), businessCoverage(section, view, facts)), view };
}

/** Only Firms, the one page with two views, writes the `tab` key. */
export function serializeBusinessHash(state: BusinessState, section: BusinessTopicId): string {
  const p = new URLSearchParams();
  if (businessViews(section).length > 1) p.set("tab", state.view);
  return serializeTopicHash(state, p);
}

/** New and closed firms carry to and from their rates, group by group; anything else keeps its id. */
const RATE_OF: Partial<Record<BusinessMeasure, BusinessMeasure>> = { births: "birth_rate", deaths: "death_rate", birth_rate: "births", death_rate: "deaths" };
const counterpart = (id: string) => {
  const [, measure, group] = id.split(".");
  const other = RATE_OF[measure as BusinessMeasure];
  return other ? `business.${other}.${group}` : id;
};

/**
 * Switching the Firms measure keeps mode and years (clamped to the new view's coverage, never collapsed to "all") and
 * carries each new or closed firms row to its rate and back. Active firms has no rate and drops, as does the unknown
 * activity, whose rate is not listed; an empty result falls back to the new view's default selection.
 */
export function changeBusinessView(state: BusinessState, section: BusinessTopicId, view: BusinessView, facts: readonly ClientBusinessFact[]): BusinessState {
  const carried = new Set(state.selectedIds.map(counterpart));
  const selectedIds = businessViewSeries(section, view).map(s => s.id).filter(id => carried.has(id));
  return { ...state, view, selectedIds: selectedIds.length ? selectedIds : businessDefaultSelection(section, view), range: refitRange(state.range, businessCoverage(section, view, facts), { collapseToAll: false }) };
}

/**
 * A nested series' line pattern. An industry wears its sector colour under every parent, so each parent's children take
 * their own stroke instead: the first parent's solid, the second's dashed, the third's dotted. Top-level rows are solid.
 */
export type BusinessStroke = "solid" | "dashed" | "dotted";
const STROKES: readonly BusinessStroke[] = ["solid", "dashed", "dotted"];

export type BusinessSeriesModel = TopicSeriesModel<BusinessSeriesDefinition & { decimals: number; stroke: BusinessStroke }>;
export type BusinessModel = { range: ResolvedPeriodRange; years: number[]; series: BusinessSeriesModel[]; selected: BusinessSeriesModel[]; unit: ClientBusinessFact["unit"] };

/**
 * The years, values and colours of a list of series, with the unit of its first series. A year Geostat left blank
 * (such as the section death rates of 2016 and 2019) is null, never zero. Shared by the topic and area pages.
 */
export function buildBusinessSeriesModel(definitions: readonly BusinessSeriesDefinition[], coverage: ReturnType<typeof topicCoverage>, facts: readonly ClientBusinessFact[], state: TopicState): BusinessModel {
  const byCell = new Map(facts.map(f => [businessFactKey(f), f]));
  const first = (id: string) => facts.find(f => f.indicatorId === id);
  const parents = [...new Set(definitions.flatMap(definition => definition.parentId ?? []))];
  return {
    ...buildTopicModel({ range: state.range, coverage, selectedIds: state.selectedIds, color: businessSeriesColor,
      definitions: definitions.map(definition => ({ ...definition, decimals: first(definition.id)?.decimals ?? 0,
        stroke: definition.parentId ? STROKES[parents.indexOf(definition.parentId)] : "solid" })),
      value: (definition, year) => byCell.get(businessFactKey({ indicatorId: definition.id, year }))?.value }),
    unit: first(definitions[0].id)!.unit,
  };
}

export function buildBusinessModel(section: BusinessTopicId, facts: readonly ClientBusinessFact[], state: BusinessState): BusinessModel {
  return buildBusinessSeriesModel(businessViewSeries(section, state.view), businessCoverage(section, state.view, facts), facts, state);
}
