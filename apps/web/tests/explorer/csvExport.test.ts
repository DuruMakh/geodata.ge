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
        basisByYear: { 2025: "planned" },
        sourceByYear: {
          2025: {
            sourceName: "Reviewed 2025 planned budget scenario",
            sourceUrlOrFile: "docs/source-2025-plan",
            lastReviewedAt: "2026-05-11",
          },
        },
        valuesByYear: { 2025: 150 },
        change: null,
        shareEndYear: 0.3333,
      },
    ];

    expect(buildExplorerCsv(rows, [2025])).toBe(
      [
        "year,category_id,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
        "2025,spending.health,ჯანმრთელობა,Health,150,planned,Reviewed 2025 planned budget scenario,docs/source-2025-plan,2026-05-11",
      ].join("\n"),
    );
  });
});
