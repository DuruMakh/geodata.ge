"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import type { ClientSectorObservation } from "../../lib/servedRows";
import {
  DEFAULT_SECTOR_STATE,
  changeSectorMeasure,
  parseSectorHash,
  serializeSectorHash,
  type SectorState,
} from "../../lib/explorer/economicSectors";
import { useAppReady } from "../explorer-shell/use-app-ready";

export function useEconomicSectorsState(
  facts: ClientSectorObservation[],
  registry: SectorDefinition[],
) {
  const [state, setState] = useState<SectorState>(DEFAULT_SECTOR_STATE);
  const current = useRef(state);
  useEffect(() => {
    function restore() {
      const parsed = parseSectorHash(
        window.location.hash,
        registry.map((r) => r.id),
      );
      const next = changeSectorMeasure(parsed, parsed.measure, facts);
      current.current = next;
      setState(next);
    }
    restore();
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, [facts, registry]);
  useAppReady();
  const update = useCallback(
    (change: (previous: SectorState) => SectorState, historyMode: "push" | "replace" = "replace") => {
      const next = change(current.current);
      current.current = next;
      const hash = `#${serializeSectorHash(next)}`;
      if (window.location.hash !== hash) {
        try {
          // Only a discrete switch earns a Back step. A range drag fires once per
          // year crossed and must replace the entry, or Back would replay the drag.
          if (historyMode === "push") window.history.pushState(null, "", hash);
          else window.history.replaceState(null, "", hash);
        } catch {
          // History can be unavailable in some embedded contexts; the UI still works.
        }
      }
      setState(next);
      return next;
    },
    [],
  );
  return { state, update };
}
