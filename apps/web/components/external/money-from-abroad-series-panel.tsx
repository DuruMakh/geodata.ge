"use client";
import { useState, type ReactNode } from "react";
import type { ClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { MONEY_TRANSFER_TOTAL_ID } from "../../lib/data/externalFlows/types";
import { moneyTransferColor, type MoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { moneyTransfersBulkSelection, type MoneyTransfersState } from "../../lib/explorer/moneyTransfersState";
import { formatInUnit } from "../../lib/explorer/format";
import { publicLabel } from "../../lib/i18n/labels";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

export function MoneyFromAbroadSeriesPanel({ data, state, model, onSelectionChange, downloadAction }: { data: ClientMoneyTransfersData; state: MoneyTransfersState; model: MoneyTransfersModel; onSelectionChange: (ids: string[]) => void; downloadAction: ReactNode }) {
  const [query, setQuery] = useState("");
  const { locale, englishLabels, messages } = useI18n();
  const t = (key: string) => message(messages, `external.money.${key}`);
  const label = (entity: (typeof data.entities)[number]) => publicLabel(locale, entity.id, entity.labelKa, englishLabels);
  const visible = model.activeEntities.filter(entity => matchesLabelQuery(query, [label(entity)]));
  const toggle = (id: string) => onSelectionChange(state.selectedIds.includes(id) ? state.selectedIds.filter(selected => selected !== id) : [...state.selectedIds, id]);
  const row = (entity: (typeof data.entities)[number]) => <SeriesSelectorRow key={entity.id} id={entity.id} label={label(entity)} color={moneyTransferColor(entity.id)} value={formatInUnit(model.valuesByEntity[entity.id][model.range.end], model.unit)} selected={model.selectedIds.includes(entity.id)} level={entity.id === MONEY_TRANSFER_TOTAL_ID ? "total" : "item"} wrapLabel onToggle={() => toggle(entity.id)} />;
  return <>
    <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {model.unit.label}</p>
    <SeriesSelector query={query} onQueryChange={setQuery} searchPlaceholder={t("searchCountries")} selectedCount={model.selectedCount} totalCount={model.totalCount} hasSelection={model.selectedCount > 0} allSelected={model.selectedCount === model.totalCount} onToggleAll={() => onSelectionChange(model.selectedCount ? [] : moneyTransfersBulkSelection(data))} hasVisibleMatches={visible.length > 0}>
      {visible.map(row)}
    </SeriesSelector>
    {downloadAction}
  </>;
}
