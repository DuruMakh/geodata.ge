"use client";
import type { ReactNode } from "react";
import type { UnemploymentGroupDefinition, UnemploymentIndicator } from "../../lib/data/unemployment/types";
import { unemploymentIsRate } from "../../lib/data/unemployment/types";
import { formatUnemploymentValue, unemploymentCountUnit, unemploymentGroupColor } from "../../lib/explorer/unemployment";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";

export function UnemploymentSeriesPanel({ definitions, referenceId, selectedIds, endValues, endYear, indicator, query, onQueryChange, onSelectionChange, controls, downloadAction }: {
  definitions: UnemploymentGroupDefinition[]; referenceId: string; selectedIds: string[]; endValues: Record<string, number | null>; endYear: number;
  indicator: UnemploymentIndicator; query: string; onQueryChange: (query: string) => void; onSelectionChange: (ids: string[]) => void; controls: ReactNode; downloadAction: ReactNode;
}) {
  const { locale, messages } = useI18n();
  const unit = unemploymentCountUnit(messages);
  return <FlatSeriesPanel
    rows={definitions.map(group => ({ id: group.id, label: locale === "en" ? group.labelEn : group.labelKa, color: unemploymentGroupColor(group),
      value: formatUnemploymentValue(endValues[group.id], unemploymentIsRate(indicator), messages),
      searchTerms: [group.labelKa, group.labelEn] }))}
    selectedIds={selectedIds} onSelectionChange={onSelectionChange} totalId={referenceId} pinTotal
    asideLabel={message(messages, "controls.series")} caption={`${endYear} · ${unemploymentIsRate(indicator) ? "%" : unit.label}`}
    controls={controls} query={query} onQueryChange={onQueryChange} searchPlaceholder={message(messages, "controls.search")} downloadAction={downloadAction} />;
}
