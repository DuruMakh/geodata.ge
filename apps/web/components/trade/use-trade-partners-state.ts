"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { parseTradePartnersHash, serializeTradePartnersHash, type TradePartnersState } from "../../lib/explorer/tradePartnersState";
import { useAppReady } from "../explorer-shell/use-app-ready";

export function useTradePartnersState(data: ClientTradePartnersData) {
  const [state, setState] = useState(() => parseTradePartnersHash("", data));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parseTradePartnersHash(window.location.hash, data); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [data]);
  useAppReady();
  const update = useCallback((change: (previous: TradePartnersState) => TradePartnersState, push = false) => {
    const next = change(current.current); current.current = next;
    const hash = `#${serializeTradePartnersHash(next)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the view still updates. */ }
    }
    setState(next);
  }, []);
  return { state, update };
}
