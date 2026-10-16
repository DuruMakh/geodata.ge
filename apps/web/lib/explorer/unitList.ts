/** A fact of a list whose series each have one unit. */
export type UnitFact = { indicatorId: string; year: number; unit: string };

/** Each series' unit, as its facts give it. */
export const unitsOf = (facts: readonly UnitFact[]) => {
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
