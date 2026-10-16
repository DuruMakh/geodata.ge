import { refitRange } from "./periodRange";
import { parseTopicHash, topicCoverage, type TopicState } from "./topicSeries";

// The "one unit at a time" rule of a list whose rows have different units (Business and Housing): the rules live here once.

/** What a list needs of a fact: its series, year and unit. */
export type UnitFact = { indicatorId: string; year: number; unit: string };

/** Each series' unit, as its facts give it. */
const unitsOf = (facts: readonly UnitFact[]) => {
  const units = new Map<string, string>(facts.map(f => [f.indicatorId, f.unit]));
  return (id: string) => units.get(id);
};

/**
 * Series of different units never share a chart. A tick (or the bulk selection) that adds a series of another unit than
 * the rows already ticked keeps only the rows of the added series' unit; with several added at once, the first one's
 * unit wins, so selecting all from an empty list selects the first unit group's top-level rows in list order.
 * Unticking keeps the rest as it is.
 */
export function keepOneUnit(next: readonly string[], previous: readonly string[], facts: readonly UnitFact[]): string[] {
  const unitOf = unitsOf(facts);
  const added = next.filter(id => !previous.includes(id));
  return added.length ? next.filter(id => unitOf(id) === unitOf(added[0])) : [...next];
}

/** A list's years: every year any series of the selection's unit has a value, or any of its series when nothing is selected. `missing` words the error for a list with no year. */
export function unitListCoverage(definitions: readonly { id: string }[], selectedIds: readonly string[], facts: readonly UnitFact[], missing: string) {
  const unitOf = unitsOf(facts);
  const ids = new Set<string>(definitions.filter(s => !selectedIds.length || unitOf(s.id) === unitOf(selectedIds[0])).map(s => s.id));
  return topicCoverage(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year), missing);
}

const noYears = (definitions: readonly { id: string }[]) => `No years for ${definitions[0]?.id}`;

/** Reads a list's hash: a selection that mixes units keeps only its first row's unit, and the years fit that unit's coverage. `missing` words the error for a list with no year. */
export function parseUnitListHash(hash: string, definitions: readonly { id: string }[], fallback: readonly string[], facts: readonly UnitFact[], missing = noYears(definitions)): TopicState {
  const parsed = parseTopicHash(new URLSearchParams(hash.replace(/^#/, "")), definitions, fallback, unitListCoverage(definitions, [], facts, missing));
  const selectedIds = keepOneUnit(parsed.selectedIds, [], facts);
  return { ...parsed, selectedIds, range: refitRange(parsed.range, unitListCoverage(definitions, selectedIds, facts, missing), { collapseToAll: true }) };
}

/** A list's new selection, kept to one unit; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export function changeUnitListSelection(state: TopicState, definitions: readonly { id: string }[], next: readonly string[], facts: readonly UnitFact[], missing = noYears(definitions)): TopicState {
  const selectedIds = keepOneUnit(next, state.selectedIds, facts);
  return { ...state, selectedIds, range: refitRange(state.range, unitListCoverage(definitions, selectedIds, facts, missing), { collapseToAll: false }) };
}
