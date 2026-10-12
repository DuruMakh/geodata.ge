"use client";
import type { ReactNode } from "react";
import type {
  SectorDefinition,
  SectorMeasure,
} from "../../lib/data/economicSectors/types";
import { SECTOR_GDP, sectorColor, rankSectorDefinitions } from "../../lib/explorer/economicSectors";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";

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
  const ordered = rankSectorDefinitions(registry, endValues);
  // Total GDP stays pinned whatever the query, like every panel's total row.
  return (
    <FlatSeriesPanel
      rows={ordered.map((r) => {
        const value = endValues[r.id];
        return {
          id: r.id,
          label: locale === "en" ? r.labelEn : r.labelKa,
          color: sectorColor(r.id),
          value: measure === "nominal" ? formatAmount(value, locale) : formatShare(value == null ? null : value / 100),
          searchTerms: [r.labelKa, r.labelEn, r.classificationCode ?? ""],
        };
      })}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      totalId={SECTOR_GDP}
      pinTotal
      wrapLabel={false}
      asideLabel={message(messages, "controls.series")}
      caption={message(messages, "sectors.rowYear", { year: endYear })}
      searchPlaceholder={message(messages, "controls.search")}
      totalCount={registry.length}
      downloadAction={downloadAction}
    />
  );
}
