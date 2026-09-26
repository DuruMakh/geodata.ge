"use client";

import { useState, type ReactNode } from "react";
import { MISSING } from "../../lib/explorer/format";
import { CITY_LINE_IDS, cityPanelValue, type CityIndex, type CityLineId, type CityState, type ResolvedPeriodRange } from "../../lib/explorer/inflationCities";
import { cityLineColor, cityLineLabel, formatCityValue } from "../../lib/explorer/inflationCityLabels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

// Seven rows: Georgia first as the benchmark, then the cities in Geostat's order.
// Search never scopes the bulk action or the denominator (AGENTS.md UI contract).
export function InflationCityPanel({
  index,
  state,
  range,
  onToggle,
  onToggleAll,
  downloadAction,
}: {
  index: CityIndex;
  state: CityState;
  range: ResolvedPeriodRange;
  onToggle: (lineId: CityLineId) => void;
  onToggleAll: () => void;
  downloadAction: ReactNode;
}) {
  const { messages } = useI18n();
  const [query, setQuery] = useState("");
  const rows = CITY_LINE_IDS.map((lineId) => ({ lineId, label: cityLineLabel(messages, lineId), value: cityPanelValue(index, lineId, state, range) }));
  const visible = rows.filter((row) => matchesLabelQuery(query, [row.label, row.lineId]));
  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={state.selected.length}
        totalCount={CITY_LINE_IDS.length}
        hasSelection={state.selected.length > 0}
        allSelected={state.selected.length === CITY_LINE_IDS.length}
        onToggleAll={onToggleAll}
        hasVisibleMatches={visible.length > 0}
      >
        {visible.map((row) => (
          <SeriesSelectorRow
            key={row.lineId}
            id={row.lineId}
            label={row.label}
            color={cityLineColor(row.lineId)}
            value={row.value === null ? MISSING : formatCityValue(row.value, state.tab)}
            selected={state.selected.includes(row.lineId)}
            onToggle={() => onToggle(row.lineId)}
          />
        ))}
      </SeriesSelector>
      {downloadAction}
    </SeriesAside>
  );
}
