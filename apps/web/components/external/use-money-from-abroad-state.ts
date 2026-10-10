"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { parseMoneyTransfersHash, serializeMoneyTransfersHash } from "../../lib/explorer/moneyTransfersState";
import { useAppReady } from "../explorer-shell/use-app-ready";

export function useMoneyFromAbroadState(data: ClientMoneyTransfersData) {
  return useHashState(data, parseMoneyTransfersHash, serializeMoneyTransfersHash);
}

/** A page view kept in the URL hash; Foreign investment uses it with its own parse and serialize. */
export function useHashState<D, S>(data: D, parse: (hash: string, data: D) => S, serialize: (state: S) => string) {
  const [state, setState] = useState(() => parse("", data));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parse(window.location.hash, data); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [data, parse]);
  useAppReady();
  const update = useCallback((change: (previous: S) => S, push = false) => {
    const next = change(current.current); current.current = next;
    const hash = `#${serialize(next)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the view still updates. */ }
    }
    setState(next);
  }, [serialize]);
  return { state, update };
}
