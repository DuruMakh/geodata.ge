"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { Locale } from "../../lib/i18n/types";
import { useState, type ReactNode } from "react";
import type { GovernmentDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { formatAmount, formatShare, MISSING } from "../../lib/explorer/format";
import type { DebtFamily, DebtSeriesId, ClientGovernmentDebtFact } from "../../lib/servedRows";
import { SEARCHABLE_MIN_ROWS, SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { SeriesAside } from "../explorer-shell/series-aside";

type DebtSeriesPanelProps = {
  items: GovernmentDebtExplorerModel["items"];
  family: DebtFamily;
  facts: ClientGovernmentDebtFact[];
  selectedIds: DebtSeriesId[];
  expandedParentIds: DebtSeriesId[];
  onSelectionChange: (ids: DebtSeriesId[]) => void;
  onToggle: (id: DebtSeriesId) => void;
  downloadAction: ReactNode;
};

function matches(item: GovernmentDebtExplorerModel["items"][number], query: string): boolean {
  return matchesLabelQuery(query, [item.kaLabel, item.enLabel, item.id]);
}

function formatSummary(fact: ClientGovernmentDebtFact | undefined, latestYear: number | undefined, locale: Locale): string {
  if (!fact || fact.value === null) return MISSING;
  const value = fact.family === "rate" ? formatShare(fact.value / 100) : formatAmount(fact.value, locale);
  return fact.family === "rate" && fact.year !== latestYear ? `${value} · ${fact.year}` : value;
}

export function DebtSeriesPanel({
  items,
  family,
  facts,
  selectedIds,
  expandedParentIds,
  onSelectionChange,
  onToggle,
  downloadAction,
}: DebtSeriesPanelProps) {
  const { locale, messages, englishLabels } = useI18n();
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<DebtSeriesId[]>(expandedParentIds);
  const normalizedQuery = query.trim().toLowerCase();
  const latestYearBySeries = new Map<DebtSeriesId, number>();
  const summaryBySeries = new Map<DebtSeriesId, ClientGovernmentDebtFact>();

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
  // Families never combine, so the bulk control's "all" (DESIGN.md §7.7) is the
  // active family's three rows: empty selects them, anything else clears.
  const familyIds = items.filter((item) => item.family === family).map((item) => item.id);
  const allFamilySelected = familyIds.every((id) => selectedIds.includes(id));
  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        searchable={items.length > SEARCHABLE_MIN_ROWS}
        selectedCount={selectedIds.length}
        totalCount={items.length}
        hasSelection={hasSelection}
        allSelected={allFamilySelected}
        onToggleAll={() => onSelectionChange(hasSelection ? [] : familyIds)}
        hasVisibleMatches={normalizedQuery === "" || visibleRows.length > 0}
      >
        {visibleRows.map(({ item, isChild, hasChildren, expanded, expansionLocked }) => (
          <SeriesSelectorRow
            key={item.id}
            id={item.id}
            label={publicLabel(locale, item.id, item.kaLabel, englishLabels)}
            color={item.color}
            value={formatSummary(summaryBySeries.get(item.id), latestYearBySeries.get(item.id), locale)}
            selected={selectedIds.includes(item.id)}
            level={isChild ? "debt_child" : "debt_parent"}
            parentId={item.parentItemId}
            showCaretColumn
            hasChildren={hasChildren}
            expanded={expanded}
            expansionLocked={expansionLocked}
            expansionLabel={message(messages, expanded ? "debt.collapse" : "debt.expand", { name: publicLabel(locale, item.id, item.kaLabel, englishLabels) })}
            showRail={isChild || expanded}
            isChild={isChild}
            childLabelSize="standard"
            wrapLabel={locale === "en"}
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
    </SeriesAside>
  );
}
