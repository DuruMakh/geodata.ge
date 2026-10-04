"use client";
import type { ReactNode } from "react";
import type { UnemploymentGroupDefinition, UnemploymentIndicator } from "../../lib/data/unemployment/types";
import { unemploymentIsRate } from "../../lib/data/unemployment/types";
import { unemploymentGroupColor } from "../../lib/explorer/unemployment";
import { formatInUnit, formatShare } from "../../lib/explorer/format";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

export function UnemploymentSeriesPanel({ definitions, referenceId, selectedIds, endValues, endYear, indicator, query, onQueryChange, onSelectionChange, controls, downloadAction }: {
  definitions: UnemploymentGroupDefinition[]; referenceId: string; selectedIds: string[]; endValues: Record<string, number | null>; endYear: number;
  indicator: UnemploymentIndicator; query: string; onQueryChange: (query: string) => void; onSelectionChange: (ids: string[]) => void; controls: ReactNode; downloadAction: ReactNode;
}) {
  const { locale, messages } = useI18n();
  const matches = (group: UnemploymentGroupDefinition) => matchesLabelQuery(query, [group.labelKa, group.labelEn]);
  const visible = definitions.filter(group => group.id === referenceId || matches(group));
  const unit = { divisor: 1, decimals: 1, label: message(messages, "unemployment.thousandPersons") };
  return <SeriesAside label={message(messages, "controls.series")}>
    <p className="mb-3 text-[11px] text-[var(--muted)]">{endYear} · {unemploymentIsRate(indicator) ? "%" : unit.label}</p>
    <SeriesSelector controls={controls} query={query} onQueryChange={onQueryChange} searchPlaceholder={message(messages, "unemployment.search")}
      selectedCount={selectedIds.length} totalCount={definitions.length} hasSelection={selectedIds.length > 0} allSelected={definitions.every(group => selectedIds.includes(group.id))}
      onToggleAll={() => onSelectionChange(selectedIds.length ? [] : definitions.map(group => group.id))} hasVisibleMatches={definitions.some(matches)}>
      {visible.map(group => <SeriesSelectorRow key={group.id} id={group.id} label={locale === "en" ? group.labelEn : group.labelKa} color={unemploymentGroupColor(group)}
        value={unemploymentIsRate(indicator) ? formatShare(endValues[group.id] == null ? null : endValues[group.id]! / 100) : formatInUnit(endValues[group.id], unit)}
        selected={selectedIds.includes(group.id)} level={group.id === referenceId ? "total" : "item"} wrapLabel
        onToggle={() => onSelectionChange(selectedIds.includes(group.id) ? selectedIds.filter(id => id !== group.id) : [...selectedIds, group.id])} />)}
    </SeriesSelector>
    {downloadAction}
  </SeriesAside>;
}
