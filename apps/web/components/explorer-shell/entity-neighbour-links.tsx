import Link from "next/link";
import type { SyntheticEvent } from "react";

type Neighbour = { href: string; label: string };

const linkClass = "flex min-h-11 min-w-0 items-center font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)] min-[768px]:min-h-0";

/**
 * `← previous · next →` beside a detail page's H1 (economy regions, inflation
 * cities, unemployment regions). Below 768px the pair spans the row under the
 * heading, each link is a 44px-tall tap target and a long name wraps instead of
 * being cut. `plainAnchors` renders plain `<a>`
 * links (a full page load), as the municipal place pages want.
 */
export function EntityNeighbourLinks({
  testId,
  previous,
  next,
  className = "",
  plainAnchors = false,
  carryHash = false,
}: {
  testId: string;
  previous: Neighbour;
  next: Neighbour;
  className?: string;
  plainAnchors?: boolean;
  /** Plain anchors only: carry the page's view hash (mode, range, selection) to the neighbour, read when the link is used. */
  carryHash?: boolean;
}) {
  const Anchor = plainAnchors ? "a" : Link;
  // `prefetch` is a Link prop; a plain <a> must not receive it.
  const linkProps = plainAnchors ? {} : { prefetch: false };
  const hashProps = (href: string) => {
    if (!plainAnchors || !carryHash) return {};
    const refresh = (event: SyntheticEvent<HTMLAnchorElement>) => event.currentTarget.setAttribute("href", `${href}${window.location.hash}`);
    return { onFocus: refresh, onPointerDown: refresh, onContextMenu: refresh, onClick: refresh };
  };
  return (
    <span data-testid={testId} className={`grid w-full min-w-0 grid-cols-2 items-center gap-4 min-[768px]:flex min-[768px]:w-auto min-[768px]:max-w-[40%] min-[768px]:shrink ${className}`}>
      <Anchor href={previous.href} {...linkProps} {...hashProps(previous.href)} className={linkClass}>
        <span className="min-w-0 min-[768px]:truncate">← {previous.label}</span>
      </Anchor>
      <Anchor href={next.href} {...linkProps} {...hashProps(next.href)} className={`${linkClass} justify-end text-right`}>
        <span className="min-w-0 min-[768px]:truncate">{next.label} →</span>
      </Anchor>
    </span>
  );
}
