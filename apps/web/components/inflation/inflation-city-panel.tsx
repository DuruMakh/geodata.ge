"use client";

import { useState, type ReactNode } from "react";
import { MISSING } from "../../lib/explorer/format";
import { cityPanelValue, cityViewLineIds, type CityIndex, type CityState, type CityView, type ResolvedPeriodRange } from "../../lib/explorer/inflationCities";
import { cityViewLineColor, cityViewLineLabel, formatCityValue } from "../../lib/explorer/inflationCityLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SEARCHABLE_MIN_ROWS, SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

// The Georgia page lists seven places; a city page, its total and 12 divisions.
// Search never scopes the bulk action or the denominator (AGENTS.md UI contract).
export function InflationCityPanel({
  index,
  view,
  state,
  range,
  onToggle,
  onToggleAll,
  downloadAction,
}: {
  index: CityIndex;
  view: CityView;
  state: CityState;
  range: ResolvedPeriodRange;
  onToggle: (lineId: string) => void;
  onToggleAll: () => void;
  downloadAction: ReactNode;
}) {
  const { messages } = useI18n();
  const [query, setQuery] = useState("");
  const lineIds = cityViewLineIds(view);
  const rows = lineIds.map((lineId) => ({ lineId, label: cityViewLineLabel(messages, view, lineId), value: cityPanelValue(index, view, lineId, range) }));
  const visible = rows.filter((row) => matchesLabelQuery(query, [row.label, row.lineId]));
  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        searchable={lineIds.length > SEARCHABLE_MIN_ROWS}
        selectedCount={state.selected.length}
        totalCount={lineIds.length}
        hasSelection={state.selected.length > 0}
        allSelected={state.selected.length === lineIds.length}
        onToggleAll={onToggleAll}
        hasVisibleMatches={visible.length > 0}
      >
        {visible.map((row) => (
          <SeriesSelectorRow
            key={row.lineId}
            id={row.lineId}
            label={row.label}
            color={cityViewLineColor(view, row.lineId)}
            value={row.value === null ? MISSING : formatCityValue(row.value)}
            selected={state.selected.includes(row.lineId)}
            onToggle={() => onToggle(row.lineId)}
          />
        ))}
      </SeriesSelector>
      {downloadAction}
    </SeriesAside>
  );
}
