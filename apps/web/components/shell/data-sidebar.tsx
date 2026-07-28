"use client";

import Link from "next/link";
import { ComingSoonBadge } from "../ui/editorial";
import { SectionNav } from "./section-nav";

// Platform sidebar (DESIGN.md §6.7). GeoData is a data platform whose first
// dataset is the budget; the teaser rows are markers only — no data, no routes.

const TEASERS = ["უმუშევრობა", "ინფლაცია", "ეკონომიკური ზრდა", "დემოგრაფია"];

export function DataSidebar() {
  return (
    <aside
      data-testid="data-sidebar"
      className="flex w-[232px] flex-none flex-col bg-[var(--ink)] px-4 pt-[18px] pb-4 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-screen"
    >
      <Link href="/" className="flex flex-col gap-0.5 no-underline">
        <span className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--paper)]">GeoData</span>
        <span className="font-[family-name:var(--font-numeric)] text-[8.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]">
          ღია მონაცემები
        </span>
      </Link>

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
    </aside>
  );
}
