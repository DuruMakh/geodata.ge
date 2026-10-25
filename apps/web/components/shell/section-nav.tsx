"use client";

import Link from "next/link";

/**
 * One page row in the sidebar: a group's pages in its list and in its rail pop-out (DESIGN.md §6.7). `active` marks
 * it current, with the accent left border and 600 weight, for assistive tech too (on its page and the pages below it); in
 * forced colours, where every border shows, only the current row's border is drawn, in Highlight. `current`, on
 * its own page only, stops a click from reloading that page. Its list draws the 1px line the border sits on.
 */
export function SidebarSectionLink({ href, testId, label, active, current }: { href: string; testId?: string; label: string; active: boolean; current: boolean }) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      onNavigate={(event) => {
        if (current) event.preventDefault();
      }}
      className={`-ml-px flex items-center border-l-2 py-1.5 pr-2 pl-3 text-[12.5px] leading-[1.4] no-underline transition-colors duration-150 max-[900px]:min-h-11 max-[900px]:py-2.5 max-[900px]:text-[13.5px] ${
        active
          ? "border-[var(--accent)] bg-[var(--ink-active)] font-semibold text-[var(--paper)] forced-colors:border-[color:Highlight]"
          : "border-transparent text-[var(--ink-fg-muted)] hover:text-[var(--paper)] forced-colors:border-[color:Canvas]"
      }`}
    >
      {label}
    </Link>
  );
}
