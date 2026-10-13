"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref, splitLanguagePath } from "../../lib/i18n/routes";
import { ComingSoonBadge } from "../ui/coming-soon-badge";
import { BUDGET_SECTIONS, BUDGET_SECTION_ORDER } from "../../lib/explorer/sections";
import { isActivePath } from "../../lib/navigation/navTree";

// Budget sections, nested under ბიუჯეტი in the sidebar (DESIGN.md §6.7).
// Order and labels come from lib/explorer/sections.ts, which the hub cards read
// too. Its rows are SidebarSectionLink, the row every other hub's pages use in
// data-sidebar.tsx, which is the only importer of this file.

export function SectionNav() {
  const { locale, messages } = useI18n();
  const { pathname } = splitLanguagePath(usePathname());

  return (
    <ul className="mt-0.5 flex list-none flex-col gap-px pl-[18px]">
      {BUDGET_SECTION_ORDER.map((id) => {
        const section = BUDGET_SECTIONS[id];
        const label = message(messages, `common.${id}`);
        if (section.href === null) {
          // No aria-disabled: the listitem role ignores it (jsx-a11y flags it),
          // and the ComingSoonBadge text already reads out to assistive tech.
          return (
            <li
              key={id}
              className="flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] text-[var(--ink-fg-muted)]"
            >
              {/* Same padding and transparent ▸ spacer the link rows carry, so
                  this row's label sits on their column (DESIGN.md §6.7). */}
              <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[9px] text-transparent">
                ▸
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <ComingSoonBadge label={message(messages, "common.comingSoon")} />
            </li>
          );
        }

        // Municipalities has child routes (a municipality or region sub-page); the
        // navigation tree's one rule keeps its row active on them.
        return (
          <li key={id}>
            <SidebarSectionLink
              href={pageHref(section.href, locale)}
              testId={`section-link-${section.href.split("/").at(-1)}`}
              label={label}
              active={isActivePath(pathname, section.href)}
              current={pathname === section.href}
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One sidebar row under a dataset: Budget's sections here and every other hub's pages in DataSidebar. `active`
 * highlights it and marks it current for assistive tech (on its page and the pages below it); `current`, on its own
 * page only, stops a click from reloading that page. `indented` is for rows that are not inside this list's padding.
 */
export function SidebarSectionLink({ href, testId, label, active, current, indented = false }: { href: string; testId?: string; label: string; active: boolean; current: boolean; indented?: boolean }) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      onNavigate={(event) => {
        if (current) event.preventDefault();
      }}
      className={`${indented ? "ml-[18px] " : ""}flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${
        active
          ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]"
          : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"
      }`}
    >
      <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${active ? "text-[var(--accent)]" : "text-transparent"}`}>
        ▸
      </span>
      {label}
    </Link>
  );
}
