"use client";
import type { MouseEvent } from "react";

/**
 * The first stop on every page (WCAG 2.4.1): hidden until it has keyboard focus, it moves focus to the
 * page's `#content`. Without JavaScript the browser follows the fragment; with it, focus moves without
 * touching the URL, because explorer pages keep their view in the hash.
 */
export function SkipLink({ label }: { label: string }) {
  function skip(event: MouseEvent<HTMLAnchorElement>) {
    const content = document.getElementById("content");
    if (!content) return;
    event.preventDefault();
    content.focus();
  }
  return (
    <a
      href="#content"
      onClick={skip}
      className="sr-only text-[13px] font-semibold text-[var(--ink)] underline underline-offset-4 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:bg-[var(--paper)] focus:px-4"
    >
      {label}
    </a>
  );
}
