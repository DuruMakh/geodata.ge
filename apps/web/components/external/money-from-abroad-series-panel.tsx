"use client";
import type { ReactNode } from "react";
import { MONEY_TRANSFER_TOTAL_ID } from "../../lib/data/externalFlows/types";
import type { MoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { formatInUnit } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";

type PanelModel = Pick<MoneyTransfersModel, "series" | "selectedIds" | "valuesByEntity" | "range" | "unit" | "selectedCount" | "totalCount">;
/** Also serves Foreign investment and Current account, which pass its own total id and search placeholder. */
export function MoneyFromAbroadSeriesPanel({ model, onSelectionChange, downloadAction, totalId = MONEY_TRANSFER_TOTAL_ID, searchPlaceholder }: { model: PanelModel; onSelectionChange: (ids: string[]) => void; downloadAction: ReactNode; totalId?: string; searchPlaceholder?: string }) {
  const { messages } = useI18n();
  return <FlatSeriesPanel
    rows={model.series.map(item => ({ id: item.id, label: item.label, color: item.color, value: formatInUnit(model.valuesByEntity[item.id][model.range.end], model.unit) }))}
    selectedIds={model.selectedIds} onSelectionChange={onSelectionChange} totalId={totalId}
    caption={`${model.range.end} · ${model.unit.label}`} searchPlaceholder={searchPlaceholder ?? message(messages, "external.money.searchCountries")}
    selectedCount={model.selectedCount} totalCount={model.totalCount} downloadAction={downloadAction} />;
}
