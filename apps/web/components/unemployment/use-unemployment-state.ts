"use client";
import { useMemo } from "react";
import type { ClientUnemploymentObservation, UnemploymentGroupDefinition } from "../../lib/data/unemployment/types";
import { parseUnemploymentHash, serializeUnemploymentHash } from "../../lib/explorer/unemploymentState";
import type { UnemploymentSectionId } from "../../lib/explorer/unemploymentSections";
import { useHashState } from "../explorer-shell/use-hash-state";

type UnemploymentHashData = { facts: ClientUnemploymentObservation[]; registry: UnemploymentGroupDefinition[]; section: UnemploymentSectionId; regionId?: string };

const parse = (hash: string, data: UnemploymentHashData) => parseUnemploymentHash(hash, data.facts, data.registry, data.section, data.regionId);

export function useUnemploymentState(facts: ClientUnemploymentObservation[], registry: UnemploymentGroupDefinition[], section: UnemploymentSectionId, regionId?: string) {
  const data = useMemo(() => ({ facts, registry, section, regionId }), [facts, registry, section, regionId]);
  return useHashState(data, parse, serializeUnemploymentHash);
}
