type ActivePublicFact = {
  year: number;
  side: "revenue" | "expenditure";
  itemId: string;
  basis: "actual" | "planned";
};

function keyFor(row: ActivePublicFact): string {
  return `${row.year}:${row.side}:${row.itemId}`;
}

// Generic so the caller's element type survives the round trip: this reads only
// year/side/itemId/basis, so it accepts the narrow served row and the wider
// ingestion row alike and returns whichever it was given.
export function chooseActivePublicFacts<T extends ActivePublicFact>(rows: T[]): T[] {
  const byKey = new Map<string, T>();

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
