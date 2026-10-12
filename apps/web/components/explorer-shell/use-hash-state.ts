"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppReady } from "./use-app-ready";

export type HashStateOptions<D, S> = {
  /** Applied to every change made through `update`, never to a restored hash (so a restored notice flag survives). */
  normalize?: (next: S, data: D) => S;
  /** Runs after each `update` has written the hash, e.g. to tell a surrounding page that the view moved. */
  afterWrite?: (data: D) => void;
  /** The first render's state (the server HTML) instead of `parse("", data)`. */
  initial?: S;
};

export type HistoryMode = "push" | "replace";

/** Writes `hash` to the address bar: `push` adds a history entry, `replace` rewrites the current one. A hash that is already current writes nothing. */
export function writeHash(hash: string, mode: HistoryMode, target: Pick<Window, "location" | "history"> = window): void {
  if (target.location.hash === hash) return;
  try { if (mode === "push") target.history.pushState(null, "", hash); else target.history.replaceState(null, "", hash); }
  catch { /* Embedded contexts may deny History access; the view still updates. */ }
}

const NO_OPTIONS = {};

/**
 * A page view kept in the URL hash: restored on load, on Back/Forward and on hash changes, and written on every change
 * (`push` adds a history entry, otherwise the entry is replaced). `data`, `parse`, `serialize` and `options` must be
 * stable references: module-level functions and constants, or memoised values.
 */
export function useHashState<D, S>(data: D, parse: (hash: string, data: D) => S, serialize: (state: S, data: D) => string, options: HashStateOptions<D, S> = NO_OPTIONS) {
  const [state, setState] = useState(() => ("initial" in options ? options.initial as S : parse("", data)));
  const current = useRef(state);
  useEffect(() => {
    function restore() { const next = parse(window.location.hash, data); current.current = next; setState(next); }
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, [data, parse]);
  useAppReady();
  const { normalize, afterWrite } = options;
  const update = useCallback((change: (previous: S) => S, history: boolean | HistoryMode = false): S => {
    const changed = change(current.current);
    const next = normalize ? normalize(changed, data) : changed; current.current = next;
    const hash = `#${serialize(next, data)}`;
    writeHash(hash, history === true || history === "push" ? "push" : "replace");
    setState(next);
    afterWrite?.(data);
    return next;
  }, [data, serialize, normalize, afterWrite]);
  return { state, update };
}
