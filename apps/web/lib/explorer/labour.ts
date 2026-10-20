import { LABOUR_HOURS_GROUPS, LABOUR_INDICATORS, labourFactKey, type ClientLabourFact, type LabourIndicator, type LabourUnit } from "../data/labour/types";
import { colorForItem, colorForProgram, INK, OTHER_COLOR } from "./colors";
import type { ValueUnit } from "./format";
import { refitRange, resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, type TopicCoverage, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { listLatestByHeading } from "./unitList";

/** The four Labour Force Survey detail pages, listed after Unemployment's own four. */
export const LABOUR_SECTIONS = [
  { id: "industries", href: "/explorer/unemployment/industries", labelKey: "common.unemploymentIndustries" },
  { id: "hours", href: "/explorer/unemployment/hours", labelKey: "common.unemploymentHours" },
  { id: "informal", href: "/explorer/unemployment/informal", labelKey: "common.unemploymentInformal" },
  { id: "young-people", href: "/explorer/unemployment/young-people", labelKey: "common.unemploymentYoungPeople" },
] as const;
export type LabourSectionId = typeof LABOUR_SECTIONS[number]["id"];

export type LabourHeading = "all" | "women" | "men" | "urban" | "rural" | "informal" | "age_15_24" | "age_15_29";
/** `heading` is the group a row is listed under; `item` keys its name (`labour.row.<item>`), the same under every heading. */
export type LabourSeriesDefinition = { id: LabourIndicator; reference: boolean; heading: LabourHeading; item: string };

/** A table's rows in the indicator list's order, under one heading; `item` names a row from the rest of its id. */
const rows = (prefix: string, heading: LabourHeading, item = (rest: string) => rest): LabourSeriesDefinition[] =>
  LABOUR_INDICATORS.filter(id => id.startsWith(prefix)).map(id => ({ id, reference: false, heading, item: item(id.slice(prefix.length)) }));

/** Each page's rows, heading by heading in Geostat's table order (spec §§4–7); the first row is the page total, the reference. */
export function labourSeries(section: LabourSectionId): LabourSeriesDefinition[] {
  const listed = (() => {
    switch (section) {
      case "industries": return (["all", "women", "men"] as const).flatMap(group => rows(`labour.jobs.${group}.`, group));
      case "hours": return LABOUR_HOURS_GROUPS.flatMap(group => rows(`labour.hours.${group}.`, group));
      // Geostat's informal total is Georgia's row, so it is named "Georgia", not "Total".
      case "informal": return rows("labour.informal.", "informal", item => item === "total" ? "georgia" : item);
      case "young-people": return (["age_15_24", "age_15_29"] as const).flatMap(age => rows(`labour.neet.${age}.`, age));
    }
  })();
  return listed.map((series, index) => ({ ...series, reference: index === 0 }));
}

export function labourDefaultSelection(section: LabourSectionId): string[] {
  return [labourSeries(section)[0].id];
}

const UNITS: Record<LabourSectionId, LabourUnit> = { industries: "thousand_persons", hours: "hours", informal: "percent", "young-people": "percent" };
/** Each page has one unit, so any mix of its rows is charted together. */
export function labourUnit(section: LabourSectionId): LabourUnit {
  return UNITS[section];
}

/** Thousands of people, hours and percentages all show Geostat's one decimal. */
export const ONE_DECIMAL: ValueUnit = { divisor: 1, label: "", decimals: 1 };

/** A row's name outside the list: alone under Everyone ("Construction"), else with its heading ("Women — Construction"). */
export function labourFullLabel(heading: LabourHeading, headingLabel: string, rowLabel: string): string {
  return heading === "all" ? rowLabel : `${headingLabel} — ${rowLabel}`;
}

/**
 * Households and extra-territorial bodies (NACE U) have no economic-sector colour, as the Economy pages list no such
 * sector; it wears an existing palette hex that is no sector colour, at CIEDE2000 >= 12 from every sector, "other" and ink.
 */
const SECTOR_U_COLOR = "#5B5347";

/** An industry's colour under Everyone: its NACE section's (the B–E row wears manufacturing's), "other" for Geostat's not identified. */
function industryColor(item: string): string {
  if (item === "total") return INK;
  if (item === "not_identified") return OTHER_COLOR;
  if (item === "sector_u") return SECTOR_U_COLOR;
  return colorForItem(`sector.${item === "sector_b_e" ? "c" : item.slice("sector_".length)}`, 0);
}

/**
 * The reference is ink. An industry under Everyone wears its sector colour; under women, men, towns and villages it wears
 * that colour's shade for the heading (women the first step, men the second…), so a sector keeps its hue under every
 * heading and its jobs and hours rows match. Informal-work and young-people rows take the palette by position.
 */
export function labourSeriesColor(series: LabourSeriesDefinition, index: number): string {
  if (series.reference) return INK;
  const [, table, group] = series.id.split(".");
  if (table !== "jobs" && table !== "hours") return colorForItem(series.id, index);
  const ordinal = LABOUR_HOURS_GROUPS.indexOf(group as typeof LABOUR_HOURS_GROUPS[number]) - 1;
  const base = industryColor(series.item);
  return ordinal < 0 ? base : colorForProgram(base, ordinal);
}

export type LabourState = TopicState;

/**
 * A page's years: every year any selected row has a value, or any of the page's rows when nothing is selected or the
 * selection has no value at all (Geostat's unpublished men in households as employers), so the chart still has its years.
 */
export function labourCoverage(section: LabourSectionId, facts: readonly ClientLabourFact[], selectedIds: readonly string[] = []): TopicCoverage {
  const yearsOf = (ids: ReadonlySet<string>) => facts.filter(f => ids.has(f.indicatorId)).map(f => f.year);
  const selected = yearsOf(new Set(selectedIds));
  return topicCoverage(selected.length ? selected : yearsOf(new Set(labourSeries(section).map(s => s.id))), `No labour years for ${section}`);
}

/**
 * Reads the hash: a selection naming nothing the page lists (a link from another page) falls back to the default, an
 * explicit empty one stays empty, and the years fit the selection's coverage.
 */
export function parseLabourHash(hash: string, section: LabourSectionId, facts: readonly ClientLabourFact[]): LabourState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const parsed = parseTopicHash(p, labourSeries(section), labourDefaultSelection(section), labourCoverage(section, facts));
  const selectedIds = parsed.selectedIds.length || p.get("sel") === "" ? parsed.selectedIds : labourDefaultSelection(section);
  return { ...parsed, selectedIds, range: refitRange(parsed.range, labourCoverage(section, facts, selectedIds), { collapseToAll: true }) };
}

/** A new selection; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export function changeLabourSelection(state: LabourState, section: LabourSectionId, next: readonly string[], facts: readonly ClientLabourFact[]): LabourState {
  return { ...state, selectedIds: [...next], range: refitRange(state.range, labourCoverage(section, facts, next), { collapseToAll: false }) };
}

/** A page's hash: the keys every topic page shares, and nothing else. */
export const serializeLabourHash = (state: LabourState) => serializeTopicHash(state);

export type LabourSeriesModel = TopicSeriesModel<LabourSeriesDefinition>;
export type LabourModel = { range: ResolvedPeriodRange; years: number[]; series: LabourSeriesModel[]; selected: LabourSeriesModel[]; unit: LabourUnit };

/** The years, values and colours of a page's rows. A year without a value (before a row starts, or never published) is null, never zero. */
export function buildLabourModel(section: LabourSectionId, facts: readonly ClientLabourFact[], state: LabourState): LabourModel {
  const byCell = new Map(facts.map(f => [labourFactKey(f), f.value]));
  const model = buildTopicModel({
    range: state.range, coverage: labourCoverage(section, facts, state.selectedIds), definitions: labourSeries(section), selectedIds: state.selectedIds,
    color: labourSeriesColor, value: (definition, year) => byCell.get(labourFactKey({ indicatorId: definition.id, year })),
  });
  return { ...model, unit: labourUnit(section) };
}

/**
 * The list's figures: each row's latest value up to the chosen years' end over all of the page's years (never the
 * selection's, so ticking a row never changes the numbers shown). A row without any value has no figure and shows a dash.
 */
export function labourList(section: LabourSectionId, facts: readonly ClientLabourFact[], state: LabourState) {
  const end = resolveRange(state.range, labourCoverage(section, facts)).end;
  return { end, rows: listLatestByHeading(facts, labourSeries(section), end) };
}
