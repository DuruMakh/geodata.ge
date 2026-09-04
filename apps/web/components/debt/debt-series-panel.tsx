"use client";

import { useState, type ReactNode } from "react";
import type { GovernmentDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { formatAmount, formatShare, MISSING } from "../../lib/explorer/format";
import type { DebtSeriesId, ServedGovernmentDebtFact } from "../../lib/servedRows";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

type DebtSeriesPanelProps = {
  items: GovernmentDebtExplorerModel["items"];
  facts: ServedGovernmentDebtFact[];
  selectedIds: DebtSeriesId[];
  expandedParentIds: DebtSeriesId[];
  onSelectionChange: (ids: DebtSeriesId[]) => void;
  onToggle: (id: DebtSeriesId) => void;
  downloadAction: ReactNode;
};

function matches(item: GovernmentDebtExplorerModel["items"][number], query: string): boolean {
  return `${item.kaLabel} ${item.enLabel} ${item.id}`.toLowerCase().includes(query);
}

function formatSummary(fact: ServedGovernmentDebtFact | undefined, latestYear: number | undefined): string {
  if (!fact || fact.value === null) return MISSING;
  const value = fact.family === "rate" ? formatShare(fact.value / 100) : formatAmount(fact.value);
  return fact.family === "rate" && fact.year !== latestYear ? `${value} · ${fact.year}` : value;
}

export function DebtSeriesPanel({
  items,
  facts,
  selectedIds,
  expandedParentIds,
  onSelectionChange,
  onToggle,
  downloadAction,
}: DebtSeriesPanelProps) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<DebtSeriesId[]>(expandedParentIds);
  const normalizedQuery = query.trim().toLowerCase();
  const latestYearBySeries = new Map<DebtSeriesId, number>();
  const summaryBySeries = new Map<DebtSeriesId, ServedGovernmentDebtFact>();

  for (const fact of facts) {
    latestYearBySeries.set(fact.seriesId, Math.max(latestYearBySeries.get(fact.seriesId) ?? fact.year, fact.year));
    if (fact.value === null || fact.status !== "actual") continue;
    const current = summaryBySeries.get(fact.seriesId);
    if (!current || fact.year > current.year) summaryBySeries.set(fact.seriesId, fact);
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
        totalCount={items.length}
        hasSelection={hasSelection}
        allSelected={false}
        onToggleAll={() => onSelectionChange([])}
        allowSelectAll={false}
        hasVisibleMatches={normalizedQuery === "" || visibleRows.length > 0}
      >
        {visibleRows.map(({ item, isChild, hasChildren, expanded, expansionLocked }) => (
          <SeriesSelectorRow
            key={item.id}
            id={item.id}
            label={item.kaLabel}
            color={item.color}
            value={formatSummary(summaryBySeries.get(item.id), latestYearBySeries.get(item.id))}
            selected={selectedIds.includes(item.id)}
            level={isChild ? "debt_child" : "debt_parent"}
            parentId={item.parentItemId}
            showCaretColumn
            hasChildren={hasChildren}
            expanded={expanded}
            expansionLocked={expansionLocked}
            expansionLabel={`${item.kaLabel} — ქვესერიების ${expanded ? "ჩაკეცვა" : "გაშლა"}`}
            showRail={isChild || expanded}
            isChild={isChild}
            childLabelSize="standard"
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
