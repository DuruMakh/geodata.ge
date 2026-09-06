"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export function SiteNavigation({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 900px)");
    const close = () => setOpen(false);
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        style={{ minWidth: 96 }}
        className="flex min-h-11 items-center justify-center justify-self-end gap-2 px-2 text-[13px] font-medium text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 min-[900px]:hidden"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d={open ? "M6 6l12 12M6 18L18 6" : "M3 6h18M3 12h18M3 18h18"} />
        </svg>
        {label}
      </button>
      <div
        id={panelId}
        onKeyDown={handleKeyDown}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`${open ? "grid" : "hidden"} col-span-2 border-t border-[var(--hairline)] pt-2 min-[900px]:contents`}
      >
        {children}
      </div>
    </>
  );
}
