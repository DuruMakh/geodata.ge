import {
  BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_SECTOR_UNKNOWN, BUSINESS_SIZES, BUSINESS_SURVEY_SECTORS, businessFactKey, businessIndicator,
  type BusinessGroup, type BusinessIndicator, type BusinessMeasure, type ClientBusinessFact,
} from "../data/business/types";
import { INK, OTHER_COLOR } from "./colors";
import { refitRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { keepOneUnit, unitsOf } from "./unitList";

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

/**
 * `heading` places a top-level row under a heading of its list: Firm size or Industry on Sales and Jobs, or a unit group's
 * measure (counts and rates on Firms; money, jobs and firms on an area page), whose rows share one unit.
 */
export type BusinessHeading = "size" | "industry" | "count" | "rate" | "money" | "jobs" | "firms";
export type BusinessSeriesDefinition = { id: BusinessIndicator; reference: boolean; parentId?: BusinessIndicator; heading?: BusinessHeading };

/** The survey's breakdown (3 sizes, 14 industries); business demography's (18 NACE sections, then Geostat's unknown activity for counts only). */
const SURVEY_PARTS: readonly BusinessGroup[] = [...BUSINESS_SIZES, ...BUSINESS_SURVEY_SECTORS];
const COUNT_PARTS: readonly BusinessGroup[] = [...BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_SECTOR_UNKNOWN];
// The unknown activity's rates (a reclassification bucket, up to a 628% death rate) mislead, so the rate view does not list it.
const RATE_PARTS: readonly BusinessGroup[] = BUSINESS_DEMOGRAPHY_SECTORS;

/** A measure's total (under `heading`, if given) followed by its parts, nested under it. */
const withParts = (measure: BusinessMeasure, reference: boolean, parts: readonly BusinessGroup[], heading?: BusinessHeading): BusinessSeriesDefinition[] => {
  const total = businessIndicator(measure, "total");
  return [{ id: total, reference, ...(heading ? { heading } : {}) }, ...parts.map(group => ({ id: businessIndicator(measure, group), reference: false, parentId: total }))];
};
const sectionMeasure = { sales: "turnover", jobs: "employed" } as const;

/** The series a topic page lists, the reference (if any) first. Topic pages never list a region. */
export function businessTopicSeries(section: BusinessTopicId): BusinessSeriesDefinition[] {
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
    // Firms lists the counts, then Geostat's published rates, each under its heading.
    case "firms": return [
      ...withParts("active", false, COUNT_PARTS, "count"), ...withParts("births", false, COUNT_PARTS, "count"), ...withParts("deaths", false, COUNT_PARTS, "count"),
      ...withParts("birth_rate", false, RATE_PARTS, "rate"), ...withParts("death_rate", false, RATE_PARTS, "rate"),
    ];
  }
}

/** A page's initial selection: the reference alone, except that Firms compares new and closed firms (the approved default). */
export function businessDefaultSelection(section: BusinessTopicId): string[] {
  if (section === "firms") return ["business.births.total", "business.deaths.total"];
  return [businessTopicSeries(section)[0].id];
}

/**
 * Fixed colours for the firm sizes and for each measure's total (on the topic and area pages alike), so none takes a
 * palette colour by position that an industry already wears. Each is an existing palette hex that is no economic-sector
 * colour and sits at CIEDE2000 >= 11 from every sector of the lists it appears in. A rate wears its count's colour:
 * the two never share a chart. Sales and jobs totals are the ink reference; on an area page, where jobs is no reference,
 * it is ink too, since it never shares a chart with sales.
 */
const SIZE_COLORS: Readonly<Record<string, string>> = { size_large: "#4A707A", size_medium: "#A5822B", size_small: "#5B5347" };
const MEASURE_COLORS: Partial<Record<BusinessMeasure, string>> = {
  employed: INK, investment: "#4E5D74", profit: "#667722", loss: "#B3402A",
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

export type BusinessState = TopicState;
export type BusinessUnit = ClientBusinessFact["unit"];

/** A heading's text: a breakdown's name, or a unit group's measure followed by its unit (a firm count's name says its unit). */
export function businessHeadingLabel(heading: BusinessHeading, unit: BusinessUnit, t: (key: string) => string, unitLabels: Readonly<Record<BusinessUnit, string>>): string {
  if (heading === "size" || heading === "industry") return t(`heading.${heading}`);
  return unit === "enterprises" ? t(`measure.${heading}`) : `${t(`measure.${heading}`)} · ${unitLabels[unit]}`;
}

/** Series of different units never share a chart; the rule is `keepOneUnit`. */
export function keepOneBusinessUnit(next: readonly string[], previous: readonly string[], facts: readonly ClientBusinessFact[]): string[] {
  return keepOneUnit(next, previous, facts);
}

/** A list's years: every year any series of the selection's unit has a value, or any of its series when nothing is selected. */
export function businessListCoverage(definitions: readonly BusinessSeriesDefinition[], selectedIds: readonly string[], facts: readonly ClientBusinessFact[]) {
  const unitOf = unitsOf(facts);
  const ids = new Set<string>(definitions.filter(s => !selectedIds.length || unitOf(s.id) === unitOf(selectedIds[0])).map(s => s.id));
  return topicCoverage(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year), `No business years for ${definitions[0]?.id}`);
}

/** Reads a list's hash: a selection that mixes units keeps only its first row's unit, and the years fit that unit's coverage. */
export function parseBusinessListHash(hash: string, definitions: readonly BusinessSeriesDefinition[], fallback: readonly string[], facts: readonly ClientBusinessFact[]): TopicState {
  const parsed = parseTopicHash(new URLSearchParams(hash.replace(/^#/, "")), definitions, fallback, businessListCoverage(definitions, [], facts));
  const selectedIds = keepOneBusinessUnit(parsed.selectedIds, [], facts);
  return { ...parsed, selectedIds, range: refitRange(parsed.range, businessListCoverage(definitions, selectedIds, facts), { collapseToAll: true }) };
}

/** A list's new selection, kept to one unit; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export function changeBusinessSelection(state: TopicState, definitions: readonly BusinessSeriesDefinition[], next: readonly string[], facts: readonly ClientBusinessFact[]): TopicState {
  const selectedIds = keepOneBusinessUnit(next, state.selectedIds, facts);
  return { ...state, selectedIds, range: refitRange(state.range, businessListCoverage(definitions, selectedIds, facts), { collapseToAll: false }) };
}

/** A topic page's years for its selection (all of its series' years when nothing is selected). */
export function businessCoverage(section: BusinessTopicId, facts: readonly ClientBusinessFact[], selectedIds: readonly string[] = []) {
  return businessListCoverage(businessTopicSeries(section), selectedIds, facts);
}

export function defaultBusinessState(section: BusinessTopicId): BusinessState {
  return { mode: "line", range: { kind: "all" }, selectedIds: businessDefaultSelection(section) };
}

export function parseBusinessHash(hash: string, section: BusinessTopicId, facts: readonly ClientBusinessFact[]): BusinessState {
  return parseBusinessListHash(hash, businessTopicSeries(section), businessDefaultSelection(section), facts);
}

/** A topic or area page's hash: the keys every topic page shares, and nothing else. */
export const serializeBusinessHash = (state: TopicState) => serializeTopicHash(state);

/**
 * A nested series' line pattern. An industry wears its sector colour under every parent, so each parent's children take
 * their own stroke instead: the first parent of a unit's solid, its second's dashed, its third's dotted (a chart shows one
 * unit, and no unit has more than three parents). Top-level rows are solid.
 */
export type BusinessStroke = "solid" | "dashed" | "dotted";
const STROKES: readonly BusinessStroke[] = ["solid", "dashed", "dotted"];

export type BusinessSeriesModel = TopicSeriesModel<BusinessSeriesDefinition & { decimals: number; stroke: BusinessStroke; unit: BusinessUnit }>;
/** `unit` is the selection's (the list's first series' when nothing is selected). */
export type BusinessModel = { range: ResolvedPeriodRange; years: number[]; series: BusinessSeriesModel[]; selected: BusinessSeriesModel[]; unit: BusinessUnit };

/**
 * The years (the selection's unit's coverage), values, colours and units of a list of series. A year Geostat left blank
 * (such as the section death rates of 2016 and 2019) is null, never zero. Shared by the topic and area pages.
 */
export function buildBusinessSeriesModel(definitions: readonly BusinessSeriesDefinition[], facts: readonly ClientBusinessFact[], state: TopicState): BusinessModel {
  const byCell = new Map(facts.map(f => [businessFactKey(f), f]));
  const first = new Map<string, ClientBusinessFact>();
  for (const fact of facts) if (!first.has(fact.indicatorId)) first.set(fact.indicatorId, fact);
  const unitOf = (id: string) => first.get(id)!.unit;
  const parents = [...new Set(definitions.flatMap(definition => definition.parentId ?? []))];
  const model = buildTopicModel({ range: state.range, coverage: businessListCoverage(definitions, state.selectedIds, facts), selectedIds: state.selectedIds, color: businessSeriesColor,
    definitions: definitions.map(definition => ({ ...definition, decimals: first.get(definition.id)?.decimals ?? 0, unit: unitOf(definition.id),
      stroke: definition.parentId ? STROKES[parents.filter(parent => unitOf(parent) === unitOf(definition.parentId!)).indexOf(definition.parentId)] : "solid" })),
    value: (definition, year) => byCell.get(businessFactKey({ indicatorId: definition.id, year }))?.value });
  return { ...model, unit: (model.selected[0] ?? model.series[0]).unit };
}

export function buildBusinessModel(section: BusinessTopicId, facts: readonly ClientBusinessFact[], state: BusinessState): BusinessModel {
  return buildBusinessSeriesModel(businessTopicSeries(section), facts, state);
}
