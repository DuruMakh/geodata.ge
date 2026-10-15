import { HEALTH_INDICATORS, healthFactKey, type ClientHealthFact, type HealthArea, type HealthIndicator, type HealthSeriesBreak } from "../data/health/types";
import { refitRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicCoverage, type TopicSeriesModel, type TopicState } from "./topicSeries";

export const HEALTH_HUB_PATH = "/explorer/health";

export const HEALTH_SECTIONS = [
  { id: "doctors-hospitals", href: `${HEALTH_HUB_PATH}/doctors-hospitals`, labelKey: "common.healthDoctorsHospitals" },
  { id: "illnesses", href: `${HEALTH_HUB_PATH}/illnesses`, labelKey: "common.healthIllnesses" },
  { id: "causes-of-death", href: `${HEALTH_HUB_PATH}/causes-of-death`, labelKey: "common.healthCausesOfDeath" },
] as const;
export type HealthSectionId = typeof HEALTH_SECTIONS[number]["id"];
/** The sections that read national figures; causes of death have an index map and a page per area (see `healthDeaths.ts`). */
export type HealthNationalSectionId = Exclude<HealthSectionId, "causes-of-death">;

/** Doctors and hospitals switch between four measures; illnesses have one. */
export type HealthView = "staff" | "hospitals" | "beds" | "visits" | "main";
const VIEWS: Record<HealthNationalSectionId, readonly HealthView[]> = { "doctors-hospitals": ["staff", "hospitals", "beds", "visits"], "illnesses": ["main"] };

export function healthViews(section: HealthNationalSectionId): readonly HealthView[] {
  return VIEWS[section];
}

export type HealthSeriesDefinition = { id: HealthIndicator; reference: boolean; parentId?: HealthIndicator; heading?: "groups" | "single" };

const ids = (prefix: string) => HEALTH_INDICATORS.filter(id => id.startsWith(prefix));
/** The six diseases published as persons rather than as ICD-10 groups in thousands. */
const SINGLE_DISEASES: readonly HealthIndicator[] = ["health.illness.tuberculosis", "health.illness.hiv", "health.illness.diabetes", "health.illness.anaemia", "health.illness.syphilis", "health.illness.gonorrhoea"];
const ILLNESS_GROUPS = ids("health.illness.").filter(id => !SINGLE_DISEASES.includes(id));
const top = (id: HealthIndicator, reference = false): HealthSeriesDefinition => ({ id, reference });
/** A total followed by the parts that nest under it. */
const withParts = (id: HealthIndicator, reference: boolean, parts: readonly HealthIndicator[]): HealthSeriesDefinition[] =>
  [top(id, reference), ...parts.map(part => ({ id: part, reference: false, parentId: id }))];

/** The series a view offers, reference first. */
export function healthViewSeries(section: HealthNationalSectionId, view: HealthView): HealthSeriesDefinition[] {
  switch (view) {
    case "staff": return [...withParts("health.staff.doctors", true, ids("health.staff.doctors_")), ...withParts("health.staff.nurses", false, ids("health.staff.nurses_"))];
    case "hospitals": return [top("health.facilities.hospitals"), top("health.facilities.outpatient_clinics")];
    case "beds": return [top("health.facilities.beds")];
    case "visits": return [top("health.visits.outpatient")];
    case "main": return section === "illnesses"
      ? [...ILLNESS_GROUPS.map(id => ({ ...top(id), heading: "groups" as const })), ...SINGLE_DISEASES.map(id => ({ ...top(id), heading: "single" as const }))]
      : [];
  }
}

/**
 * How a series is shown: the stored figure times `multiplier` (an exact power of ten), in the unit `unitKey` names.
 * Beds are stored in thousand and shown as beds, visits in thousand and shown in million, single diseases in persons
 * and shown in thousand.
 */
export function healthDisplay(view: HealthView, indicatorId: HealthIndicator): { multiplier: number; unitKey: string } {
  switch (view) {
    case "staff": return { multiplier: 1, unitKey: "health.unitPersons" };
    case "hospitals": return { multiplier: 1, unitKey: "health.unitUnits" };
    case "beds": return { multiplier: 1000, unitKey: "health.unitBeds" };
    case "visits": return { multiplier: 0.001, unitKey: "health.unitMillionVisits" };
    case "main": return { multiplier: SINGLE_DISEASES.includes(indicatorId) ? 0.001 : 1, unitKey: "health.unitThousandCases" };
  }
}

/** A power of ten applied to a published figure; rounding to 15 digits removes the binary noise (933 x 0.001 is 0.933). */
const scaled = (value: number, multiplier: number) => multiplier === 1 ? value : Number((value * multiplier).toPrecision(15));
/** The facts of one area. National pages read `georgia`. */
const areaFacts = (facts: readonly ClientHealthFact[], area: HealthArea) => facts.filter(f => f.areaId === area);

/** The years any of the series has a value for in the area. */
export function healthSeriesCoverage(facts: readonly ClientHealthFact[], area: HealthArea, definitions: readonly { id: string }[], missing: string): TopicCoverage {
  const wanted = new Set<string>(definitions.map(d => d.id));
  return topicCoverage(areaFacts(facts, area).filter(f => wanted.has(f.indicatorId)).map(f => f.year), missing);
}

/** A view's years: every year any of its series has a value. */
export function healthCoverage(section: HealthNationalSectionId, view: HealthView, facts: readonly ClientHealthFact[]): TopicCoverage {
  return healthSeriesCoverage(facts, "georgia", healthViewSeries(section, view), `No health years for ${section}:${view}`);
}

const ILLNESS_DEFAULT_COUNT = 5;
/** Out-patient visits are always shown in million with one decimal. */
const VISITS_DECIMALS = 1;

/**
 * A view's initial selection: its first series. Illnesses start on the five disease groups with the largest value in
 * the latest year of the illness facts (largest first, ties in series order); a group without a value that year is not
 * in the running, as the combined nervous group ended in 2005.
 */
export function healthDefaultSelection(section: HealthNationalSectionId, view: HealthView, facts: readonly ClientHealthFact[]): string[] {
  const series = healthViewSeries(section, view);
  if (section !== "illnesses") return [series[0].id];
  const own = areaFacts(facts, "georgia").filter(f => series.some(s => s.id === f.indicatorId));
  const year = Math.max(...own.map(f => f.year));
  const latest = new Map(own.filter(f => f.year === year).map(f => [f.indicatorId, f.value]));
  return series.filter(s => s.heading === "groups" && latest.has(s.id))
    .map((s, order) => ({ id: s.id, order, value: latest.get(s.id)! }))
    .sort((a, b) => b.value - a.value || a.order - b.order)
    .slice(0, ILLNESS_DEFAULT_COUNT).map(s => s.id);
}

export const healthSeriesColor = (series: { id: string; reference: boolean }, index: number): string => topicSeriesColor(series, index);

export type HealthState = TopicState & { view: HealthView };

export function defaultHealthState(section: HealthNationalSectionId, facts: readonly ClientHealthFact[]): HealthState {
  const view = healthViews(section)[0];
  return { mode: "line", range: { kind: "all" }, view, selectedIds: healthDefaultSelection(section, view, facts) };
}

/**
 * Reads the hash. `tab` names the view on Doctors and hospitals only (an unknown one is staff). A selection naming
 * nothing the view has, such as a link from another view, falls back to the view's default; an empty one stays empty.
 */
export function parseHealthHash(hash: string, section: HealthNationalSectionId, facts: readonly ClientHealthFact[]): HealthState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const view = topicHashView(p, healthViews(section));
  const fallback = healthDefaultSelection(section, view, facts);
  const { selectedIds, ...rest } = parseTopicHash(p, healthViewSeries(section, view), fallback, healthCoverage(section, view, facts));
  return { ...rest, view, selectedIds: selectedIds.length || p.get("sel") === "" ? selectedIds : fallback };
}

export function serializeHealthHash(state: HealthState, section: HealthNationalSectionId): string {
  const p = new URLSearchParams();
  if (healthViews(section).length > 1) p.set("tab", state.view);
  return serializeTopicHash(state, p);
}

/** Switching view selects the new view's default and keeps mode; a chosen range is clamped to the new coverage, never collapsed to "all". */
export function changeHealthView(state: HealthState, section: HealthNationalSectionId, view: HealthView, facts: readonly ClientHealthFact[]): HealthState {
  return { ...state, view, selectedIds: healthDefaultSelection(section, view, facts), range: refitRange(state.range, healthCoverage(section, view, facts), { collapseToAll: false }) };
}

export type HealthSeriesModel<D extends { id: string; reference: boolean } = HealthSeriesDefinition> = TopicSeriesModel<D & { decimals: number }>;

/**
 * The values of one area's series over a range, scaled for display. `scale` gives a series' multiplier and, when the
 * series is always shown with the same number of decimals, that number (visits). Otherwise the decimals are the
 * published ones less the multiplier's power of ten, never below 0: beds 3 less 3, single diseases 0 less -3.
 */
export function buildHealthSeriesModel<D extends { id: string; reference: boolean; parentId?: string }>(input: {
  facts: readonly ClientHealthFact[]; area: HealthArea; range: PeriodRange; coverage: TopicCoverage; definitions: readonly D[]; selectedIds: readonly string[];
  scale: (definition: D) => { multiplier: number; fixedDecimals?: number };
}): { range: ResolvedPeriodRange; years: number[]; series: HealthSeriesModel<D>[]; selected: HealthSeriesModel<D>[]; decimals: number } {
  const own = areaFacts(input.facts, input.area);
  const byCell = new Map(own.map(f => [healthFactKey(f), f]));
  const decimalsOf = (definition: D) => {
    const { multiplier, fixedDecimals } = input.scale(definition);
    const published = Math.max(0, ...own.filter(f => f.indicatorId === definition.id).map(f => f.decimals));
    return fixedDecimals ?? Math.max(0, published - Math.round(Math.log10(multiplier)));
  };
  const model = buildTopicModel({
    range: input.range, coverage: input.coverage, selectedIds: input.selectedIds, color: healthSeriesColor,
    definitions: input.definitions.map(definition => ({ ...definition, decimals: decimalsOf(definition) })),
    value: (definition, year) => {
      const value = byCell.get(healthFactKey({ indicatorId: definition.id as HealthIndicator, areaId: input.area, year }))?.value;
      return value === undefined ? undefined : scaled(value, input.scale(definition).multiplier);
    },
  });
  return { ...model, decimals: Math.max(0, ...model.selected.map(s => s.decimals)) };
}

export type HealthModel = {
  range: ResolvedPeriodRange; years: number[]; series: HealthSeriesModel[]; selected: HealthSeriesModel[];
  unitKey: string; decimals: number;
  /** The counting changes inside the range that touch a selected series: the chart draws a gap and a rule, the table marks the year. */
  breaks: { year: number; label: "newCounting" }[];
};

/** Recorded in the register but not drawn: the 2006 ICD-10 split is told by the series themselves. */
const UNDRAWN_BREAKS: readonly string[] = ["icd10_groups_2006"];

export function buildHealthModel(section: HealthNationalSectionId, facts: readonly ClientHealthFact[], state: HealthState, breaks: readonly HealthSeriesBreak[]): HealthModel {
  const definitions = healthViewSeries(section, state.view);
  const model = buildHealthSeriesModel({
    facts, area: "georgia", range: state.range, coverage: healthCoverage(section, state.view, facts), definitions, selectedIds: state.selectedIds,
    scale: definition => {
      const { multiplier } = healthDisplay(state.view, definition.id);
      return { multiplier, fixedDecimals: state.view === "visits" ? VISITS_DECIMALS : undefined };
    },
  });
  const selected = new Set(state.selectedIds);
  const years = breaks.filter(item => !UNDRAWN_BREAKS.includes(item.breakId) && item.appliesTo.some(id => selected.has(id)))
    .map(item => Number(item.referenceDate.slice(0, 4))).filter(year => year > model.range.start && year <= model.range.end);
  const unitKey = healthDisplay(state.view, definitions[0].id).unitKey;
  return { ...model, unitKey, breaks: [...new Set(years)].sort((a, b) => a - b).map(year => ({ year, label: "newCounting" as const })) };
}
