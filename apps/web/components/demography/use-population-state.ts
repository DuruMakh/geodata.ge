"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_POPULATION_STATE,
  parsePopulationHash,
  serializePopulationHash,
  type PopulationState,
} from "../../lib/explorer/demographyPopulation";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";

/**
 * URL-hash state as DESIGN.md §6.3 sets it (the `inflation-cities.tsx` pattern): the server renders
 * the default, the hash is read once after hydration, loading never writes the URL, and every later
 * change replaces the history entry through the shared `useReplaceHash`.
 */
export function usePopulationState(validIds: readonly string[]) {
  const [state, setState] = useState<PopulationState>(DEFAULT_POPULATION_STATE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(parsePopulationHash(window.location.hash, validIds));
    setReady(true);
  }, [validIds]);
  useAppReady();
  useReplaceHash(serializePopulationHash(state), ready);
  const update = useCallback((change: (previous: PopulationState) => PopulationState) => setState(change), []);
  return { state, update };
}
