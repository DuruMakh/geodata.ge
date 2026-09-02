"use client";

import { useState, type ReactNode } from "react";
import type { GovernmentDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { formatAmount, formatShare, MISSING } from "../../lib/explorer/format";
import type { DebtFamily, DebtSeriesId, ServedGovernmentDebtFact } from "../../lib/servedRows";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

type DebtSeriesPanelProps = {
  items: GovernmentDebtExplorerModel["items"];
  facts: ServedGovernmentDebtFact[];
  activeFamily: DebtFamily;
  selectedIds: DebtSeriesId[];
  expandedParentIds: DebtSeriesId[];
  onSelectionChange: (ids: DebtSeriesId[]) => void;
  onToggle: (id: DebtSeriesId) => void;
  downloadAction: ReactNode;
};

function matches(item: GovernmentDebtExplorerModel["items"][number], query: string): boolean {
  return `${item.kaLabel} ${item.enLabel} ${item.id}`.toLowerCase().includes(query);
}

function formatLatest(fact: ServedGovernmentDebtFact | undefined): string {
  if (!fact || fact.value === null) return MISSING;
  return fact.family === "rate" ? formatShare(fact.value / 100) : formatAmount(fact.value);
}

export function DebtSeriesPanel({
  items,
  facts,
  activeFamily,
  selectedIds,
  expandedParentIds,
  onSelectionChange,
  onToggle,
  downloadAction,
}: DebtSeriesPanelProps) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<DebtSeriesId[]>(expandedParentIds);
  const normalizedQuery = query.trim().toLowerCase();
  const activeIds = items.filter((item) => item.family === activeFamily).map((item) => item.id);
  const latestBySeries = new Map<DebtSeriesId, ServedGovernmentDebtFact>();

  for (const fact of facts) {
    const current = latestBySeries.get(fact.seriesId);
    if (!current || fact.year > current.year) latestBySeries.set(fact.seriesId, fact);
  }

  const visibleRows: Array<{
    item: GovernmentDebtExplorerModel["items"][number];
    isChild: boolean;
    hasChildren: boolean;
    expanded: boolean;
    expansionLocked: boolean;
  }> = [];

  for (const parent of items.filter((item) => item.parentItemId === null)) {
    const children = items.filter((item) => item.parentItemId === parent.id);
    const parentMatches = normalizedQuery === "" || matches(parent, normalizedQuery);
    const matchedChildren = normalizedQuery === ""
      ? children
      : children.filter((child) => matches(child, normalizedQuery));
    if (!parentMatches && matchedChildren.length === 0) continue;

    const forcedOpen = normalizedQuery !== "" && !parentMatches && matchedChildren.length > 0;
    const expanded = forcedOpen || expandedIds.includes(parent.id);
    visibleRows.push({ item: parent, isChild: false, hasChildren: children.length > 0, expanded, expansionLocked: forcedOpen });
    if (expanded) {
      for (const child of forcedOpen ? matchedChildren : children) {
        visibleRows.push({ item: child, isChild: true, hasChildren: false, expanded: false, expansionLocked: false });
      }
    }
  }

  const hasSelection = selectedIds.length > 0;
  const allSelected = activeIds.every((id) => selectedIds.includes(id));

  return (
    <aside
      aria-label="სერიები"
      className="min-w-0 max-w-full border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:sticky @min-[1100px]:top-5 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]"
    >
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="ძებნა"
        selectedCount={selectedIds.length}
        totalCount={activeIds.length}
        hasSelection={hasSelection}
        allSelected={allSelected}
        onToggleAll={() => onSelectionChange(hasSelection ? [] : activeIds)}
        hasVisibleMatches={normalizedQuery === "" || visibleRows.length > 0}
      >
        {visibleRows.map(({ item, isChild, hasChildren, expanded, expansionLocked }) => (
          <SeriesSelectorRow
            key={item.id}
            id={item.id}
            label={item.kaLabel}
            color={item.color}
            value={formatLatest(latestBySeries.get(item.id))}
            selected={selectedIds.includes(item.id)}
            level={isChild ? "debt_child" : "debt_parent"}
            parentId={item.parentItemId}
            showCaretColumn
            hasChildren={hasChildren}
            expanded={expanded}
            expansionLocked={expansionLocked}
            showRail={isChild || expanded}
            isChild={isChild}
            onToggle={() => onToggle(item.id)}
            onToggleExpanded={() => {
              setExpandedIds((current) => current.includes(item.id)
                ? current.filter((id) => id !== item.id)
                : [...current, item.id]);
            }}
          />
        ))}
      </SeriesSelector>
      {downloadAction}
    </aside>
  );
}
