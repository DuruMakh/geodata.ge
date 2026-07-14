import { describe, expect, it } from "vitest";
import { assertSameServedRows } from "../../lib/data/servedDataParity";

type Row = { id: string; amount: number; label: string | null };

const keyOf = (row: Row) => row.id;

describe("served data row parity", () => {
  it("accepts identical rows regardless of order and key order", () => {
    const csv: Row[] = [
      { id: "a", amount: 1, label: null },
      { id: "b", amount: 2, label: "x" },
    ];
    const db: Row[] = [
      { label: "x", id: "b", amount: 2 } as Row,
      { id: "a", amount: 1, label: null },
    ];

    expect(() => assertSameServedRows("test rows", csv, db, keyOf)).not.toThrow();
  });

  it("rejects a field-level difference and names the row", () => {
    const csv: Row[] = [{ id: "a", amount: 1, label: "x" }];
    const db: Row[] = [{ id: "a", amount: 1, label: "y" }];

    expect(() => assertSameServedRows("test rows", csv, db, keyOf)).toThrow(/row a differs/);
  });

  it("rejects missing and extra rows with the source-of-truth hint", () => {
    const csv: Row[] = [{ id: "a", amount: 1, label: null }];
    const db: Row[] = [{ id: "b", amount: 1, label: null }];

    expect(() => assertSameServedRows("test rows", csv, db, keyOf)).toThrow(
      /exists in csv but not in db[\s\S]*run `npm run data:import`/,
    );
  });

  it("rejects a stale mirror (row count difference)", () => {
    const csv: Row[] = [
      { id: "a", amount: 1, label: null },
      { id: "b", amount: 2, label: null },
    ];
    const db: Row[] = [{ id: "a", amount: 1, label: null }];

    expect(() => assertSameServedRows("test rows", csv, db, keyOf)).toThrow(/row count differs/);
  });

  it("sees differences inside nested values, not just top-level keys", () => {
    type NestedRow = { id: string; sources: { url: string }[] };
    const csv: NestedRow[] = [{ id: "a", sources: [{ url: "one" }] }];
    const db: NestedRow[] = [{ id: "a", sources: [{ url: "two" }] }];

    expect(() => assertSameServedRows("test rows", csv, db, (row) => row.id)).toThrow(
      /row a differs/,
    );
  });
});
