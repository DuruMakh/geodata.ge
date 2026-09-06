"use client";

import { useState } from "react";

/**
 * Copy a short piece of text the page also renders as selectable text.
 *
 * The value is always visible beside the button, so the page still works if
 * the clipboard API is unavailable or refused - copying is a convenience,
 * never the only way to get the text. That invariant is why the failure path
 * below does nothing: there is no state to recover and nothing to report.
 */
export function CopyEndpoint({
  endpoint,
  testId = "connect-copy",
  copyLabel = "მისამართის კოპირება",
  copiedLabel = "მისამართი დაკოპირდა",
  copyText = "კოპირება",
  copiedText = "დაკოპირდა",
}: {
  endpoint: string;
  testId?: string;
  copyLabel?: string;
  copiedLabel?: string;
  copyText?: string;
  copiedText?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      {/* A button's own name changing while it holds focus is announced
          inconsistently across screen readers, so the confirmation gets its own
          live region rather than relying on the label flip alone. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
      <button
        type="button"
        data-testid={testId}
        aria-label={copied ? copiedLabel : copyLabel}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(endpoint);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard refused or unavailable; the text is visible next to
            // this button.
          }
        }}
        className="inline-flex min-h-9 shrink-0 items-center gap-2 border border-[var(--control)] px-3 py-1.5 font-[family-name:var(--font-numeric)] text-[11px] uppercase tracking-[0.04em] text-[var(--muted)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {copied ? copiedText : copyText}
      </button>
    </>
  );
}
