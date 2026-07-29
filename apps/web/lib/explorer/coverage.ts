import type { BudgetFactImportRow } from "../data/importBudgetFacts";

// The loaded range is data-driven everywhere it is stated, including in route
// metadata (AGENTS.md, "UX and Visual Guardrails"). Returns null when a side has
// no served facts, so callers can drop the clause rather than print a guess.
export function firstServedYear(
  facts: BudgetFactImportRow[],
  side: "expenditure" | "revenue",
): number | null {
  let earliest: number | null = null;
  for (const fact of facts) {
    if (fact.side !== side) continue;
    if (earliest === null || fact.year < earliest) earliest = fact.year;
  }
  return earliest;
}
