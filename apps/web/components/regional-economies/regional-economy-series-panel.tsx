"use client";

import type { ReactNode } from "react";
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
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";

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
  const ordered = rankRegionalEconomyDefinitions(regionalEconomyDefinitions(registry), endValues);
  return (
    <FlatSeriesPanel
      rows={ordered.map((definition) => {
        const value = endValues[definition.id];
        return {
          id: definition.id,
          label: locale === "en" ? definition.labelEn : definition.labelKa,
          color: regionalEconomyColor(definition.id),
          value: measure === "nominal" ? formatAmount(value, locale) : formatShare(value == null ? null : value / 100),
          searchTerms: [definition.labelKa, definition.labelEn, definition.classificationCode ?? ""],
        };
      })}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      totalId={REGIONAL_GDP_TOTAL}
      pinTotal
      asideLabel={message(messages, "controls.series")}
      caption={message(messages, "regionalEconomies.rowYear", { year: endYear })}
      searchPlaceholder={message(messages, "controls.search")}
      downloadAction={downloadAction}
    />
  );
}
