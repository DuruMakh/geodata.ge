import Link from "next/link";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale, Messages } from "../../lib/i18n/types";

// Breadcrumb row above every explorer surface (DESIGN.md §6.7). The right-hand
// label is dataset COVERAGE, not the user's selection — the range strip owns that.
//
// The crumbs use BreadcrumbTrail's semantics — a nav landmark, aria-hidden
// separators, aria-current on the last crumb — but not the component, which
// renders its own BreadcrumbJsonLd and these routes already emit one.
//
// Below 768px the full trail wrapped to two or three lines and repeated the
// title, so phones get one back-crumb to the parent instead (owner decision
// D10, 2026-10-07). The BreadcrumbList JSON-LD is rendered by each route and
// is the same at every width.
//
// It takes the language as props, not from the I18nProvider, so a server page
// renders it on the server and a client explorer passes what it read (X1-12).

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  locale: Locale;
  /** Holds `common.breadcrumb`, the trail's landmark name. */
  messages: Messages;
  crumbs: Crumb[];
  coverage: string;
};

export function PageHeader({ locale, messages, crumbs, coverage }: PageHeaderProps) {
  const landmark = message(messages, "common.breadcrumb");
  const parent = crumbs.slice(0, -1).findLast((crumb) => crumb.href);
  return (
    <header
      data-testid="explorer-header"
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-[var(--ink)] pt-1 pb-1.5 min-[768px]:gap-y-2 min-[768px]:pt-[18px] min-[768px]:pb-3"
    >
      <nav
        aria-label={landmark}
        className="text-[0.6875rem] min-[768px]:text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] max-[768px]:hidden"
      >
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;

          return (
            <span key={crumb.label}>
              {index > 0 ? <span aria-hidden="true" className="mx-1.5 text-[var(--accent)]">/</span> : null}
              {crumb.href ? (
                <Link href={pageHref(crumb.href, locale)} prefetch={false} className="text-[var(--muted)] no-underline hover:text-[var(--ink)] hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={current ? "page" : undefined} className={current ? "text-[var(--ink)]" : undefined}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      {parent?.href ? (
        <nav aria-label={landmark} data-testid="explorer-back-crumb" className="min-[768px]:hidden">
          <Link
            href={pageHref(parent.href, locale)}
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
          >
            <span aria-hidden="true" className="text-[var(--accent)]">←</span>
            {parent.label}
          </Link>
        </nav>
      ) : null}
      <p className="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] text-[var(--faint)] min-[768px]:whitespace-nowrap">{coverage}</p>
    </header>
  );
}
