"use client";

import { useState, type ReactNode } from "react";
import type { ServedInflationTargetRow } from "../../lib/data/inflation/types";
import { MISSING } from "../../lib/explorer/format";
import { formatInflationValue, seriesLabel } from "../../lib/explorer/inflationLabels";
import { INFLATION_COLORS, SELECTION_ORDER, panelValue, type InflationIndex, type InflationSelectionKey, type InflationState, type ResolvedPeriodRange } from "../../lib/explorer/inflationOverview";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

// A thin composition of the shared selector, as DebtSeriesPanel is. The target
// is a reference row with a dashed swatch; values follow the active tab and range.

type InflationSeriesPanelProps = {
  index: InflationIndex;
  targets: ServedInflationTargetRow[];
  state: InflationState;
  range: ResolvedPeriodRange;
  onToggle: (key: InflationSelectionKey) => void;
  onClear: () => void;
  downloadAction: ReactNode;
};

export function InflationSeriesPanel({ index, targets, state, range, onToggle, onClear, downloadAction }: InflationSeriesPanelProps) {
  const { messages } = useI18n();
  const [query, setQuery] = useState("");
  const rows = SELECTION_ORDER.map((key) => ({ key, label: seriesLabel(messages, key, state.tab), value: panelValue(index, targets, key, state, range) }));
  const visible = rows.filter((row) => matchesLabelQuery(query, [row.label, row.key]));

  return (
    <aside
      aria-label={message(messages, "controls.series")}
      className="min-w-0 max-w-full border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:sticky @min-[1100px]:top-5 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]"
    >
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={state.selected.length}
        totalCount={rows.length}
        hasSelection={state.selected.length > 0}
        allSelected={false}
        onToggleAll={onClear}
        allowSelectAll={false}
        hasVisibleMatches={visible.length > 0}
      >
        {visible.map((row) => (
          <SeriesSelectorRow
            key={row.key}
            id={row.key}
            label={row.label}
            color={INFLATION_COLORS[row.key]}
            value={row.value === null ? MISSING : formatInflationValue(row.value, state.tab)}
            selected={state.selected.includes(row.key)}
            swatch={row.key === "target" ? "dashed" : "solid"}
            onToggle={() => onToggle(row.key)}
          />
        ))}
      </SeriesSelector>
      {downloadAction}
    </aside>
  );
}
