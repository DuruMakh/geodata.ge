import { refitRange } from "./periodRange";
import { parseTopicHash, topicCoverage, type TopicState } from "./topicSeries";

/** What a list's one-group rule needs of a fact: which series it belongs to, its year and its unit. */
export type UnitFact = { indicatorId: string; year: number; unit: string };

/**
 * Every function takes an optional last `groupOf`, which replaces "the fact's unit" as the grouping key (a series id to a
 * group, undefined for an unknown series). Omitted, the unit is the group.
 */
type GroupOf = (id: string) => string | undefined;

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

/** A list's years: every year any series of the selection's unit has a value, or any of its series when nothing is selected. */
export function unitListCoverage(definitions: readonly { id: string }[], selectedIds: readonly string[], facts: readonly UnitFact[], missing: string, groupOf?: GroupOf) {
  const unitOf = groupsOf(facts, groupOf);
  const ids = new Set<string>(definitions.filter(s => !selectedIds.length || unitOf(s.id) === unitOf(selectedIds[0])).map(s => s.id));
  return topicCoverage(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year), missing);
}

/** Reads a list's hash: a selection that mixes units keeps only its first row's unit, and the years fit that unit's coverage. */
export function parseUnitListHash(hash: string, definitions: readonly { id: string }[], fallback: readonly string[], facts: readonly UnitFact[], groupOf?: GroupOf): TopicState {
  const missing = `No years for ${definitions[0]?.id}`;
  const parsed = parseTopicHash(new URLSearchParams(hash.replace(/^#/, "")), definitions, fallback, unitListCoverage(definitions, [], facts, missing, groupOf));
  const selectedIds = keepOneUnit(parsed.selectedIds, [], facts, groupOf);
  return { ...parsed, selectedIds, range: refitRange(parsed.range, unitListCoverage(definitions, selectedIds, facts, missing, groupOf), { collapseToAll: true }) };
}

/** A list's new selection, kept to one unit; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export function changeUnitListSelection(state: TopicState, definitions: readonly { id: string }[], next: readonly string[], facts: readonly UnitFact[], groupOf?: GroupOf): TopicState {
  const selectedIds = keepOneUnit(next, state.selectedIds, facts, groupOf);
  return { ...state, selectedIds, range: refitRange(state.range, unitListCoverage(definitions, selectedIds, facts, `No years for ${definitions[0]?.id}`, groupOf), { collapseToAll: false }) };
}
