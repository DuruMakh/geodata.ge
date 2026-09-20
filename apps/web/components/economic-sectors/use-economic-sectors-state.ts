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
    document.body.dataset.appReady = "true";
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      delete document.body.dataset.appReady;
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, [facts, registry]);
  const update = useCallback(
    (change: (previous: SectorState) => SectorState) => {
      const next = change(current.current);
      current.current = next;
      const hash = `#${serializeSectorHash(next)}`;
      if (window.location.hash !== hash)
        window.history.pushState(null, "", hash);
      setState(next);
    },
    [],
  );
  return { state, update };
}
