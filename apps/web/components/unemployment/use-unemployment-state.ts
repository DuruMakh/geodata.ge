"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientUnemploymentObservation, UnemploymentGroupDefinition } from "../../lib/data/unemployment/types";
import { DEFAULT_UNEMPLOYMENT_STATE, parseUnemploymentHash, serializeUnemploymentHash, type UnemploymentState } from "../../lib/explorer/unemploymentState";
import { useAppReady } from "../explorer-shell/use-app-ready";

export function useUnemploymentState(facts: ClientUnemploymentObservation[], registry: UnemploymentGroupDefinition[]) {
  const [state, setState] = useState<UnemploymentState>(DEFAULT_UNEMPLOYMENT_STATE);
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parseUnemploymentHash(window.location.hash, facts, registry); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [facts, registry]);
  useAppReady();
  const update = useCallback((change: (previous: UnemploymentState) => UnemploymentState, historyMode: "push" | "replace" = "replace") => {
    const next = change(current.current); current.current = next;
    const hash = `#${serializeUnemploymentHash(next)}`;
    if (window.location.hash !== hash) {
      try { if (historyMode === "push") window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts can deny History access; the view still updates. */ }
    }
    setState(next); return next;
  }, []);
  return { state, update };
}
