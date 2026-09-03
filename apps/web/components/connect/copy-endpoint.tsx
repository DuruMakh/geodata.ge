"use client";

import { useState } from "react";

/**
 * The one interactive control on the connection page: copy the endpoint.
 *
 * The URL is also rendered as selectable text beside it, so the page still
 * works if the clipboard API is unavailable or refused - the copy button is a
 * convenience, never the only way to get the address.
 */
export function CopyEndpoint({ endpoint }: { endpoint: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      {/* A button's own name changing while it holds focus is announced
          inconsistently across screen readers, so the confirmation gets its own
          live region rather than relying on the label flip alone. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "მისამართი დაკოპირდა" : ""}
      </span>
      <button
        type="button"
        data-testid="connect-copy"
        aria-label={copied ? "მისამართი დაკოპირდა" : "მისამართის კოპირება"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(endpoint);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard refused or unavailable. The address is visible next to
            // this button, so there is nothing to recover from and nothing to
            // report.
          }
        }}
        className="inline-flex min-h-9 shrink-0 items-center gap-2 border border-[var(--control)] px-3 py-1.5 font-[family-name:var(--font-numeric)] text-[11px] uppercase tracking-[0.04em] text-[var(--muted)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {copied ? "დაკოპირდა" : "კოპირება"}
      </button>
    </>
  );
}
