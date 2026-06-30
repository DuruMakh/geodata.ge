import { describe, expect, it } from "vitest";
import { buildExplorerCsv } from "../../lib/explorer/csvExport";
import type { ExplorerTableRow } from "../../lib/explorer/types";

describe("explorer CSV export", () => {
  it("serializes visible rows with source metadata columns", () => {
    const rows: ExplorerTableRow[] = [
      {
        itemId: "spending.health",
        parentItemId: null,
        level: "public_field",
        detailLabel: null,
        officialInstitutionLabelByYear: {},
        kaLabel: "Health KA",
        enLabel: "Health",
        color: "#0071e3",
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
        "year,category_id,parent_item_id,level,detail_label,official_institution_label,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
        "2025,spending.health,,public_field,,,Health KA,Health,150,planned,Reviewed 2025 planned budget scenario,docs/source-2025-plan,2026-05-11",
      ].join("\n"),
    );
  });

  it("serializes admin hierarchy metadata for ministry CSV rows", () => {
    const rows: ExplorerTableRow[] = [
      {
        itemId: "admin_program.education.general",
        parentItemId: "admin_spending.education_science_youth",
        level: "major_program",
        detailLabel: "32 02",
        officialInstitutionLabelByYear: { 2025: "Education ministry" },
        kaLabel: "General education",
        enLabel: "General education",
        color: "#30d5c8",
        basisByYear: { 2025: "actual" },
        sourceByYear: {
          2025: {
            sourceName: "Reviewed official expenditure rows",
            sourceUrlOrFile: "docs/admin-spending.csv",
            lastReviewedAt: "2026-06-11",
          },
        },
        valuesByYear: { 2025: 250 },
        change: null,
        shareEndYear: 0.25,
      },
    ];

    expect(buildExplorerCsv(rows, [2025])).toBe(
      [
        "year,category_id,parent_item_id,level,detail_label,official_institution_label,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
        "2025,admin_program.education.general,admin_spending.education_science_youth,major_program,32 02,Education ministry,General education,General education,250,actual,Reviewed official expenditure rows,docs/admin-spending.csv,2026-06-11",
      ].join("\n"),
    );
  });
});
