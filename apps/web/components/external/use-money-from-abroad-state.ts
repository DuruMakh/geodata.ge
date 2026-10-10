"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { parseMoneyTransfersHash, serializeMoneyTransfersHash, type MoneyTransfersState } from "../../lib/explorer/moneyTransfersState";
import { useAppReady } from "../explorer-shell/use-app-ready";

export function useMoneyFromAbroadState(data: ClientMoneyTransfersData) {
  const [state, setState] = useState(() => parseMoneyTransfersHash("", data));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parseMoneyTransfersHash(window.location.hash, data); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [data]);
  useAppReady();
  const update = useCallback((change: (previous: MoneyTransfersState) => MoneyTransfersState, push = false) => {
    const next = change(current.current); current.current = next;
    const hash = `#${serializeMoneyTransfersHash(next)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the view still updates. */ }
    }
    setState(next);
  }, []);
  return { state, update };
}
