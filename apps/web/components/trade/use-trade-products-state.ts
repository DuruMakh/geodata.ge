"use client";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { parseTradeProductsHash, serializeTradeProductsHash, tradeProductsCoverage } from "../../lib/explorer/tradeProductsState";
import { refitRange } from "../../lib/explorer/periodRange";
import { useHashState, type HashStateOptions } from "../explorer-shell/use-hash-state";

// A change refits the years to the new selection and clears a restored link's reset notice. Inside Domestic exports,
// each change tells the page which hash to keep for its Products section.
const OPTIONS: HashStateOptions<ClientTradeProductsData, ReturnType<typeof parseTradeProductsHash>> = {
  normalize: (changed, data) => ({ ...changed, range: refitRange(changed.range, tradeProductsCoverage(data, changed), { collapseToAll: true }), selectionReset: false }),
  afterWrite: data => { if (data.measures) window.dispatchEvent(new Event("trade-domestic-state")); },
};

export function useTradeProductsState(data: ClientTradeProductsData) {
  const { state, update } = useHashState(data, parseTradeProductsHash, serializeTradeProductsHash, OPTIONS);
  return { state, selectionReset: state.selectionReset, update };
}
