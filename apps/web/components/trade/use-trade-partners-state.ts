"use client";
import type { ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { parseTradePartnersHash, serializeTradePartnersHash, type TradePartnersState } from "../../lib/explorer/tradePartnersState";
import { useHashState, type HashStateOptions } from "../explorer-shell/use-hash-state";

// Each change tells the surrounding page which hash to keep for its Countries or Service types section.
const OPTIONS: HashStateOptions<ClientTradePartnersData, TradePartnersState> = { afterWrite: data => {
  if (data.dataset === "services") window.dispatchEvent(new Event("trade-services-state"));
  else if (data.measures) window.dispatchEvent(new Event("trade-domestic-state"));
} };

export function useTradePartnersState(data: ClientTradePartnersData) {
  return useHashState(data, parseTradePartnersHash, serializeTradePartnersHash, OPTIONS);
}
