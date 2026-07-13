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
  item({ id: "admin_spending.health", kaLabel: "Health ministry", level: "admin_category" }),
];

describe("series panel rows", () => {
  it("excludes derived totals and hides collapsed programs", () => {
    const rows = buildSeriesPanelRows(items, "", []);

    expect(rows.map((row) => row.item.id)).toEqual(["admin_spending.education", "admin_spending.health"]);
    expect(rows[0]).toEqual(expect.objectContaining({ hasChildren: true, expanded: false, isProgram: false }));
  });

  it("shows programs for expanded ministries", () => {
    const rows = buildSeriesPanelRows(items, "", ["admin_spending.education"]);

    expect(rows.map((row) => row.item.id)).toEqual([
      "admin_spending.education",
      "admin_program.general_education",
      "admin_spending.health",
    ]);
    expect(rows[1]?.isProgram).toBe(true);
  });

  it("keeps the parent ministry and auto-expands when only a nested program matches", () => {
    const rows = buildSeriesPanelRows(items, "general education", []);

    expect(rows.map((row) => row.item.id)).toEqual(["admin_spending.education", "admin_program.general_education"]);
    expect(rows[0]?.expanded).toBe(true);
  });

  it("returns no rows when nothing matches", () => {
    expect(buildSeriesPanelRows(items, "does-not-exist", [])).toEqual([]);
  });
});
