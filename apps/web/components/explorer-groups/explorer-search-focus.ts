// The All data search box's id, and a way to focus it from elsewhere on the page. A Next Link to `/explorer#q=` from
// /explorer itself changes the address with `pushState`, which fires no `hashchange`, so the page cannot see it: the link (the
// sidebar's search) or the `/` key calls `focusExplorerSearch()` instead.

export const EXPLORER_SEARCH_INPUT_ID = "explorer-q";

/** Focuses the All data search box when the page shows it; `false` on any other page. */
export function focusExplorerSearch(): boolean {
  const input = document.getElementById(EXPLORER_SEARCH_INPUT_ID);
  if (!(input instanceof HTMLInputElement)) return false;
  input.focus();
  return true;
}
