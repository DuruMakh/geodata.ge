"use client";
import { useMemo } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import type { ClientSectorObservation } from "../../lib/servedRows";
import {
  DEFAULT_SECTOR_STATE,
  changeSectorMeasure,
  parseSectorHash,
  serializeSectorHash,
  type SectorState,
} from "../../lib/explorer/economicSectors";
import { useHashState, type HashStateOptions } from "../explorer-shell/use-hash-state";

type SectorHashData = { facts: ClientSectorObservation[]; registry: SectorDefinition[] };

function parse(hash: string, data: SectorHashData): SectorState {
  const parsed = parseSectorHash(hash, data.registry.map((r) => r.id));
  return changeSectorMeasure(parsed, parsed.measure, data.facts);
}

// The server HTML keeps the default view; the hash (and the measure's own range) is applied after mount.
const OPTIONS: HashStateOptions<SectorHashData, SectorState> = { initial: DEFAULT_SECTOR_STATE };

// Only a discrete switch earns a Back step (callers pass "push"). A range drag fires once per
// year crossed and must replace the entry, or Back would replay the drag.
export function useEconomicSectorsState(
  facts: ClientSectorObservation[],
  registry: SectorDefinition[],
) {
  const data = useMemo(() => ({ facts, registry }), [facts, registry]);
  return useHashState(data, parse, serializeSectorHash, OPTIONS);
}
