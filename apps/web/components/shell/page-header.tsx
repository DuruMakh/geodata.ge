import Link from "next/link";

// Breadcrumb row above every explorer surface (DESIGN.md §6.7). The right-hand
// label is dataset COVERAGE, not the user's selection — the range strip owns that.

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
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {crumbs.map((crumb, index) => (
          <span key={crumb.label}>
            {index > 0 ? <span className="mx-1.5 text-[var(--accent)]">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="text-[var(--muted)] no-underline hover:text-[var(--ink)] hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className={index === crumbs.length - 1 ? "text-[var(--ink)]" : undefined}>{crumb.label}</span>
            )}
          </span>
        ))}
      </p>
      <p className="font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap text-[var(--faint)]">{coverage}</p>
    </header>
  );
}
