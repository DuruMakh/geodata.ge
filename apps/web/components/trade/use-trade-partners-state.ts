"use client";
import type { ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { parseTradePartnersHash, serializeTradePartnersHash, type TradePartnersState } from "../../lib/explorer/tradePartnersState";
import { useHashState, type HashStateOptions } from "../explorer-shell/use-hash-state";

// Inside Domestic exports, each change tells the page which hash to keep for its Countries section.
const OPTIONS: HashStateOptions<ClientTradePartnersData, TradePartnersState> = { afterWrite: data => { if (data.measures) window.dispatchEvent(new Event("trade-domestic-state")); } };

export function useTradePartnersState(data: ClientTradePartnersData) {
  return useHashState(data, parseTradePartnersHash, serializeTradePartnersHash, OPTIONS);
}
