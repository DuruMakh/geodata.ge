"use client";

import { useState } from "react";
import type { ExplorerItem, ExplorerScope, ExplorerTableRow } from "../../lib/explorer/types";
import { formatAmount } from "../../lib/explorer/format";
import type { ExpenditureGrouping } from "../../lib/explorer/types";
import { TextTab } from "../ui/editorial";
import { SeriesSelector, SeriesSelectorRow } from "./series-selector";

// Series aside per DESIGN.md §7.6–7.8: flat editorial rows with a checkbox square,
// persistent swatch bar, and (for ministries) caret-expandable major programs.

export type SeriesPanelRow = {
  item: ExplorerItem;
  isProgram: boolean;
  hasChildren: boolean;
  expanded: boolean;
  /** True while a search forces this row open (its programs matched) — the caret is inert then. */
  caretLocked: boolean;
};

function matches(item: ExplorerItem, query: string): boolean {
  return `${item.kaLabel} ${item.enLabel} ${item.id}`.toLowerCase().includes(query);
}

export function buildSeriesPanelRows(items: ExplorerItem[], query: string, expandedIds: string[]): SeriesPanelRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  const total = items.find((item) => item.level === "total");
  const selectable = items.filter((item) => item.level !== "total");
  const categories = selectable.filter((item) => item.level !== "major_program");
  const programsByParent = new Map<string, ExplorerItem[]>();

  for (const item of selectable) {
    if (item.level !== "major_program") continue;
    const parentId = item.parentItemId ?? "";
    programsByParent.set(parentId, [...(programsByParent.get(parentId) ?? []), item]);
  }

  const rows: SeriesPanelRow[] = total
    ? [{ item: total, isProgram: false, hasChildren: false, expanded: false, caretLocked: false }]
    : [];

  for (const category of categories) {
    const programs = programsByParent.get(category.id) ?? [];
    const categoryMatches = !normalizedQuery || matches(category, normalizedQuery);
    const matchedPrograms = normalizedQuery ? programs.filter((program) => matches(program, normalizedQuery)) : programs;

    if (!categoryMatches && matchedPrograms.length === 0) continue;

    // While searching, ministries with matching programs auto-expand to the matches
    // (caret locked open); a name-matched ministry still honors the manual caret,
    // showing all its programs — the caret is never a silent no-op.
    const forcedOpen = Boolean(normalizedQuery) && !categoryMatches && matchedPrograms.length > 0;
    const expanded = forcedOpen || expandedIds.includes(category.id);

    rows.push({ item: category, isProgram: false, hasChildren: programs.length > 0, expanded, caretLocked: forcedOpen });

    if (expanded) {
      for (const program of forcedOpen ? matchedPrograms : programs) {
        rows.push({ item: program, isProgram: true, hasChildren: false, expanded: false, caretLocked: false });
      }
    }
  }

  return rows;
}

type SeriesPanelProps = {
  items: ExplorerItem[];
  rows: ExplorerTableRow[];
  scope: ExplorerScope;
  showGrouping: boolean;
  grouping: ExpenditureGrouping;
  selectedIds: string[];
  endYear: number;
  expandedIds: string[];
  onGroupingChange: (grouping: ExpenditureGrouping) => void;
  onSelectionChange: (itemIds: string[]) => void;
  onToggle: (itemId: string) => void;
  onToggleExpanded: (itemId: string) => void;
  onDownloadCsv: () => void;
};

export function SeriesPanel({
  items,
  rows,
  scope,
  showGrouping,
  grouping,
  selectedIds,
  endYear,
  expandedIds,
  onGroupingChange,
  onSelectionChange,
  onToggle,
  onToggleExpanded,
  onDownloadCsv,
}: SeriesPanelProps) {
  // The query is panel-local so keystrokes re-render only this aside — the parent
  // keys this component by scope, which also resets the search on nav/grouping
  // switches consistently.
  const [query, setQuery] = useState("");
  const valuesByItem = new Map(rows.map((row) => [row.itemId, row]));
  const panelRows = buildSeriesPanelRows(items, query, expandedIds);
  const selectableIds = items.map((item) => item.id);
  const hasSelection = selectedIds.length > 0;
  const isMinistries = scope === "ministries";
  const normalizedQuery = query.trim().toLowerCase();
  const hasVisibleMatches =
    normalizedQuery === "" ||
    Boolean(items.find((item) => item.level === "total" && matches(item, normalizedQuery))) ||
    panelRows.some((row) => row.item.level !== "total");
  const allSelected = selectableIds.every((itemId) => selectedIds.includes(itemId));

  return (
    <aside
      aria-label="სერიები"
      className="min-w-0 max-w-full border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:sticky @min-[1100px]:top-5 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]"
    >
      <SeriesSelector
        controls={
          showGrouping ? (
            <div className="flex gap-[18px] border-b border-[var(--row-border)] pb-3">
              <TextTab label="სფეროები" active={grouping === "fields"} onClick={() => onGroupingChange("fields")} testId="grouping-fields" />
              <TextTab label="სამინისტროები" active={grouping === "ministries"} onClick={() => onGroupingChange("ministries")} testId="grouping-ministries" />
            </div>
          ) : undefined
        }
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="ძებნა"
        selectedCount={selectedIds.length}
        totalCount={selectableIds.length}
        hasSelection={hasSelection}
        allSelected={allSelected}
        onToggleAll={() => onSelectionChange(hasSelection ? [] : selectableIds)}
        hasVisibleMatches={hasVisibleMatches}
      >
        {panelRows.map(({ item, isProgram, hasChildren, expanded, caretLocked }) => {
          const selected = selectedIds.includes(item.id);
          const latest = valuesByItem.get(item.id)?.valuesByYear[endYear] ?? null;

          return (
            <SeriesSelectorRow
              key={item.id}
              id={item.id}
              label={item.kaLabel}
              color={item.color}
              value={formatAmount(latest)}
              selected={selected}
              level={item.level}
              parentId={item.parentItemId}
              showCaretColumn={isMinistries}
              hasChildren={hasChildren}
              expanded={expanded}
              expansionLocked={caretLocked}
              showRail={isProgram || (hasChildren && expanded)}
              isChild={isProgram}
              onToggle={() => onToggle(item.id)}
              onToggleExpanded={() => onToggleExpanded(item.id)}
            />
          );
        })}
      </SeriesSelector>

      <button
        type="button"
        onClick={onDownloadCsv}
        className="mt-[18px] h-[38px] w-full cursor-pointer rounded-[2px] bg-[var(--ink)] text-[12.5px] font-semibold text-[var(--paper)] transition-opacity duration-150 hover:opacity-85"
      >
        CSV ჩამოტვირთვა
      </button>
    </aside>
  );
}
