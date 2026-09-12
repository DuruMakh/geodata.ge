"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

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
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        style={{ minWidth: 44 }}
        className="flex min-h-11 items-center justify-center justify-self-end px-2 text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 min-[900px]:hidden"
      >
        {open ? <X aria-hidden="true" size={18} strokeWidth={1.5} /> : <Menu aria-hidden="true" size={18} strokeWidth={1.5} />}
      </button>
      <div
        id={panelId}
        onKeyDown={handleKeyDown}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`${open ? "grid" : "hidden"} col-span-full border-t border-[var(--hairline)] pt-2 min-[900px]:contents`}
      >
        {children}
      </div>
    </>
  );
}
