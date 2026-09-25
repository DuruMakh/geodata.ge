"use client";

import { useState, type ReactNode } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import type { RegionalEconomyMeasure } from "../../lib/data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import {
  rankRegionalEconomyDefinitions,
  regionalEconomyColor,
  regionalEconomyDefinitions,
} from "../../lib/explorer/regionalEconomies";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { SeriesAside } from "../explorer-shell/series-aside";

export function RegionalEconomySeriesPanel({
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
  measure: RegionalEconomyMeasure;
  onSelectionChange: (ids: string[]) => void;
  downloadAction: ReactNode;
}) {
  const { locale, messages } = useI18n();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const ordered = rankRegionalEconomyDefinitions(regionalEconomyDefinitions(registry), endValues);
  const matches = (definition: SectorDefinition) =>
    `${definition.labelKa} ${definition.labelEn} ${definition.classificationCode ?? ""}`.toLocaleLowerCase().includes(normalized);
  const visible = ordered.filter((definition) => definition.id === REGIONAL_GDP_TOTAL || matches(definition));
  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <p className="mb-3 text-[11px] text-[var(--muted)]">{message(messages, "regionalEconomies.rowYear", { year: endYear })}</p>
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={selectedIds.length}
        totalCount={ordered.length}
        hasSelection={selectedIds.length > 0}
        allSelected={ordered.every((definition) => selectedIds.includes(definition.id))}
        onToggleAll={() => onSelectionChange(selectedIds.length ? [] : ordered.map((definition) => definition.id))}
        hasVisibleMatches={ordered.some(matches)}
      >
        {visible.map((definition) => {
          const value = endValues[definition.id];
          return (
            <SeriesSelectorRow
              key={definition.id}
              id={definition.id}
              label={locale === "en" ? definition.labelEn : definition.labelKa}
              color={regionalEconomyColor(definition.id)}
              value={measure === "nominal" ? formatAmount(value, locale) : formatShare(value == null ? null : value / 100)}
              selected={selectedIds.includes(definition.id)}
              level={definition.id === REGIONAL_GDP_TOTAL ? "total" : "item"}
              wrapLabel
              onToggle={() => onSelectionChange(
                selectedIds.includes(definition.id)
                  ? selectedIds.filter((id) => id !== definition.id)
                  : [...selectedIds, definition.id],
              )}
            />
          );
        })}
      </SeriesSelector>
      {downloadAction}
    </SeriesAside>
  );
}
