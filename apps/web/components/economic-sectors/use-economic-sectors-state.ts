"use client";
import { useMemo } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import type { ClientSectorObservation } from "../../lib/servedRows";
import {
  SECTORS_PAGE_CONFIG,
  changeSectorMeasure,
  defaultSectorState,
  parseSectorHash,
  serializeSectorHash,
  type SectorPageConfig,
  type SectorState,
} from "../../lib/explorer/economicSectors";
import { useHashState, type HashStateOptions } from "../explorer-shell/use-hash-state";

type SectorHashData = { facts: ClientSectorObservation[]; registry: SectorDefinition[]; config: SectorPageConfig };

function parse(hash: string, data: SectorHashData): SectorState {
  const parsed = parseSectorHash(hash, data.registry.map((r) => r.id), data.config);
  return changeSectorMeasure(parsed, parsed.measure, data.facts, data.config);
}

// Only a discrete switch earns a Back step (callers pass "push"). A range drag fires once per
// year crossed and must replace the entry, or Back would replay the drag.
export function useEconomicSectorsState(
  facts: ClientSectorObservation[],
  registry: SectorDefinition[],
  config: SectorPageConfig = SECTORS_PAGE_CONFIG,
) {
  const data = useMemo(() => ({ facts, registry, config }), [facts, registry, config]);
  // The server HTML keeps the default view; the hash (and the measure's own range) is applied after mount.
  const options = useMemo<HashStateOptions<SectorHashData, SectorState>>(() => ({ initial: defaultSectorState(config) }), [config]);
  return useHashState(data, parse, serializeSectorHash, options);
}
