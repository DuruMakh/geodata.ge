"use client";

import { useState, type ReactNode } from "react";
import { MISSING } from "../../lib/explorer/format";
import {
  categoryPanelRows,
  categoryValues,
  latestWeight,
  panelValue,
  type CategoryPanelRow,
  type CategoryIndex,
  type CategoryState,
  type ResolvedPeriodRange,
} from "../../lib/explorer/inflationCategories";
import { categoryColor, categoryLabel, formatCategoryValue, formatWeight } from "../../lib/explorer/inflationCategoryLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { SeriesAside } from "../explorer-shell/series-aside";

// A thin composition of the shared selector, like InflationSeriesPanel. The
// two-level COICOP tree needs no new component: SeriesSelectorRow already does
// divisions with expandable subgroups, as the ministries explorer does.

type InflationCategoryPanelProps = {
  index: CategoryIndex;
  state: CategoryState;
  range: ResolvedPeriodRange;
  onToggle: (categoryId: string) => void;
  onToggleExpanded: (categoryId: string) => void;
  onToggleAll: () => void;
  downloadAction: ReactNode;
};

export function InflationCategoryPanel({
  index,
  state,
  range,
  onToggle,
  onToggleExpanded,
  onToggleAll,
  downloadAction,
}: InflationCategoryPanelProps) {
  const { messages } = useI18n();
  const [query, setQuery] = useState("");

  const rowFor = (row: CategoryPanelRow) => ({
    ...row,
    label: categoryLabel(messages, row.categoryId),
    // A category with no value on the active tab shows an em dash and stays out
    // of the chart, exactly as core inflation does on the overview's index tab.
    value:
      categoryValues(index, row.categoryId, state.tab) === undefined ? null : panelValue(index, row.categoryId, state, range),
    weight: latestWeight(index, row.categoryId),
  });

  const matches = query.trim().length === 0 ? null : (categoryId: string) =>
    matchesLabelQuery(query, [categoryLabel(messages, categoryId), categoryId]);
  const visible = categoryPanelRows(index, state.expanded, matches).map(rowFor);
  const divisionCount = index.tree.length;
  const selectedDivisions = state.selected.filter((categoryId) => !categoryId.includes("_")).length;
  const selectedSubgroups = state.selected.filter((categoryId) => categoryId.includes("_")).length;

  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        countLabel={message(messages, "inflation.categoryCounts")}
        selectedCount={selectedDivisions}
        totalCount={divisionCount}
        // A selected subgroup is never hidden by the division count (spec §6).
        supplementalSelected={{ label: message(messages, "inflation.subgroupCounts"), count: selectedSubgroups }}
        hasSelection={state.selected.length > 0}
        // "All" is the 12 divisions, never all 55 rows: a division and its own
        // subgroups overlap, so selecting both levels is the double count the
        // selection rule forbids. That makes select-all exactly the default.
        allSelected={selectedDivisions === divisionCount && selectedSubgroups === 0}
        onToggleAll={onToggleAll}
        hasVisibleMatches={visible.length > 0}
        // The two row values were named for screen readers only; sighted readers saw
        // "33.6%  +1.7" with nothing saying which number is which.
        listHeader={
          <p
            data-testid="category-value-columns"
            className="border-b border-[var(--row-border)] pr-1.5 pb-1.5 text-right text-[11px] min-[768px]:text-[10.5px] leading-snug text-[var(--muted)]"
          >
            {message(messages, "inflation.basketShare")} · {message(messages, `inflation.categoryTab.${state.tab}`)}
            {state.tab === "contrib" ? `, ${message(messages, "inflation.pp")}` : null}
          </p>
        }
      >
        {visible.map((row) => (
          <SeriesSelectorRow
            key={row.categoryId}
            id={row.categoryId}
            label={row.label}
            color={categoryColor(row.categoryId)}
            value={row.value === null ? MISSING : formatCategoryValue(row.value, state.tab)}
            meta={formatWeight(row.weight)}
            metaLabel={message(messages, "inflation.basketShare")}
            selected={state.selected.includes(row.categoryId)}
            level={String(row.level)}
            parentId={row.level === 3 ? row.categoryId.split("_")[0] : null}
            showCaretColumn
            hasChildren={row.hasChildren}
            expanded={row.expanded}
            expansionLocked={row.expansionLocked}
            expansionLabel={message(messages, "inflation.categorySubgroups")}
            isChild={row.level === 3}
            showRail={row.level === 3 && state.selected.includes(row.categoryId)}
            onToggle={() => onToggle(row.categoryId)}
            onToggleExpanded={() => onToggleExpanded(row.categoryId)}
          />
        ))}
      </SeriesSelector>
      {downloadAction}
    </SeriesAside>
  );
}
