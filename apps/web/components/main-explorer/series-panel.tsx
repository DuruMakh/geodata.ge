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
            <div className="flex gap-[18px] border-b border-[var(--row-border)] pb-3">
              <TextTab label={message(messages, "controls.fields")} active={grouping === "fields"} onClick={() => onGroupingChange("fields")} testId="grouping-fields" />
              <TextTab label={message(messages, "controls.ministries")} active={grouping === "ministries"} onClick={() => onGroupingChange("ministries")} testId="grouping-ministries" />
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
