import type { BudgetFactImportRow } from "./importBudgetFacts";

function keyFor(row: BudgetFactImportRow): string {
  return `${row.year}:${row.side}:${row.itemId}`;
}

export function chooseActivePublicFacts(rows: BudgetFactImportRow[]): BudgetFactImportRow[] {
  const byKey = new Map<string, BudgetFactImportRow>();

  for (const row of rows) {
    const key = keyFor(row);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    if (existing.basis === "planned" && row.basis === "actual") {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.itemId.localeCompare(b.itemId);
  });
}
