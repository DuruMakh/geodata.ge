"use client";
import { useState, type ReactNode } from "react";
import { toggleId } from "../../lib/explorer/selection";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { SeriesAside } from "./series-aside";

/** One row of a flat series list; `value` is already formatted for the end year. */
export type FlatSeriesRow = { id: string; label: string; color: string; value: string; searchTerms?: string[] };

/**
 * A flat series list (no nesting): a caption, then the shared selector with search, the
 * bulk control and one row per series, then the download action. `totalId` marks the total
 * row; with `pinTotal` it stays listed whatever the search. Search never scopes the bulk
 * action or the counter (AGENTS.md UI contract).
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
  selectedCount = selectedIds.length,
  totalCount = rows.length,
}: {
  rows: FlatSeriesRow[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  caption: ReactNode;
  searchPlaceholder: string;
  downloadAction: ReactNode;
  totalId?: string;
  pinTotal?: boolean;
  wrapLabel?: boolean;
  asideLabel?: string;
  controls?: ReactNode;
  query?: string;
  onQueryChange?: (query: string) => void;
  selectedCount?: number;
  totalCount?: number;
}) {
  const [ownQuery, setOwnQuery] = useState("");
  const query = controlledQuery ?? ownQuery;
  const setQuery = onQueryChange ?? setOwnQuery;
  const matches = (row: FlatSeriesRow) => matchesLabelQuery(query, row.searchTerms ?? [row.label]);
  const visible = rows.filter((row) => (pinTotal && row.id === totalId) || matches(row));
  const panel = <>
    <p className="mb-3 text-[11px] text-[var(--muted)]">{caption}</p>
    <SeriesSelector controls={controls} query={query} onQueryChange={setQuery} searchPlaceholder={searchPlaceholder} selectedCount={selectedCount} totalCount={totalCount} hasSelection={selectedCount > 0} allSelected={selectedCount === totalCount} onToggleAll={() => onSelectionChange(selectedCount ? [] : rows.map((row) => row.id))} hasVisibleMatches={rows.some(matches)}>
      {visible.map((row) => <SeriesSelectorRow key={row.id} id={row.id} label={row.label} color={row.color} value={row.value} selected={selectedIds.includes(row.id)} level={row.id === totalId ? "total" : "item"} wrapLabel={wrapLabel} onToggle={() => onSelectionChange(toggleId(selectedIds, row.id))} />)}
    </SeriesSelector>
    {downloadAction}
  </>;
  return asideLabel ? <SeriesAside label={asideLabel}>{panel}</SeriesAside> : panel;
}
