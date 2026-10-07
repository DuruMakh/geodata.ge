import Link from "next/link";

type Neighbour = { href: string; label: string };

const linkClass = "flex min-h-11 min-w-0 items-center font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)] min-[768px]:min-h-0";

/**
 * `← previous · next →` beside a detail page's H1 (economy regions, inflation
 * cities, unemployment regions). Below 768px the pair spans the row under the
 * heading and each link is a 44px-tall tap target.
 */
export function EntityNeighbourLinks({ testId, previous, next, className = "" }: { testId: string; previous: Neighbour; next: Neighbour; className?: string }) {
  return (
    <span data-testid={testId} className={`grid w-full min-w-0 grid-cols-2 items-center gap-4 min-[768px]:flex min-[768px]:w-auto min-[768px]:max-w-[40%] min-[768px]:shrink ${className}`}>
      <Link href={previous.href} className={linkClass}>
        <span className="min-w-0 truncate">← {previous.label}</span>
      </Link>
      <Link href={next.href} className={`${linkClass} justify-end text-right`}>
        <span className="min-w-0 truncate">{next.label} →</span>
      </Link>
    </span>
  );
}
