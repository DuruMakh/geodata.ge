"use client";
import { useState, type ReactNode } from "react";
import { MONEY_TRANSFER_TOTAL_ID } from "../../lib/data/externalFlows/types";
import type { MoneyTransferSeries, MoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { formatInUnit } from "../../lib/explorer/format";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

type PanelModel = Pick<MoneyTransfersModel, "series" | "selectedIds" | "valuesByEntity" | "range" | "unit" | "selectedCount" | "totalCount">;
/** Also serves Foreign investment, which passes its own total id and search placeholder. */
export function MoneyFromAbroadSeriesPanel({ model, onSelectionChange, downloadAction, totalId = MONEY_TRANSFER_TOTAL_ID, searchPlaceholder }: { model: PanelModel; onSelectionChange: (ids: string[]) => void; downloadAction: ReactNode; totalId?: string; searchPlaceholder?: string }) {
  const [query, setQuery] = useState("");
  const { messages } = useI18n();
  const t = (key: string) => message(messages, `external.money.${key}`);
  const visible = model.series.filter(item => matchesLabelQuery(query, [item.label]));
  const toggle = (id: string) => onSelectionChange(model.selectedIds.includes(id) ? model.selectedIds.filter(selected => selected !== id) : [...model.selectedIds, id]);
  const row = (item: MoneyTransferSeries) => <SeriesSelectorRow key={item.id} id={item.id} label={item.label} color={item.color} value={formatInUnit(model.valuesByEntity[item.id][model.range.end], model.unit)} selected={model.selectedIds.includes(item.id)} level={item.id === totalId ? "total" : "item"} wrapLabel onToggle={() => toggle(item.id)} />;
  return <>
    <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {model.unit.label}</p>
    <SeriesSelector query={query} onQueryChange={setQuery} searchPlaceholder={searchPlaceholder ?? t("searchCountries")} selectedCount={model.selectedCount} totalCount={model.totalCount} hasSelection={model.selectedCount > 0} allSelected={model.selectedCount === model.totalCount} onToggleAll={() => onSelectionChange(model.selectedCount ? [] : model.series.map(item => item.id))} hasVisibleMatches={visible.length > 0}>
      {visible.map(row)}
    </SeriesSelector>
    {downloadAction}
  </>;
}
