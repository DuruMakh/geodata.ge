"use client";
import { useState, type ReactNode } from "react";
import type {
  SectorDefinition,
  SectorMeasure,
} from "../../lib/data/economicSectors/types";
import { SECTOR_GDP, sectorColor, rankSectorDefinitions, sectorMatchesQuery } from "../../lib/explorer/economicSectors";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import {
  SeriesSelector,
  SeriesSelectorRow,
} from "../main-explorer/series-selector";

export function SectorSeriesPanel({
  registry,
  selectedIds,
  endYear,
  endValues,
  measure,
  onSelectionChange,
  downloadAction,
}: {
  registry: SectorDefinition[];
  selectedIds: string[];
  endYear: number;
  endValues: Record<string, number | null>;
  measure: SectorMeasure;
  onSelectionChange: (ids: string[]) => void;
  downloadAction: ReactNode;
}) {
  const { locale, messages } = useI18n();
  const [query, setQuery] = useState("");
  const ordered = rankSectorDefinitions(registry, endValues);
  // Total GDP stays pinned whatever the query, like every panel's total row.
  const visible = ordered.filter((r) => r.id === SECTOR_GDP || sectorMatchesQuery(r, query));
  return (
    <aside
      aria-label={message(messages, "controls.series")}
      className="min-w-0 max-w-full border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:sticky @min-[1100px]:top-5 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]"
    >
      <p className="mb-3 text-[11px] text-[var(--muted)]">
        {message(messages, "sectors.rowYear", { year: endYear })}
      </p>
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={selectedIds.length}
        totalCount={registry.length}
        hasSelection={selectedIds.length > 0}
        allSelected={ordered.every((r) => selectedIds.includes(r.id))}
        onToggleAll={() =>
          onSelectionChange(selectedIds.length ? [] : ordered.map((r) => r.id))
        }
        hasVisibleMatches={ordered.some((r) => sectorMatchesQuery(r, query))}
      >
        {visible.map((r) => {
          const value = endValues[r.id];
          return (
            <SeriesSelectorRow
              key={r.id}
              id={r.id}
              label={locale === "en" ? r.labelEn : r.labelKa}
              color={sectorColor(r.id)}
              value={
                measure === "nominal"
                  ? formatAmount(value, locale)
                  : formatShare(value == null ? null : value / 100)
              }
              selected={selectedIds.includes(r.id)}
              level={r.id === SECTOR_GDP ? "total" : "item"}
              onToggle={() =>
                onSelectionChange(
                  selectedIds.includes(r.id)
                    ? selectedIds.filter((id) => id !== r.id)
                    : [...selectedIds, r.id],
                )
              }
            />
          );
        })}
      </SeriesSelector>
      {downloadAction}
    </aside>
  );
}
