import type { ClientHouseholdFact, HouseholdArea, HouseholdIndicator, HouseholdMeasure } from "../data/household/types";
import { HOUSEHOLD_AREAS, HOUSEHOLD_MEASURES, householdFactKey } from "../data/household/types";
import { colorForItem, INK } from "./colors";
import { resolveRange, refitRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export const HOUSEHOLD_SECTIONS = [
  { id: "income", href: "/explorer/living-standards/income", labelKey: "common.householdIncome" },
  { id: "spending", href: "/explorer/living-standards/spending", labelKey: "common.householdSpending" },
] as const;
export type HouseholdSectionId = typeof HOUSEHOLD_SECTIONS[number]["id"];
/** Towns and villages are lines of Georgia's list, not areas a page shows: those are Georgia and the eleven regions. */
const SETTLEMENTS: readonly HouseholdArea[] = ["settlement.urban", "settlement.rural"];
const MEASURE_KEYS: Record<HouseholdMeasure, string> = { per_household: "household", per_capita: "person" };

export type HouseholdSeriesDefinition = { id: string; indicatorId: HouseholdIndicator; areaId: HouseholdArea; reference: boolean; parentId?: string };

/** A parent followed by its children, which nest under it. */
const GROUPS: Record<HouseholdSectionId, ReadonlyArray<{ parent: HouseholdIndicator; reference: boolean; children: readonly HouseholdIndicator[] }>> = {
  income: [
    { parent: "income.total", reference: true, children: ["income.wages", "income.self_employment", "income.agriculture_sales", "income.property", "income.pensions_assistance", "income.remittances", "income.gifts", "income.non_cash"] },
    { parent: "income.other_inflows", reference: false, children: ["income.borrowing_dissaving", "income.property_disposal"] },
  ],
  spending: [
    { parent: "spending.consumption", reference: true, children: ["spending.food", "spending.clothing", "spending.household_goods", "spending.health", "spending.housing_utilities", "spending.transport", "spending.education", "spending.other_consumption", "spending.non_cash"] },
    { parent: "spending.non_consumption", reference: false, children: ["spending.saving_lending", "spending.agriculture", "spending.transfers", "spending.property"] },
  ],
};

/** The section's headline indicator: its first group's reference total. The map, the towns and villages lines, the hub cards and the latest-value line show it. */
export const sectionTotal = (section: HouseholdSectionId): HouseholdIndicator => GROUPS[section][0].parent;

/** The series an area offers, reference first: the section's total and its parts; Georgia then adds its towns and villages totals. */
export function householdViewSeries(section: HouseholdSectionId, area: HouseholdArea): HouseholdSeriesDefinition[] {
  const parts = GROUPS[section].flatMap(({ parent, reference, children }) => [
    { id: parent, indicatorId: parent, areaId: area, reference },
    ...children.map(indicatorId => ({ id: indicatorId, indicatorId, areaId: area, reference: false, parentId: parent })),
  ]);
  return area === "georgia" ? [...parts, ...SETTLEMENTS.map(areaId => ({ id: areaId, indicatorId: sectionTotal(section), areaId, reference: false }))] : parts;
}

export function householdSeriesColor(series: HouseholdSeriesDefinition, index: number): string {
  return series.reference ? INK : colorForItem(series.id, index);
}

export type HouseholdState = { mode: "line" | "table"; range: PeriodRange; area: HouseholdArea; measure: HouseholdMeasure; selectedIds: string[] };

/** An area's years: every year any of its series has a value for the measure. */
export function householdCoverage(section: HouseholdSectionId, area: HouseholdArea, measure: HouseholdMeasure, facts: readonly ClientHouseholdFact[]) {
  const cells = new Set(householdViewSeries(section, area).map(s => `${s.indicatorId}:${s.areaId}`));
  const years = [...new Set(facts.filter(f => f.measure === measure && cells.has(`${f.indicatorId}:${f.areaId}`)).map(f => f.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error(`No household years for ${section}:${area}:${measure}`);
  return { min: years[0], max: years.at(-1)!, years };
}

export function defaultHouseholdState(section: HouseholdSectionId): HouseholdState {
  return { mode: "line", range: { kind: "all" }, area: "georgia", measure: "per_household", selectedIds: [householdViewSeries(section, "georgia")[0].id] };
}

/**
 * An old link's tab is ignored, and its towns or villages area opens Georgia, whose list has them as lines.
 * A selection naming nothing the area has (an old Regions-tab link) falls back to the first series; an empty one stays empty.
 */
export function parseHouseholdHash(hash: string, section: HouseholdSectionId, facts: readonly ClientHouseholdFact[]): HouseholdState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const area = HOUSEHOLD_AREAS.find(item => item === p.get("area") && !SETTLEMENTS.includes(item)) ?? "georgia";
  const measure = HOUSEHOLD_MEASURES.find(item => MEASURE_KEYS[item] === p.get("per")) ?? "per_household";
  const series = householdViewSeries(section, area);
  const requested = p.has("sel") ? p.get("sel")!.split(",") : [series[0].id];
  const selectedIds = series.map(s => s.id).filter(id => requested.includes(id));
  return {
    mode: p.get("view") === "table" ? "table" : "line", area, measure,
    range: refitRange(parseYearRangeKeys(p), householdCoverage(section, area, measure, facts), { collapseToAll: true }),
    selectedIds: selectedIds.length || p.get("sel") === "" ? selectedIds : [series[0].id],
  };
}

export function serializeHouseholdHash(state: HouseholdState): string {
  const p = new URLSearchParams();
  if (state.area !== "georgia") p.set("area", state.area);
  p.set("per", MEASURE_KEYS[state.measure]);
  p.set("view", state.mode);
  p.set("sel", state.selectedIds.join(","));
  writeYearRangeKeys(p, state.range);
  return p.toString();
}

/**
 * Fits a chosen range to the coverage of a newly chosen area or measure. A range the new coverage
 * misses entirely lands on that coverage as a manual range, so choosing the previous area again shows
 * the years the new one showed rather than widening to everything.
 */
function fitRange(state: HouseholdState, coverage: { min: number; max: number }): PeriodRange {
  const range = refitRange(state.range, coverage, { collapseToAll: false });
  return range.kind === "all" && state.range.kind === "manual" ? { kind: "manual", start: coverage.min, end: coverage.max } : range;
}

/**
 * Switching area keeps the ticked lines the new area has (towns and villages are Georgia's alone), or its first series
 * when none of them remain; a region that starts later narrows the years.
 */
export function changeHouseholdArea(state: HouseholdState, section: HouseholdSectionId, area: HouseholdArea, facts: readonly ClientHouseholdFact[]): HouseholdState {
  const ids = householdViewSeries(section, area).map(series => series.id);
  const kept = state.selectedIds.filter(id => ids.includes(id));
  return { ...state, area, selectedIds: kept.length || !state.selectedIds.length ? kept : [ids[0]], range: fitRange(state, householdCoverage(section, area, state.measure, facts)) };
}

export function changeHouseholdMeasure(state: HouseholdState, section: HouseholdSectionId, measure: HouseholdMeasure, facts: readonly ClientHouseholdFact[]): HouseholdState {
  return { ...state, measure, range: fitRange(state, householdCoverage(section, state.area, measure, facts)) };
}

export type HouseholdSeriesModel = HouseholdSeriesDefinition & { color: string; valuesByYear: Record<number, number | null>; endValue: number | null };
export type HouseholdModel = { range: ResolvedPeriodRange; years: number[]; series: HouseholdSeriesModel[]; selected: HouseholdSeriesModel[] };

export function buildHouseholdModel(section: HouseholdSectionId, facts: readonly ClientHouseholdFact[], state: HouseholdState): HouseholdModel {
  const range = resolveRange(state.range, householdCoverage(section, state.area, state.measure, facts));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const byCell = new Map(facts.map(f => [householdFactKey(f), f]));
  const series = householdViewSeries(section, state.area).map((definition, index) => {
    const valuesByYear = Object.fromEntries(years.map(year => [year, byCell.get(householdFactKey({ ...definition, measure: state.measure, year }))?.value ?? null]));
    return { ...definition, color: householdSeriesColor(definition, index), valuesByYear, endValue: valuesByYear[range.end] };
  });
  return { range, years, series, selected: series.filter(s => state.selectedIds.includes(s.id)) };
}
