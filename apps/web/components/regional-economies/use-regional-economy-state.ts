"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import {
  DEFAULT_REGIONAL_ECONOMY_STATE,
  changeRegionalEconomyMeasure,
  parseRegionalEconomyHash,
  regionalEconomyDefinitions,
  serializeRegionalEconomyHash,
  type RegionalEconomyState,
} from "../../lib/explorer/regionalEconomies";
import type { ClientRegionalEconomyObservation } from "../../lib/servedRows";

export function useRegionalEconomyState(
  facts: ClientRegionalEconomyObservation[],
  registry: SectorDefinition[],
) {
  const [state, setState] = useState<RegionalEconomyState>(DEFAULT_REGIONAL_ECONOMY_STATE);
  const current = useRef(state);
  useEffect(() => {
    function restore() {
      const parsed = parseRegionalEconomyHash(
        window.location.hash,
        regionalEconomyDefinitions(registry).map((definition) => definition.id),
      );
      const next = changeRegionalEconomyMeasure(parsed, parsed.measure, facts);
      current.current = next;
      setState(next);
    }
    restore();
    document.body.dataset.appReady = "true";
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      delete document.body.dataset.appReady;
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, [facts, registry]);
  const update = useCallback((change: (previous: RegionalEconomyState) => RegionalEconomyState) => {
    const next = change(current.current);
    current.current = next;
    const hash = `#${serializeRegionalEconomyHash(next)}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    setState(next);
  }, []);
  return { state, update };
}
