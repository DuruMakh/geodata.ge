"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import type { Locale } from "../../lib/i18n/types";
import { useState, type ReactNode } from "react";
import type { GovernmentDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { formatAmount, formatShare, MISSING } from "../../lib/explorer/format";
import type { DebtFamily, DebtSeriesId, ClientGovernmentDebtFact } from "../../lib/servedRows";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { SeriesAside } from "../explorer-shell/series-aside";
import { buildTreeRows, nestTreeRows } from "../main-explorer/series-panel";

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
  const [expandedIds, setExpandedIds] = useState<DebtSeriesId[]>(expandedParentIds);
  const latestYearBySeries = new Map<DebtSeriesId, number>();
  const summaryBySeries = new Map<DebtSeriesId, ClientGovernmentDebtFact>();

  for (const fact of facts) {
    latestYearBySeries.set(fact.seriesId, Math.max(latestYearBySeries.get(fact.seriesId) ?? fact.year, fact.year));
    if (fact.value === null || fact.status !== "actual") continue;
    const current = summaryBySeries.get(fact.seriesId);
    if (!current || fact.year > current.year) summaryBySeries.set(fact.seriesId, fact);
  }

  // Debt has no search field (DESIGN §7.7): nothing is filtered, and only the carets open a family.
  const visibleRows = buildTreeRows(
    items.filter((item) => item.parentItemId === null),
    (parent) => items.filter((item) => item.parentItemId === parent.id),
    () => true,
    (item) => item.id,
    "",
    expandedIds,
  );

  const hasSelection = selectedIds.length > 0;
  // Families never combine, so the bulk control's "all" (DESIGN.md §7.7) is the
  // active family's three rows: empty selects them, anything else clears.
  const familyIds = items.filter((item) => item.family === family).map((item) => item.id);
  const allFamilySelected = familyIds.every((id) => selectedIds.includes(id));
  const renderRow = ({ item, isChild, hasChildren, expanded }: (typeof visibleRows)[number], members?: ReactNode) => (
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
    >
      {members}
    </SeriesSelectorRow>
  );
  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <SeriesSelector
        searchable={false}
        selectedCount={selectedIds.length}
        totalCount={items.length}
        hasSelection={hasSelection}
        allSelected={allFamilySelected}
        onToggleAll={() => onSelectionChange(hasSelection ? [] : familyIds)}
      >
        {nestTreeRows(visibleRows, (row) => row.isChild).map(({ row, children }) =>
          renderRow(row, children.length ? children.map((child) => renderRow(child)) : undefined))}
      </SeriesSelector>
      {downloadAction}
    </SeriesAside>
  );
}
