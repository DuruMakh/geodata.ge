"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the URL hash in step with the explorer state (DESIGN.md §6.3): it
 * replaces the history entry, never pushes, and skips its first run. That run
 * carries the state from before the incoming hash was applied, so writing it
 * would clobber a deep link and stamp a pristine URL with the defaults.
 *
 * A page that restores the hash in an effect passes `ready` once it has, so the
 * skipped run is the one that applied the hash.
 */
export function useReplaceHash(hash: string, ready = true): void {
  const written = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!written.current) {
      written.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${hash}`);
    } catch {
      // History can be unavailable in some embedded contexts; the UI still works.
    }
  }, [hash, ready]);
}
