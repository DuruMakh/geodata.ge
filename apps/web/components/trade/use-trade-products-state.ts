"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { parseTradeProductsHash, serializeTradeProductsHash, type TradeProductsState } from "../../lib/explorer/tradeProductsState";
import { useAppReady } from "../explorer-shell/use-app-ready";

export function useTradeProductsState(data: ClientTradeProductsData) {
  const [restored, setRestored] = useState(() => parseTradeProductsHash("", data));
  const current = useRef(restored);
  useEffect(() => {
    function restore() { const next = parseTradeProductsHash(window.location.hash, data); current.current = next; setRestored(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [data]);
  useAppReady();
  const update = useCallback((change: (previous: TradeProductsState) => TradeProductsState, push = false) => {
    const next = { ...change(current.current), selectionReset: false }; current.current = next;
    const hash = `#${serializeTradeProductsHash(next, data)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the comparison still updates. */ }
    }
    setRestored(next);
  }, [data]);
  return { state: restored, selectionReset: restored.selectionReset, update };
}
