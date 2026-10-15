"use client";
import { useState, type ReactNode } from "react";
import { toggleId } from "../../lib/explorer/selection";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { SeriesAside } from "./series-aside";

/**
 * One row of a series list; `value` is already formatted for the end year. `parentId` nests it under that row in a `nesting` list.
 * `heading`, on a top-level row, places it under a small label the panel prints before the first listed row of each new heading.
 */
export type FlatSeriesRow = { id: string; label: string; color: string; value: string; searchTerms?: string[]; parentId?: string; heading?: string };

/**
 * The listed rows with each `heading` label before the first of its rows: a muted caption, not a checkbox. A heading
 * whose rows a search hides lists nothing, so its label is left out too. Rows without a heading render as they always have.
 */
function withHeadings(entries: { row: FlatSeriesRow; node: ReactNode }[]): ReactNode[] {
  let current: string | undefined;
  return entries.flatMap(({ row, node }, index) => {
    // A hidden row stays an empty slot, so a list without headings keeps its children (and their ids) as they were.
    if (node === null) return [node];
    const label = row.heading && row.heading !== current
      ? <p key={`heading-${index}`} role="presentation" data-testid="series-heading" className="mt-3 mb-1 px-0.5 text-[11px] text-[var(--muted)]">{row.heading}</p>
      : null;
    current = row.heading;
    return label ? [label, node] : [node];
  });
}

/**
 * Nests each row with a `parentId` under that row's caret. The counter and the bulk action then cover the
 * top-level rows, ticks under a caret are counted apart as `selectedLabel`, and a tick keeps the list's order.
 * A parent stays open while a search matches one of its rows or one of them is ticked, until its caret is used.
 */
export type SeriesNesting = {
  selectedLabel: string;
  expansionLabel: (label: string) => string;
  /** The open carets, for a page that closes them all when it changes view; the panel keeps its own otherwise. */
  expanded?: Record<string, boolean>;
  onExpandedChange?: (expanded: Record<string, boolean>) => void;
};

/**
 * A series list: a caption, then the shared selector with search, the bulk control and one row
 * per series, then the download action. `totalId` marks the total row; with `pinTotal` it stays
 * listed whatever the search. Search never scopes the bulk action or the counter (AGENTS.md UI
 * contract). Rows are flat unless `nesting` is given.
 */
export function FlatSeriesPanel({
  rows,
  selectedIds,
  onSelectionChange,
  caption,
  searchPlaceholder,
  downloadAction,
  totalId,
  pinTotal = false,
  wrapLabel = true,
  asideLabel,
  controls,
  query: controlledQuery,
  onQueryChange,
  searchable = true,
  selectedCount = selectedIds.length,
  totalCount = rows.length,
  nesting,
}: {
  rows: FlatSeriesRow[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  caption: ReactNode;
  /** May be left out of a list that is never searchable. */
  searchPlaceholder?: string;
  downloadAction: ReactNode;
  totalId?: string;
  pinTotal?: boolean;
  wrapLabel?: boolean;
  asideLabel?: string;
  controls?: ReactNode;
  query?: string;
  onQueryChange?: (query: string) => void;
  /** False hides the search field (a list of `SEARCHABLE_MIN_ROWS` rows or fewer). */
  searchable?: boolean;
  selectedCount?: number;
  totalCount?: number;
  nesting?: SeriesNesting;
}) {
  const [ownQuery, setOwnQuery] = useState("");
  const [ownExpanded, setOwnExpanded] = useState<Record<string, boolean>>({});
  const query = controlledQuery ?? ownQuery;
  const setQuery = onQueryChange ?? setOwnQuery;
  const matches = (row: FlatSeriesRow) => matchesLabelQuery(query, row.searchTerms ?? [row.label]);
  const pinned = (row: FlatSeriesRow) => pinTotal && row.id === totalId;
  // A nested list counts and bulk-selects its top-level rows; a flat one every row, unless its page counts otherwise.
  const topRows = nesting ? rows.filter((row) => !row.parentId) : rows;
  const counted = nesting ? topRows.filter((row) => selectedIds.includes(row.id)).length : selectedCount;
  const countedOf = nesting ? topRows.length : totalCount;
  const hasSelection = (nesting ? selectedIds.length : selectedCount) > 0;
  const nestedSelected = nesting && selectedIds.length > counted ? { label: nesting.selectedLabel, count: selectedIds.length - counted } : undefined;
  const order = nesting ? rows.map((row) => row.id) : undefined;
  const toggle = (id: string) => onSelectionChange(toggleId(selectedIds, id, order));
  const expanded = nesting?.expanded ?? ownExpanded;
  const setExpanded = nesting?.onExpandedChange ?? setOwnExpanded;
  const hasCarets = rows.some((row) => row.parentId);
  function nestedRow(row: FlatSeriesRow, labels: SeriesNesting): ReactNode {
    const children = rows.filter((child) => child.parentId === row.id);
    if (!pinned(row) && !matches(row) && !children.some(matches)) return null;
    const open = (Boolean(query.trim()) && children.some(matches)) || (expanded[row.id] ?? children.some((child) => selectedIds.includes(child.id)));
    return <div key={row.id} className={row.parentId ? "ml-4" : undefined}>
      <SeriesSelectorRow id={row.id} label={row.label} color={row.color} value={row.value} selected={selectedIds.includes(row.id)} level={row.id === totalId ? "total" : "item"} parentId={row.parentId} isChild={Boolean(row.parentId)} childLabelSize="standard" wrapLabel={wrapLabel}
        showCaretColumn={hasCarets} hasChildren={children.length > 0} expanded={open} expansionLabel={labels.expansionLabel(row.label)}
        onToggleExpanded={() => setExpanded({ ...expanded, [row.id]: !open })} onToggle={() => toggle(row.id)}>
        {open && children.length ? children.map((child) => nestedRow(child, labels)) : undefined}
      </SeriesSelectorRow>
    </div>;
  }
  const panel = <>
    <p className="mb-3 text-[11px] text-[var(--muted)]">{caption}</p>
    <SeriesSelector controls={controls} query={query} onQueryChange={setQuery} searchPlaceholder={searchPlaceholder} searchable={searchable} selectedCount={counted} totalCount={countedOf} supplementalSelected={nestedSelected} hasSelection={hasSelection} allSelected={counted === countedOf} onToggleAll={() => onSelectionChange(hasSelection ? [] : topRows.map((row) => row.id))} hasVisibleMatches={rows.some(matches)}>
      {withHeadings(nesting ? topRows.map((row) => ({ row, node: nestedRow(row, nesting) }))
        : rows.filter((row) => pinned(row) || matches(row)).map((row) => ({ row, node: <SeriesSelectorRow key={row.id} id={row.id} label={row.label} color={row.color} value={row.value} selected={selectedIds.includes(row.id)} level={row.id === totalId ? "total" : "item"} wrapLabel={wrapLabel} onToggle={() => toggle(row.id)} /> })))}
    </SeriesSelector>
    {downloadAction}
  </>;
  return asideLabel ? <SeriesAside label={asideLabel}>{panel}</SeriesAside> : panel;
}
