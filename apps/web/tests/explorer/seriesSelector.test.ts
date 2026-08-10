import { describe, expect, it } from "vitest";
import { buildSeriesPanelRows } from "../../components/main-explorer/series-panel";
import type { ExplorerItem } from "../../lib/explorer/types";

function item(partial: Partial<ExplorerItem> & Pick<ExplorerItem, "id" | "kaLabel" | "level">): ExplorerItem {
  return {
    side: "expenditure",
    parentItemId: null,
    detailLabel: null,
    enLabel: partial.kaLabel,
    color: "#B3402A",
    sortOrder: 1,
    ...partial,
  };
}

const items: ExplorerItem[] = [
  item({ id: "admin_spending.total", kaLabel: "ხარჯები სულ", level: "total" }),
  item({ id: "admin_spending.education", kaLabel: "Education ministry", level: "admin_category" }),
  item({
    id: "admin_program.general_education",
    kaLabel: "General education",
    level: "major_program",
    parentItemId: "admin_spending.education",
  }),
  item({
    id: "admin_program.school_infrastructure",
    kaLabel: "School infrastructure",
    level: "major_program",
    parentItemId: "admin_spending.education",
  }),
  item({ id: "admin_spending.health", kaLabel: "Health ministry", level: "admin_category" }),
];

describe("series panel rows", () => {
  it("pins the total before categories and collapsed programs", () => {
    const rows = buildSeriesPanelRows(items, "", []);

    expect(rows.map((row) => row.item.id)).toEqual(["admin_spending.total", "admin_spending.education", "admin_spending.health"]);
    expect(rows[0]).toEqual(expect.objectContaining({ isProgram: false, hasChildren: false }));
  });

  it("shows programs for expanded ministries", () => {
    const rows = buildSeriesPanelRows(items, "", ["admin_spending.education"]);

    expect(rows.map((row) => row.item.id)).toEqual([
      "admin_spending.total",
      "admin_spending.education",
      "admin_program.general_education",
      "admin_program.school_infrastructure",
      "admin_spending.health",
    ]);
    expect(rows[2]?.isProgram).toBe(true);
  });

  it("keeps the parent ministry and auto-expands when only a nested program matches", () => {
    const rows = buildSeriesPanelRows(items, "general education", []);

    expect(rows.map((row) => row.item.id)).toEqual(["admin_spending.total", "admin_spending.education", "admin_program.general_education"]);
    expect(rows[1]?.expanded).toBe(true);
  });

  it("keeps manual expansion when both a ministry and one of its programs match", () => {
    const collapsed = buildSeriesPanelRows(items, "education", []);

    expect(collapsed.map((row) => row.item.id)).toEqual(["admin_spending.total", "admin_spending.education"]);
    expect(collapsed[1]).toEqual(expect.objectContaining({ expanded: false, caretLocked: false }));

    const expanded = buildSeriesPanelRows(items, "education", ["admin_spending.education"]);
    expect(expanded.map((row) => row.item.id)).toEqual([
      "admin_spending.total",
      "admin_spending.education",
      "admin_program.general_education",
      "admin_program.school_infrastructure",
    ]);
  });

  it("keeps the total first while search filters categories", () => {
    expect(buildSeriesPanelRows(items, "health", []).map((row) => row.item.id)).toEqual(["admin_spending.total", "admin_spending.health"]);
    expect(buildSeriesPanelRows(items, "does-not-exist", []).map((row) => row.item.id)).toEqual(["admin_spending.total"]);
  });
});
