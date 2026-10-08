"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientUnemploymentObservation, UnemploymentGroupDefinition } from "../../lib/data/unemployment/types";
import { parseUnemploymentHash, serializeUnemploymentHash, type UnemploymentState } from "../../lib/explorer/unemploymentState";
import type { UnemploymentSectionId } from "../../lib/explorer/unemploymentSections";
import { useAppReady } from "../explorer-shell/use-app-ready";

export function useUnemploymentState(facts: ClientUnemploymentObservation[], registry: UnemploymentGroupDefinition[], section: UnemploymentSectionId, regionId?: string) {
  const [state, setState] = useState<UnemploymentState>(() => parseUnemploymentHash("", facts, registry, section, regionId));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parseUnemploymentHash(window.location.hash, facts, registry, section, regionId); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [facts, registry, section, regionId]);
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
