"use client";

import { useEffect } from "react";

/**
 * Marks the page hydrated: the browser tests wait for `body[data-app-ready]`
 * before interacting. Call it after the component's own mount effects (a hash
 * restore, for example) so the flag goes up in the same commit, after them.
 * `clearOnUnmount: false` is the hub's set-only variant.
 */
export function useAppReady({ clearOnUnmount = true }: { clearOnUnmount?: boolean } = {}): void {
  useEffect(() => {
    document.body.dataset.appReady = "true";
    if (!clearOnUnmount) return;
    return () => {
      delete document.body.dataset.appReady;
    };
  }, [clearOnUnmount]);
}
