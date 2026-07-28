"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ComingSoonBadge } from "../ui/editorial";
import { SectionNav } from "./section-nav";

// Platform sidebar (DESIGN.md §6.7). Two desktop states — 232px expanded and a
// 52px reading rail — plus a top bar with a sheet below 900px. GeoData is a data
// platform whose first dataset is the budget; teaser rows are markers only.

const TEASERS = ["უმუშევრობა", "ინფლაცია", "ეკონომიკური ზრდა", "დემოგრაფია"];
const STORAGE_KEY = "geodata:sidebar-collapsed";
const DESKTOP_MIN_WIDTH = 900;

export function DataSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Read after mount: the server render cannot see localStorage, and guessing
  // would flash the wrong width on every load.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSheetOpen(false);
      // Escape usually arrives with focus on a link inside the sheet, which is
      // about to become display:none — hand focus back rather than drop it.
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Collapse is a desktop posture. A preference set on a laptop must not follow
  // the user to a phone, where it would render as a mystery-narrow rail.
  const railed = collapsed && isDesktop;
  // One control, two jobs, so "expanded" means different things by width: the
  // rail on desktop, the sheet on mobile. The label, the glyph and aria-expanded
  // must all describe whichever one the next click will change.
  const navVisible = isDesktop ? !railed : sheetOpen;

  function handleToggle() {
    if (!isDesktop) {
      setSheetOpen((open) => !open);
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Private-mode storage denials must not break the toggle itself.
    }
  }

  return (
    <aside
      data-testid="data-sidebar"
      data-collapsed={railed ? "true" : "false"}
      className={`flex w-full flex-none flex-col bg-[var(--ink)] px-4 pt-[18px] pb-4 transition-[width] duration-150 ease-in-out min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-screen ${
        railed ? "min-[900px]:w-[52px] min-[900px]:px-3" : "min-[900px]:w-[232px]"
      }`}
    >
      <div className="flex items-center justify-between gap-2.5">
        {railed ? null : (
          <Link href="/" className="flex flex-col gap-0.5 no-underline">
            <span className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--paper)]">GeoData</span>
            <span className="font-[family-name:var(--font-numeric)] text-[8.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]">
              ღია მონაცემები
            </span>
          </Link>
        )}
        <button
          ref={toggleRef}
          type="button"
          data-testid="sidebar-toggle"
          aria-expanded={navVisible}
          aria-label={navVisible ? "პანელის ჩაკეცვა" : "პანელის გაშლა"}
          onClick={handleToggle}
          className="size-[26px] flex-none cursor-pointer rounded-[3px] border border-[rgba(247,242,233,0.18)] font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)] hover:text-[var(--paper)]"
        >
          {navVisible ? "«" : "»"}
        </button>
      </div>

      {railed ? (
        <>
          <p
            className="mt-6 flex-1 font-[family-name:var(--font-numeric)] text-[9.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            მონაცემები · ბიუჯეტი
          </p>
          <Link
            href="/"
            aria-label="მთავარი"
            title="მთავარი"
            className="mt-auto flex size-[26px] items-center justify-center self-center no-underline"
          >
            <span aria-hidden className="size-2 bg-[var(--accent)]" />
          </Link>
        </>
      ) : (
        <div className={sheetOpen ? "flex flex-1 flex-col" : "hidden flex-1 min-[900px]:flex min-[900px]:flex-col"}>
          <div aria-hidden className="mt-4 mb-3.5 h-px bg-[rgba(247,242,233,0.12)]" />
          <p className="mb-3 font-[family-name:var(--font-numeric)] text-[9.5px] tracking-[0.12em] text-[var(--ink-fg-faint)]">
            მონაცემები /
          </p>
          <nav aria-label="მონაცემთა ნაკრებები" className="flex flex-col gap-0.5">
            <p className="flex items-baseline gap-2 border-l-2 border-[var(--accent)] bg-[rgba(247,242,233,0.07)] px-2.5 py-2 text-[12.5px] font-semibold text-[var(--paper)]">
              ბიუჯეტი
            </p>
            <SectionNav />

            {/* No aria-disabled on the rows: the listitem role ignores it (jsx-a11y
                flags it), and the ComingSoonBadge text already reads out. */}
            <ul className="mt-2 flex list-none flex-col gap-0.5">
              {TEASERS.map((label) => (
                <li
                  key={label}
                  className="flex items-baseline gap-2 border-l-2 border-transparent px-2.5 py-2 text-[12.5px] font-medium text-[var(--ink-fg-muted)]"
                >
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <ComingSoonBadge />
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto border-t border-[rgba(247,242,233,0.12)] pt-3">
            <Link href="/" className="text-[11.5px] font-medium text-[var(--faint)] no-underline hover:text-[var(--paper)]">
              ← მთავარი
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
