import { createElement } from "react";
import { renderGeorgianMarkup } from "../helpers/render-localized";
import { describe, expect, it } from "vitest";
import { buildSeriesPanelRows, SeriesPanel, topLevelIds } from "../../components/main-explorer/series-panel";
import { SeriesSelector, SeriesSelectorRow } from "../../components/main-explorer/series-selector";
import type { ExplorerItem } from "../../lib/explorer/types";

function item(partial: Partial<ExplorerItem> & Pick<ExplorerItem, "id" | "kaLabel" | "level">): ExplorerItem {
  return {
    side: "expenditure",
    parentItemId: null,
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

// The bulk control and primary denominator share one domain: the rows the panel
// lists before any caret is opened. A separate program count keeps selected
// children visible without making ყველას მონიშვნა chart collapsed programs.
describe("bulk selection domain", () => {
  it("counts the total and its categories, never the collapsed programs", () => {
    expect(topLevelIds(items)).toEqual(["admin_spending.total", "admin_spending.education", "admin_spending.health"]);
  });

  it("stays the same when a ministry is expanded", () => {
    const expanded = buildSeriesPanelRows(items, "", ["admin_spending.education"]);

    expect(expanded).toHaveLength(5);
    expect(topLevelIds(items)).toHaveLength(3);
  });

  it("reports selected top-level rows and programs as separate counts", () => {
    const markup = renderGeorgianMarkup(
      createElement(SeriesPanel, {
        items,
        rows: [],
        scope: "ministries",
        showGrouping: true,
        grouping: "ministries",
        selectedIds: ["admin_spending.total", "admin_program.general_education"],
        endYear: 2025,
        expandedIds: ["admin_spending.education"],
        onGroupingChange: () => {},
        onSelectionChange: () => {},
        onToggle: () => {},
        onToggleExpanded: () => {},
        downloadAction: createElement("div"),
      }),
    );
    const visibleText = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    expect(visibleText).toContain("ძირითადი 1 / 3 · პროგრამები 1");
  });
});

// buildSeriesPanelRows pins the total regardless of the query (asserted above),
// so the empty state cannot claim there is nothing to see — it has to name the
// thing that actually missed.
describe("empty state", () => {
  function emptyStateMarkup(): string {
    // SeriesSelector requires children, so they belong in the props value —
    // tests are collected as .ts only, so JSX is not available here.
    const props = {
      query: "zzzqqq",
      onQueryChange: () => {},
      searchPlaceholder: "ძებნა",
      selectedCount: 1,
      totalCount: 15,
      hasSelection: true,
      allSelected: false,
      onToggleAll: () => {},
      hasVisibleMatches: false,
      children: createElement("div", null, "მთლიანი ხარჯი"),
    };

    return renderGeorgianMarkup(createElement(SeriesSelector, props));
  }

  it("does not claim zero results while the pinned total is still listed", () => {
    const markup = emptyStateMarkup();

    expect(markup).toContain("მთლიანი ხარჯი");
    expect(markup).not.toContain("0 შედეგი");
  });

  it("says the query matched no categories", () => {
    expect(emptyStateMarkup()).toContain("კატეგორია");
  });
});

describe("optional debt selector semantics", () => {
  it("can suppress select-all while keeping the empty count visible", () => {
    const props = {
      query: "",
      onQueryChange: () => {},
      searchPlaceholder: "ძებნა",
      selectedCount: 0,
      totalCount: 9,
      hasSelection: false,
      allSelected: false,
      onToggleAll: () => {},
      allowSelectAll: false,
      hasVisibleMatches: true,
      children: createElement("div"),
    };
    const markup = renderGeorgianMarkup(createElement(SeriesSelector, props));

    expect(markup).toContain("0 / 9");
    expect(markup).not.toContain("ყველას მონიშვნა");
    expect(markup).not.toContain('data-testid="series-toggle-all"');
  });

  it("accepts a debt-specific caret name", () => {
    const base = {
      id: "parent",
      label: "ვალი",
      color: "#1E1B16",
      value: "1.0 მლრდ ₾",
      selected: false,
      showCaretColumn: true,
      hasChildren: true,
      expanded: true,
      onToggle: () => {},
      onToggleExpanded: () => {},
    };
    const debt = renderGeorgianMarkup(createElement(SeriesSelectorRow, {
      ...base,
      expansionLabel: "ვალი — ქვესერიების ჩაკეცვა",
    }));

    expect(debt).toContain('aria-label="ვალი — ქვესერიების ჩაკეცვა"');
  });
});

describe("series lists for screen readers and fingers", () => {
  const caret = (markup: string) => markup.match(/<button[^>]*aria-expanded[^>]*>/)?.[0] ?? "";

  it("a caret is at least 24px wide and named after its row", () => {
    const row = renderGeorgianMarkup(createElement(SeriesSelectorRow, {
      id: "parent",
      label: "ვალი",
      color: "#1E1B16",
      value: "1.0 მლრდ ₾",
      selected: false,
      showCaretColumn: true,
      hasChildren: true,
      onToggle: () => {},
    }));

    expect(caret(row)).toContain('aria-label="ვალი — ქვესერიები"');
    expect(caret(row)).toMatch(/class="[^"]*\bw-6\b/);
    expect(caret(row)).not.toContain("w-[22px]");
    // The invisible hit area no longer reaches past the box sideways; it still runs 12px below the row.
    expect(caret(row)).not.toContain("before:-right-1");
    expect(caret(row)).toContain("before:-bottom-3");

    // The ministries list passes no name of its own: each caret is named after its ministry.
    const ministries = renderGeorgianMarkup(createElement(SeriesPanel, {
      items,
      rows: [],
      scope: "ministries",
      showGrouping: false,
      grouping: "ministries",
      selectedIds: [],
      endYear: 2025,
      expandedIds: [],
      onGroupingChange: () => {},
      onSelectionChange: () => {},
      onToggle: () => {},
      onToggleExpanded: () => {},
      downloadAction: createElement("div"),
    }));
    expect(ministries).toContain('aria-label="Education ministry — ქვესერიები"');
    expect(ministries).toContain('aria-label="Health ministry — ქვესერიები"');
  });

  it("the select-all checkbox keeps one name and reports state through aria-checked", () => {
    const bulk = (hasSelection: boolean, allSelected: boolean) => {
      const props = {
        query: "",
        onQueryChange: () => {},
        searchPlaceholder: "ძებნა",
        selectedCount: 1,
        totalCount: 3,
        hasSelection,
        allSelected,
        onToggleAll: () => {},
        hasVisibleMatches: true,
        children: createElement("div"),
      };
      const markup = renderGeorgianMarkup(createElement(SeriesSelector, props));
      return markup.match(/<button[^>]*data-testid="series-toggle-all"[^>]*>[^]*?<\/button>/)?.[0] ?? "";
    };

    for (const [hasSelection, allSelected, state, visible] of [
      [false, false, "false", "ყველას მონიშვნა"],
      [true, false, "mixed", "გასუფთავება"],
      [true, true, "true", "გასუფთავება"],
    ] as const) {
      const control = bulk(hasSelection, allSelected);
      expect(control).toContain('role="checkbox"');
      expect(control).toContain('aria-label="ყველა სერიის მონიშვნა"');
      expect(control).toContain(`aria-checked="${state}"`);
      // The visible action word stays (AGENTS.md UI contract); only the announced name is fixed.
      expect(control).toContain(visible);
    }
  });
});

describe("series selector reference rows", () => {
  const render = (swatch?: "solid" | "dashed") =>
    renderGeorgianMarkup(createElement(SeriesSelectorRow, { id: "target", label: "მიზნობრივი მაჩვენებელი", color: "#B3402A", value: "3.0%", selected: true, swatch, onToggle: () => {} }));

  it("draws a dashed swatch for a reference row", () => {
    expect(render("dashed")).toMatch(/data-testid="series-swatch"[^]*stroke-dasharray="4 2"/);
  });

  it("keeps the solid swatch by default", () => {
    expect(render()).not.toContain("stroke-dasharray");
  });
});
