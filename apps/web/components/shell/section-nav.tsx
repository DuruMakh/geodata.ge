"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComingSoonBadge } from "../ui/editorial";
import { BUDGET_SECTIONS, BUDGET_SECTION_ORDER } from "../../lib/explorer/sections";

// Budget sections, nested under ბიუჯეტი in the sidebar (DESIGN.md §6.7).
// Order and labels come from lib/explorer/sections.ts, which the hub cards read
// too. Deleting this component and its single usage in data-sidebar.tsx reverts
// navigation to hub-and-breadcrumb only. Nothing else imports it.

export function SectionNav() {
  const pathname = usePathname();

  return (
    <ul className="mt-0.5 flex list-none flex-col gap-px pl-[18px]">
      {BUDGET_SECTION_ORDER.map((id) => {
        const section = BUDGET_SECTIONS[id];
        if (section.href === null) {
          // No aria-disabled: the listitem role ignores it (jsx-a11y flags it),
          // and the ComingSoonBadge text already reads out to assistive tech.
          return (
            <li
              key={section.label}
              className="flex items-baseline gap-2 py-[5px] pr-2 pl-2 text-[12px] text-[var(--ink-fg-muted)]"
            >
              {/* Same padding and transparent ▸ spacer the link rows carry, so
                  this row's label sits on their column (DESIGN.md §6.7). */}
              <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[9px] text-transparent">
                ▸
              </span>
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
              <ComingSoonBadge />
            </li>
          );
        }

        // Municipalities is the first section with child routes (a municipality
        // or region sub-page), so an exact match alone would leave the sidebar
        // blank on all of them. `${section.href}/` guards the prefix so a
        // sibling route that merely starts with the same string cannot match.
        const active = pathname === section.href || pathname.startsWith(`${section.href}/`);

        return (
          <li key={section.label}>
            <Link
              href={section.href}
              data-testid={`section-link-${section.href.split("/").at(-1)}`}
              aria-current={active ? "page" : undefined}
              className={`flex items-baseline gap-2 py-[5px] pr-2 pl-2 text-[12px] no-underline transition-colors duration-150 ${
                active
                  ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]"
                  : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"
              }`}
            >
              <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${active ? "text-[var(--accent)]" : "text-transparent"}`}>
                ▸
              </span>
              {section.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
