"use client";
import { useState, type ReactNode } from "react";
import type { ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { tradePartnerColor, type TradePartnersModel } from "../../lib/explorer/tradePartners";
import { TRADE_PARTNER_TOTAL_ID, tradePartnersBulkSelection, type TradePartnersState, type TradePartnersTab } from "../../lib/explorer/tradePartnersState";
import { formatInUnit } from "../../lib/explorer/format";
import { publicLabel } from "../../lib/i18n/labels";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { TabDivider, TextTab } from "../ui/editorial";

export function TradePartnersSeriesPanel({ data, state, model, onTabChange, onSelectionChange, downloadAction }: { data: ClientTradePartnersData; state: TradePartnersState; model: TradePartnersModel; onTabChange: (tab: TradePartnersTab) => void; onSelectionChange: (ids: string[]) => void; downloadAction: ReactNode }) {
  const [query, setQuery] = useState("");
  const { locale, englishLabels, messages } = useI18n();
  const t = (key: string) => message(messages, `trade.partners.${key}`);
  const label = (entity: (typeof data.entities)[number]) => publicLabel(locale, entity.id, entity.labelKa, englishLabels);
  const visible = model.activeEntities.filter(entity => matchesLabelQuery(query, [label(entity), entity.sourceCode ?? ""]));
  const toggle = (id: string) => onSelectionChange(state.selectedIds.includes(id) ? state.selectedIds.filter(selected => selected !== id) : [...state.selectedIds, id]);
  const row = (id: string, text: string) => <SeriesSelectorRow key={id} id={id} label={text} color={tradePartnerColor(id)} value={formatInUnit(model.valuesByEntity[id][model.range.end], model.unit)} selected={model.selectedIds.includes(id)} level={id === TRADE_PARTNER_TOTAL_ID ? "total" : "item"} wrapLabel onToggle={() => toggle(id)} />;
  return <>
    <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {model.unit.label}</p>
    <SeriesSelector controls={<div role="group" aria-label={t("browse")} className="flex items-center gap-3"><TextTab label={t("countries")} active={state.tab === "countries"} onClick={() => onTabChange("countries")} testId="trade-partners-tab-countries" /><TabDivider /><TextTab label={t("groups")} active={state.tab === "groups"} onClick={() => onTabChange("groups")} testId="trade-partners-tab-groups" /></div>}
      query={query} onQueryChange={setQuery} searchPlaceholder={t(state.tab === "countries" ? "searchCountries" : "searchGroups")} selectedCount={model.selectedCount} totalCount={model.totalCount} hasSelection={model.selectedCount > 0} allSelected={model.selectedCount === model.totalCount} onToggleAll={() => onSelectionChange(model.selectedCount ? [] : tradePartnersBulkSelection(data))} hasVisibleMatches={visible.length > 0}>
      {row(TRADE_PARTNER_TOTAL_ID, t("total"))}
      {model.offTabSelected.length ? <div data-testid="trade-partners-off-tab"><p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{t(state.tab === "countries" ? "selectedGroups" : "selectedCountries")}</p>{model.offTabSelected.map(entity => row(entity.id, label(entity)))}</div> : null}
      {visible.map(entity => row(entity.id, label(entity)))}
    </SeriesSelector>
    <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("bulkScope")}</p>
    {downloadAction}
  </>;
}
