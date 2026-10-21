"use client";
import type { ReactNode } from "react";
import type {
  SectorDefinition,
  SectorMeasure,
} from "../../lib/data/economicSectors/types";
import { SECTORS_PAGE_CONFIG, orderSectorDefinitions, sectorColor, sectorTotalId, type SectorPageConfig } from "../../lib/explorer/economicSectors";
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
  visibleIds,
  config = SECTORS_PAGE_CONFIG,
}: {
  registry: SectorDefinition[];
  selectedIds: string[];
  endYear: number;
  endValues: Record<string, number | null>;
  measure: SectorMeasure;
  onSelectionChange: (ids: string[]) => void;
  downloadAction: ReactNode;
  /** The rows the measure has data for; the others are not listed. Every row when omitted. */
  visibleIds?: string[];
  config?: SectorPageConfig;
}) {
  const { locale, messages } = useI18n();
  const ordered = orderSectorDefinitions(registry, endValues, config).filter((r) => !visibleIds || visibleIds.includes(r.id));
  // The total (Total GDP on Sectors) stays pinned whatever the query, like every panel's total row.
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
          heading: config.ranked ? undefined : (locale === "en" ? r.headingEn : r.headingKa),
        };
      })}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      totalId={sectorTotalId(config)}
      pinTotal
      wrapLabel={false}
      asideLabel={message(messages, "controls.series")}
      caption={message(messages, `${config.scope}.rowYear`, { year: endYear })}
      searchPlaceholder={message(messages, "controls.search")}
      totalCount={ordered.length}
      downloadAction={downloadAction}
    />
  );
}
