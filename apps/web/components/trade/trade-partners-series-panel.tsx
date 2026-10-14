"use client";
import { useState, type ReactNode } from "react";
import type { ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { TRADE_PARTNER_SEARCH_ALIASES } from "../../lib/data/tradePartners/types";
import { tradePartnerColor, type TradePartnersModel } from "../../lib/explorer/tradePartners";
import { tradePartnersTotalId, tradePartnersBulkSelection, type TradePartnersState, type TradePartnersTab } from "../../lib/explorer/tradePartnersState";
import { formatInUnit } from "../../lib/explorer/format";
import { publicLabel } from "../../lib/i18n/labels";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { LONG_LIST_ROWS, SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { TabDivider, TextTab } from "../ui/editorial";
import { toggleId } from "../../lib/explorer/selection";

export function TradePartnersSeriesPanel({ data, state, model, onTabChange, onSelectionChange, measureControls, downloadAction }: { data: ClientTradePartnersData; state: TradePartnersState; model: TradePartnersModel; onTabChange: (tab: TradePartnersTab) => void; onSelectionChange: (ids: string[]) => void; measureControls?: ReactNode; downloadAction: ReactNode }) {
  const services = data.dataset === "services", embedded = services || Boolean(data.measures), totalId = tradePartnersTotalId(data);
  const [query, setQuery] = useState("");
  const { locale, englishLabels, messages } = useI18n();
  const t = (key: string) => message(messages, `trade.partners.${key}`);
  const label = (entity: (typeof data.entities)[number]) => publicLabel(locale, entity.id, entity.labelKa, englishLabels);
  // Both languages in either UI, Geostat's partner code and a few common names (U21-06); services have no code.
  const visible = model.activeEntities.filter(entity => matchesLabelQuery(query, [entity.labelKa, publicLabel("en", entity.id, entity.labelKa, englishLabels), entity.sourceCode ?? "", ...(entity.sourceCode ? TRADE_PARTNER_SEARCH_ALIASES[entity.sourceCode] ?? [] : [])]));
  const toggle = (id: string) => onSelectionChange(toggleId(state.selectedIds, id));
  // The 218 partners (187 domestic-export countries) scroll inside the panel, with Excel above them (U21-01, U21-05).
  const long = data.entities.length > LONG_LIST_ROWS;
  // Only the active tab's own list gets the scroller and the skip button: the Groups tab's few rows need neither.
  const longList = model.activeEntities.length > LONG_LIST_ROWS;
  const row = (id: string, text: string) => <SeriesSelectorRow key={id} id={id} label={text} color={tradePartnerColor(id)} value={formatInUnit(model.valuesByEntity[id][model.range.end], model.unit)} selected={model.selectedIds.includes(id)} level={id === totalId ? "total" : "item"} wrapLabel onToggle={() => toggle(id)} />;
  return <>
    <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {model.unit.label}</p>
    {long ? <div className="-mt-[18px] mb-1">{downloadAction}</div> : null}
    <SeriesSelector controls={embedded ? measureControls : <div role="group" aria-label={t("browse")} className="flex items-center gap-3"><TextTab label={t("countries")} active={state.tab === "countries"} onClick={() => onTabChange("countries")} testId="trade-partners-tab-countries" /><TabDivider /><TextTab label={t("groups")} active={state.tab === "groups"} onClick={() => onTabChange("groups")} testId="trade-partners-tab-groups" /></div>} controlsAfterSearch={embedded} listLayout={longList ? "scroll" : "aside"}
      query={query} onQueryChange={setQuery} searchPlaceholder={services ? message(messages, "trade.services.searchTypes") : t(state.tab === "countries" ? "searchCountries" : "searchGroups")} selectedCount={model.selectedCount} totalCount={model.totalCount} hasSelection={model.selectedCount > 0} allSelected={model.selectedCount === model.totalCount} onToggleAll={() => onSelectionChange(model.selectedCount ? [] : tradePartnersBulkSelection(data))} hasVisibleMatches={visible.length > 0}>
      {row(totalId, services ? message(messages, "trade.services.total") : t("total"))}
      {model.offTabSelected.length ? <div data-testid="trade-partners-off-tab"><p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{t(state.tab === "countries" ? "selectedGroups" : "selectedCountries")}</p>{model.offTabSelected.map(entity => row(entity.id, label(entity)))}</div> : null}
      {visible.map(entity => row(entity.id, label(entity)))}
    </SeriesSelector>
    <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{services ? message(messages, "trade.services.bulkScope") : data.measures ? message(messages, "trade.domestic.countryBulkScope") : t("bulkScope")}</p>
    {long ? null : downloadAction}
  </>;
}
