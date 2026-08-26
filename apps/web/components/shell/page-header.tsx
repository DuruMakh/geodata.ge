import Link from "next/link";

// Breadcrumb row above every explorer surface (DESIGN.md §6.7). The right-hand
// label is dataset COVERAGE, not the user's selection — the range strip owns that.
//
// The crumbs use BreadcrumbTrail's semantics — a nav landmark, aria-hidden
// separators, aria-current on the last crumb — but not the component, which
// renders its own BreadcrumbJsonLd and these routes already emit one.

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  crumbs: Crumb[];
  coverage: string;
};

export function PageHeader({ crumbs, coverage }: PageHeaderProps) {
  return (
    <header
      data-testid="explorer-header"
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b-2 border-[var(--ink)] pt-[18px] pb-3"
    >
      <nav
        aria-label="Breadcrumb"
        className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
      >
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;

          return (
            <span key={crumb.label}>
              {index > 0 ? <span aria-hidden="true" className="mx-1.5 text-[var(--accent)]">/</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="max-[768px]:inline-flex max-[768px]:min-h-6 max-[768px]:items-center text-[var(--muted)] no-underline hover:text-[var(--ink)] hover:underline">
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
      <p className="font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap text-[var(--faint)]">{coverage}</p>
    </header>
  );
}
