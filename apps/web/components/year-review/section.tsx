import type { ReactNode } from "react";
import type { Grouping } from "../../lib/yearReview/yearView";
import type { YearReviewData } from "../../lib/yearReview/types";

/**
 * What the page hands every section (spec §4–§5): the data, the ruler's year, the switches, and the picked category.
 * `focus` is the hovered category, else the pinned one; `onFocus` sets or clears the hover, `onPin` pins or unpins.
 */
export type YearReviewSectionProps = {
  data: YearReviewData;
  year: number;
  grouping: Grouping;
  side: "expenditure" | "revenue";
  measure: "share" | "gel";
  focus: string | null;
  onFocus: (id: string | null) => void;
  onPin: (id: string) => void;
};

/**
 * One numbered section of the page: a 1px ink rule, the number in accent, the H2, and on the right a short mono line
 * and the section's own switches (after the line, when there is one). Below 768px they wrap under the heading.
 */
export function Section({ number, id, heading, meta, controls, children }: {
  number: string;
  id: string;
  heading: string;
  meta?: string | null;
  controls?: ReactNode;
  children?: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="mt-16 scroll-mt-[84px] min-[768px]:mt-[84px]">
      <header className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 border-t border-[var(--ink)] pt-3.5">
        <span aria-hidden="true" className="font-[family-name:var(--font-numeric)] text-xs font-semibold text-[var(--accent)]">{number}</span>
        <h2 id={headingId} className="font-[family-name:var(--font-display)] text-[23px] font-semibold leading-[1.2] tracking-[-0.01em] [text-wrap:balance] min-[768px]:text-[30px]">
          {heading}
        </h2>
        {meta ? <p className="w-full font-[family-name:var(--font-numeric)] text-xs text-[var(--muted)] min-[768px]:ml-auto min-[768px]:w-auto">{meta}</p> : null}
        {controls ? <div className={meta ? "self-center" : "self-center min-[768px]:ml-auto"}>{controls}</div> : null}
      </header>
      {children}
    </section>
  );
}
