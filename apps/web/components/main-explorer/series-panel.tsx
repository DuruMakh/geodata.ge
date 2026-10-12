"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { useState, type ReactNode } from "react";
import type { ExplorerItem, ExplorerScope, ExplorerTableRow } from "../../lib/explorer/types";
import { formatAmount } from "../../lib/explorer/format";
import type { ExpenditureGrouping } from "../../lib/explorer/types";
import { TextTab } from "../ui/editorial";
import { SeriesSelector, SeriesSelectorRow } from "./series-selector";
import { SeriesAside } from "../explorer-shell/series-aside";

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
  return matchesLabelQuery(query, [item.kaLabel, item.enLabel, item.id]);
}

/** A parent/child series list row: `locked` is true while a search forces the parent open. */
export type TreeRow<T> = { item: T; isChild: boolean; hasChildren: boolean; expanded: boolean; locked: boolean };

/**
 * Parents with their children under them. While searching, a parent is listed when it or a
 * child matches; a parent listed only for its matching children opens to just those children
 * with its caret locked open. A name-matched parent still honours its own caret, showing all
 * its children, so the caret is never a silent no-op.
 */
export function buildTreeRows<T>(parents: readonly T[], childrenOf: (parent: T) => T[], matches: (item: T, query: string) => boolean, idOf: (item: T) => string, query: string, expandedIds: readonly string[]): TreeRow<T>[] {
  const searching = query.trim() !== "";
  const rows: TreeRow<T>[] = [];
  for (const parent of parents) {
    const children = childrenOf(parent);
    const parentMatches = !searching || matches(parent, query);
    const matchedChildren = searching ? children.filter((child) => matches(child, query)) : children;
    if (!parentMatches && matchedChildren.length === 0) continue;
    const forcedOpen = searching && !parentMatches && matchedChildren.length > 0;
    const expanded = forcedOpen || expandedIds.includes(idOf(parent));
    rows.push({ item: parent, isChild: false, hasChildren: children.length > 0, expanded, locked: forcedOpen });
    if (expanded) {
      for (const child of forcedOpen ? matchedChildren : children) {
        rows.push({ item: child, isChild: true, hasChildren: false, expanded: false, locked: false });
      }
    }
  }
  return rows;
}

export function buildSeriesPanelRows(items: ExplorerItem[], query: string, expandedIds: string[]): SeriesPanelRow[] {
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
  // Ministries with matching programs auto-expand to the matches (caret locked open).
  for (const row of buildTreeRows(categories, (category) => programsByParent.get(category.id) ?? [], matches, (item) => item.id, query.trim().toLowerCase(), expandedIds)) {
    rows.push({ item: row.item, isProgram: row.isChild, hasChildren: row.hasChildren, expanded: row.expanded, caretLocked: row.locked });
  }
  return rows;
}

/**
 * The rows the panel lists before any caret is opened. The bulk control and the
 * counter both run over this set: on ministries `items` carries 63 entries but
 * only the total and its 14 categories are ever listed, so a denominator over
 * every level makes "სერიები 1 / 63" reconcile with nothing on screen — and one
 * click on ყველას მონიშვნა charts 48 programs the reader never saw.
 */
export function topLevelIds(items: ExplorerItem[]): string[] {
  return items.filter((item) => item.level !== "major_program").map((item) => item.id);
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
  downloadAction: ReactNode;
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
  downloadAction,
}: SeriesPanelProps) {
  const { locale, messages, englishLabels } = useI18n();
  // The query is panel-local so keystrokes re-render only this aside — the parent
  // keys this component by scope, which also resets the search on nav/grouping
  // switches consistently.
  const [query, setQuery] = useState("");
  const valuesByItem = new Map(rows.map((row) => [row.itemId, row]));
  const panelRows = buildSeriesPanelRows(items, query, expandedIds);
  const bulkIds = topLevelIds(items);
  const programIds = new Set(items.filter((item) => item.level === "major_program").map((item) => item.id));
  const selectedTopLevelCount = selectedIds.filter((itemId) => bulkIds.includes(itemId)).length;
  const selectedProgramCount = selectedIds.filter((itemId) => programIds.has(itemId)).length;
  // Unscoped on purpose: გასუფთავება has to be able to clear a program the user
  // opened a caret to select, even though the counter no longer counts it.
  const hasSelection = selectedIds.length > 0;
  const isMinistries = scope === "ministries";
  const normalizedQuery = query.trim().toLowerCase();
  const hasVisibleMatches =
    normalizedQuery === "" ||
    Boolean(items.find((item) => item.level === "total" && matches(item, normalizedQuery))) ||
    panelRows.some((row) => row.item.level !== "total");
  const allSelected = bulkIds.every((itemId) => selectedIds.includes(itemId));

  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <SeriesSelector
        controls={
          showGrouping ? (
            // Two-column layout only: stacked, the chart panel carries these tabs (ExplorerView).
            <div className="flex gap-[18px] border-b border-[var(--row-border)] pb-3 @max-[1100px]:hidden">
              <TextTab label={message(messages, "controls.fields")} active={grouping === "fields"} onClick={() => onGroupingChange("fields")} testId="aside-grouping-fields" />
              <TextTab label={message(messages, "controls.ministries")} active={grouping === "ministries"} onClick={() => onGroupingChange("ministries")} testId="aside-grouping-ministries" />
            </div>
          ) : undefined
        }
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        countLabel={message(messages, isMinistries ? "controls.primary" : "controls.series")}
        selectedCount={selectedTopLevelCount}
        totalCount={bulkIds.length}
        supplementalSelected={isMinistries ? { label: message(messages, "controls.programmes"), count: selectedProgramCount } : undefined}
        hasSelection={hasSelection}
        allSelected={allSelected}
        onToggleAll={() => onSelectionChange(hasSelection ? [] : bulkIds)}
        hasVisibleMatches={hasVisibleMatches}
      >
        {panelRows.map(({ item, isProgram, hasChildren, expanded, caretLocked }) => {
          const selected = selectedIds.includes(item.id);
          const latest = valuesByItem.get(item.id)?.valuesByYear[endYear] ?? null;

          return (
            <SeriesSelectorRow
              key={item.id}
              id={item.id}
              label={publicLabel(locale, item.id, item.kaLabel, englishLabels)}
              color={item.color}
              value={formatAmount(latest, locale)}
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

      {downloadAction}
    </SeriesAside>
  );
}
