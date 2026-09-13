"use client";

import { useEffect, useState, type ReactNode } from "react";

/** The button keeps its own accessible name; this repeats it visually. */
export function ControlTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (hovered || focused);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [open]);

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(event) => { if (event.pointerType !== "touch") { setHovered(true); setDismissed(false); } }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={() => setFocused(false)}
      onFocus={(event) => { setFocused(event.target.matches(":focus-visible")); setDismissed(false); }}
      onBlur={() => setFocused(false)}
    >
      {children}
      {open ? (
        <span className="absolute top-full right-0 z-30 w-max max-w-[200px] pt-2">
          <span role="tooltip" className="block rounded-[2px] border border-[var(--control)] bg-[var(--paper)] px-2.5 py-2 text-left font-[family-name:var(--font-ui)] text-xs leading-snug text-[var(--ink)] shadow-sm">
            {label}
          </span>
        </span>
      ) : null}
    </span>
  );
}
