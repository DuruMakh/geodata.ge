"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppReady } from "./use-app-ready";

export type HashStateOptions<D, S> = {
  /** Applied to every change made through `update`, never to a restored hash (so a restored notice flag survives). */
  normalize?: (next: S, data: D) => S;
  /** Runs after each `update` has written the hash, e.g. to tell a surrounding page that the view moved. */
  afterWrite?: (data: D) => void;
};

const NO_OPTIONS = {};

/**
 * A page view kept in the URL hash: restored on load, on Back/Forward and on hash changes, and written on every change
 * (`push` adds a history entry, otherwise the entry is replaced). `data`, `parse`, `serialize` and `options` must be
 * stable references: module-level functions and constants, or memoised values.
 */
export function useHashState<D, S>(data: D, parse: (hash: string, data: D) => S, serialize: (state: S, data: D) => string, options: HashStateOptions<D, S> = NO_OPTIONS) {
  const [state, setState] = useState(() => parse("", data));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parse(window.location.hash, data); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [data, parse]);
  useAppReady();
  const { normalize, afterWrite } = options;
  const update = useCallback((change: (previous: S) => S, push = false) => {
    const changed = change(current.current);
    const next = normalize ? normalize(changed, data) : changed; current.current = next;
    const hash = `#${serialize(next, data)}`;
    if (window.location.hash !== hash) {
      try { if (push) window.history.pushState(null, "", hash); else window.history.replaceState(null, "", hash); }
      catch { /* Embedded contexts may deny History access; the view still updates. */ }
    }
    setState(next);
    afterWrite?.(data);
  }, [data, serialize, normalize, afterWrite]);
  return { state, update };
}
