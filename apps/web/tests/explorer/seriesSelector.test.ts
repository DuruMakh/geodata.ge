import { describe, expect, it } from "vitest";
import { filterSeriesItems } from "../../components/main-explorer/series-selector";
import type { ExplorerItem } from "../../lib/explorer/types";

const items: ExplorerItem[] = [
  {
    id: "admin_spending.education",
    side: "expenditure",
    parentItemId: null,
    level: "admin_category",
    detailLabel: null,
    kaLabel: "Education ministry",
    enLabel: "Education ministry",
    color: "#0071e3",
    sortOrder: 1,
  },
  {
    id: "admin_program.general_education",
    side: "expenditure",
    parentItemId: "admin_spending.education",
    level: "major_program",
    detailLabel: "32 02",
    kaLabel: "General education",
    enLabel: "General education",
    color: "#ffd60a",
    sortOrder: 2,
  },
  {
    id: "admin_spending.health",
    side: "expenditure",
    parentItemId: null,
    level: "admin_category",
    detailLabel: null,
    kaLabel: "Health ministry",
    enLabel: "Health ministry",
    color: "#30d5c8",
    sortOrder: 3,
  },
];

describe("series selector search", () => {
  it("keeps the parent ministry when only a nested program matches", () => {
    expect(filterSeriesItems(items, "32 02").map((item) => item.id)).toEqual([
      "admin_spending.education",
      "admin_program.general_education",
    ]);
  });

  it("returns all items for an empty search", () => {
    expect(filterSeriesItems(items, "")).toEqual(items);
  });
});
