"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppReady } from "./use-app-ready";

/**
 * An explorer's state, kept in the URL hash. The state is read from the hash after mount and again on back,
 * forward and hash changes; `update` writes it back, pushing a history entry when `push` is set and otherwise
 * replacing the current one. `parse` and `serialize` must be stable (`useCallback`), since a new `parse`
 * re-reads the hash. The app-ready flag goes up after the first restore.
 */
export function useHashExplorerState<State>(parse: (hash: string) => State, serialize: (state: State) => string) {
  const [state, setState] = useState(() => parse(""));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parse(window.location.hash); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [parse]);
  useAppReady();
  const update = useCallback((change: (previous: State) => State, push = false) => {
    const next = change(current.current); current.current = next;
    const hash = `#${serialize(next)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the view still updates. */ }
    }
    setState(next);
  }, [serialize]);
  return { state, update };
}
