"use client";
import { useState, type ReactNode } from "react";
import { unemploymentIsRate } from "../../lib/data/unemployment/types";
import { unemploymentGroupColor } from "../../lib/explorer/unemployment";
import { INK } from "../../lib/explorer/colors";
import { unemploymentSeriesLabel, type UnemploymentSeriesDefinition } from "../../lib/explorer/unemploymentOverview";
import type { UnemploymentState } from "../../lib/explorer/unemploymentState";
import { formatInUnit, formatShare } from "../../lib/explorer/format";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

type Row = { id: string; seriesId: string; label: string; definition: UnemploymentSeriesDefinition; parentId?: string };
export function UnemploymentOverviewSeriesPanel({ definitions, referenceId, state, endValues, endYear, query, onQueryChange, onSelectionChange, downloadAction }: {
  definitions: UnemploymentSeriesDefinition[]; referenceId: string; state: UnemploymentState; endValues: Record<string, number | null>; endYear: number;
  query: string; onQueryChange: (query: string) => void; onSelectionChange: (ids: string[]) => void; downloadAction: ReactNode;
}) {
  const presentation = useI18n(), { messages } = presentation;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const t = (key: string) => message(messages, `unemployment.${key}`);
  const unit = { divisor: 1, decimals: 1, label: t("thousandPersons") };
  const rows: Row[] = definitions.filter(definition => state.breakdown !== "long_term" || definition.groupId !== "georgia").map(definition => ({ id: definition.id, seriesId: definition.id, label: unemploymentSeriesLabel(definition, state, presentation, true), definition, parentId: definition.parentId }));
  if (state.breakdown === "long_term") for (const definition of definitions.filter(item => item.groupId === "georgia")) {
    rows.push({ id: `metric.${definition.indicatorId}`, seriesId: definition.id, label: t(`indicator.${definition.indicatorId}`), definition });
  }
  const children = (id: string) => rows.filter(row => row.parentId === id);
  const descendants = (id: string): Row[] => children(id).flatMap(row => [row, ...descendants(row.id)]);
  const matches = (row: Row) => matchesLabelQuery(query, [row.label, row.definition.labelKa, row.definition.labelEn, unemploymentSeriesLabel(row.definition, state, presentation)]);
  const compatible = definitions.filter(definition => unemploymentIsRate(definition.indicatorId) === unemploymentIsRate(state.indicator));
  function renderRow(row: Row, depth = 0): ReactNode {
    const nested = children(row.id), below = descendants(row.id);
    if (row.seriesId !== referenceId && !matches(row) && !below.some(matches)) return null;
    const open = Boolean(query.trim()) && below.some(matches) || (expanded[row.id] ?? below.some(child => child.seriesId !== row.seriesId && state.selectedIds.includes(child.seriesId)));
    const color = row.seriesId === referenceId ? INK : unemploymentGroupColor(row.definition);
    const value = endValues[row.seriesId];
    return <div key={row.id} className={depth ? "ml-4" : undefined}>
      <SeriesSelectorRow id={row.id} label={row.label} color={color} value={unemploymentIsRate(row.definition.indicatorId) ? formatShare(value == null ? null : value / 100) : `${formatInUnit(value, unit)} ${t("thousandShort")}`}
        selected={state.selectedIds.includes(row.seriesId)} level={row.seriesId === referenceId && !row.parentId ? "total" : "item"} parentId={row.parentId} isChild={Boolean(row.parentId)} childLabelSize="standard" wrapLabel
        showCaretColumn hasChildren={nested.length > 0} expanded={open} expansionLabel={message(messages, "unemployment.subcategoriesFor", { label: row.label })}
        onToggleExpanded={() => setExpanded(previous => ({ ...previous, [row.id]: !open }))}
        onToggle={() => onSelectionChange(state.selectedIds.includes(row.seriesId) ? state.selectedIds.filter(id => id !== row.seriesId) : [...state.selectedIds, row.seriesId])} />
      {open ? nested.map(child => renderRow(child, depth + 1)) : null}
    </div>;
  }
  return <SeriesAside label={message(messages, "controls.series")}>
    <p className="mb-3 text-[11px] text-[var(--muted)]">{endYear} · {unemploymentIsRate(state.indicator) ? "%" : unit.label}</p>
    <SeriesSelector query={query} onQueryChange={onQueryChange} searchPlaceholder={t("searchIndicators")} selectedCount={state.selectedIds.length} totalCount={compatible.length}
      hasSelection={state.selectedIds.length > 0} allSelected={compatible.every(definition => state.selectedIds.includes(definition.id))}
      onToggleAll={() => onSelectionChange(state.selectedIds.length ? [] : compatible.map(definition => definition.id))} hasVisibleMatches={rows.some(matches)}>
      {rows.filter(row => !row.parentId).map(row => renderRow(row))}
    </SeriesSelector>
    <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">{t("unitSelectionNote")}</p>
    {downloadAction}
  </SeriesAside>;
}
