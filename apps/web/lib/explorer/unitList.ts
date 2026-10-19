import { refitRange } from "./periodRange";
import { parseTopicHash, topicCoverage, type TopicState } from "./topicSeries";

// The "one unit at a time" rule of a list whose rows have different units (Business, Housing, Crime and justice, and
// Education's place pages by heading), and a list row's latest figure: the rules live here once.

/** What a list needs of a fact: its series, year and unit. */
export type UnitFact = { indicatorId: string; year: number; unit: string };
/** What a list row's figure needs of a fact. */
type ValueFact = { indicatorId: string; year: number; value: number };
type ListLatest = { value: number; year: number };

/**
 * A list row's value: its latest year up to the list's last year. A list's groups can end in different years (firm counts
 * stop a year before sales, university graduates a school year before students), so a row still shows its newest figure
 * instead of a blank.
 */
export function listLatest(facts: readonly ValueFact[], id: string, endYear: number): ListLatest | undefined {
  const latest = facts.filter(f => f.indicatorId === id && f.year <= endYear).sort((a, b) => a.year - b.year).at(-1);
  return latest && { value: latest.value, year: latest.year };
}

/**
 * Every listed row's latest value up to `endYear` (`listLatest`), and the year its heading names: the newest of the heading's
 * rows' latest years where that is older than `endYear` (none where a row reaches `endYear` or the heading has no value).
 */
export function listLatestByHeading(facts: readonly ValueFact[], series: readonly { id: string; heading?: string }[], endYear: number): Record<string, { latest: ListLatest | undefined; headingYear: number | undefined }> {
  const latest = new Map(series.map(row => [row.id, listLatest(facts, row.id, endYear)]));
  return Object.fromEntries(series.map(row => {
    const groupYear = Math.max(...series.filter(other => other.heading === row.heading).map(other => latest.get(other.id)?.year ?? 0));
    return [row.id, { latest: latest.get(row.id), headingYear: groupYear && groupYear !== endYear ? groupYear : undefined }];
  }));
}

/**
 * The one-unit functions take an optional last `groupOf`, which replaces "the fact's unit" as the grouping key (a series
 * id to a group, undefined for an unknown series). Omitted, the unit is the group.
 */
type GroupOf = (id: string) => string | undefined;

/** Each series' group: `groupOf` when given, else its unit as its facts give it. */
const groupsOf = (facts: readonly UnitFact[], groupOf?: GroupOf) => {
  if (groupOf) return groupOf;
  const units = new Map<string, string>(facts.map(f => [f.indicatorId, f.unit]));
  return (id: string) => units.get(id);
};

/**
 * Series of different units never share a chart. A tick (or the bulk selection) that adds a series of another unit than
 * the rows already ticked keeps only the rows of the added series' unit; with several added at once, the first one's
 * unit wins, so selecting all from an empty list selects the first unit group's top-level rows in list order.
 * Unticking keeps the rest as it is.
 */
export function keepOneUnit(next: readonly string[], previous: readonly string[], facts: readonly UnitFact[], groupOf?: GroupOf): string[] {
  const unitOf = groupsOf(facts, groupOf);
  const added = next.filter(id => !previous.includes(id));
  return added.length ? next.filter(id => unitOf(id) === unitOf(added[0])) : [...next];
}

/** A list's years: every year any series of the selection's unit has a value, or any of its series when nothing is selected. `missing` words the error for a list with no year. */
export function unitListCoverage(definitions: readonly { id: string }[], selectedIds: readonly string[], facts: readonly UnitFact[], missing: string, groupOf?: GroupOf) {
  const unitOf = groupsOf(facts, groupOf);
  const ids = new Set<string>(definitions.filter(s => !selectedIds.length || unitOf(s.id) === unitOf(selectedIds[0])).map(s => s.id));
  return topicCoverage(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year), missing);
}

const noYears = (definitions: readonly { id: string }[]) => `No years for ${definitions[0]?.id}`;

/** Reads a list's hash: a selection that mixes units keeps only its first row's unit, and the years fit that unit's coverage. `missing` words the error for a list with no year. */
export function parseUnitListHash(hash: string, definitions: readonly { id: string }[], fallback: readonly string[], facts: readonly UnitFact[], missing = noYears(definitions), groupOf?: GroupOf): TopicState {
  const parsed = parseTopicHash(new URLSearchParams(hash.replace(/^#/, "")), definitions, fallback, unitListCoverage(definitions, [], facts, missing, groupOf));
  const selectedIds = keepOneUnit(parsed.selectedIds, [], facts, groupOf);
  return { ...parsed, selectedIds, range: refitRange(parsed.range, unitListCoverage(definitions, selectedIds, facts, missing, groupOf), { collapseToAll: true }) };
}

/** A list's new selection, kept to one unit; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export function changeUnitListSelection(state: TopicState, definitions: readonly { id: string }[], next: readonly string[], facts: readonly UnitFact[], missing = noYears(definitions), groupOf?: GroupOf): TopicState {
  const selectedIds = keepOneUnit(next, state.selectedIds, facts, groupOf);
  return { ...state, selectedIds, range: refitRange(state.range, unitListCoverage(definitions, selectedIds, facts, missing, groupOf), { collapseToAll: false }) };
}
