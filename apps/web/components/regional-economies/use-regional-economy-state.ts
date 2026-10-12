"use client";

import { useMemo } from "react";
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
import { useHashState, type HashStateOptions } from "../explorer-shell/use-hash-state";

type RegionalEconomyHashData = { facts: ClientRegionalEconomyObservation[]; registry: SectorDefinition[] };

function parse(hash: string, data: RegionalEconomyHashData): RegionalEconomyState {
  const parsed = parseRegionalEconomyHash(
    hash,
    regionalEconomyDefinitions(data.registry).map((definition) => definition.id),
  );
  return changeRegionalEconomyMeasure(parsed, parsed.measure, data.facts);
}

// The server HTML keeps the default view; the hash (and the measure's own range) is applied after mount.
const OPTIONS: HashStateOptions<RegionalEconomyHashData, RegionalEconomyState> = { initial: DEFAULT_REGIONAL_ECONOMY_STATE };

export function useRegionalEconomyState(
  facts: ClientRegionalEconomyObservation[],
  registry: SectorDefinition[],
) {
  const data = useMemo(() => ({ facts, registry }), [facts, registry]);
  return useHashState(data, parse, serializeRegionalEconomyHash, OPTIONS);
}
