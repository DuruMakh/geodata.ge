import { describe, expect, it } from "vitest";
import { buildExplorerCsv } from "../../lib/explorer/csvExport";
import type { ExplorerTableRow } from "../../lib/explorer/types";

describe("explorer CSV export", () => {
  it("serializes visible rows with source metadata columns", () => {
    const rows: ExplorerTableRow[] = [
      {
        itemId: "spending.health",
        kaLabel: "ჯანმრთელობა",
        enLabel: "Health",
        basisByYear: { 2026: "planned" },
        sourceByYear: {
          2026: {
            sourceName: "Reviewed 2026 planned budget",
            sourceUrlOrFile: "docs/source-2026",
            lastReviewedAt: "2026-05-11",
          },
        },
        valuesByYear: { 2026: 150 },
        change: null,
        shareEndYear: 0.3333,
      },
    ];

    expect(buildExplorerCsv(rows, [2026])).toBe(
      [
        "year,category_id,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
        "2026,spending.health,ჯანმრთელობა,Health,150,planned,Reviewed 2026 planned budget,docs/source-2026,2026-05-11",
      ].join("\n"),
    );
  });
});
