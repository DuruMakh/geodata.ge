"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ALL_DATA_PATH } from "../../lib/navigation/navTree";
import { focusExplorerSearch } from "../explorer-groups/explorer-search-focus";

/** All data with its search box focused: the sidebar's search link and the `/` key (spec 2026-10-24-explorer-regroup §4). */
export const SEARCH_PATH = `${ALL_DATA_PATH}#q=`;

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select") !== null);
}

/**
 * `/` opens the search from any explorer page, except while typing in a field. On All data, which already shows the
 * box, `focusHere` focuses it and returns `true`; elsewhere it returns `false` and the key opens All data.
 */
export function useSlashSearch(focusHere: () => boolean = focusExplorerSearch) {
  const router = useRouter();
  const { locale } = useI18n();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
      event.preventDefault();
      if (!focusHere()) router.push(pageHref(SEARCH_PATH, locale));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusHere, router, locale]);
}
