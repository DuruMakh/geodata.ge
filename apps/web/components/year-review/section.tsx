import type { PointerEvent, ReactNode } from "react";
import type { Grouping } from "../../lib/yearReview/yearView";
import type { YearReviewData } from "../../lib/yearReview/types";
import { HATCH_SWATCH } from "../ui/editorial";

/**
 * What the page hands every section (spec §4–§5): the data, the ruler's year, the switches and their setters, and the
 * picked category. `focus` is the hovered category, else the pinned one; `pin` the pinned one alone (a pressed row);
 * `onFocus` sets or clears the hover, `onPin` pins or unpins.
 */
export type YearReviewSectionProps = {
  data: YearReviewData;
  year: number;
  grouping: Grouping;
  side: "expenditure" | "revenue";
  measure: "share" | "gel";
  focus: string | null;
  pin: string | null;
  onFocus: (id: string | null) => void;
  onPin: (id: string) => void;
  onGrouping: (grouping: Grouping) => void;
  onSide: (side: "expenditure" | "revenue") => void;
  onMeasure: (measure: "share" | "gel") => void;
};

// A chart's heading inside a section, with its short mono line after it (the board's `an-h3`).
export const H3 = "flex flex-wrap items-baseline gap-x-3 gap-y-1 font-[family-name:var(--font-display)] text-[18.5px] font-semibold leading-[1.3] tracking-[-0.005em] [text-wrap:balance] min-[768px]:text-[21px]";
export const H3_META = "font-[family-name:var(--font-numeric)] text-[11.5px] font-normal tracking-normal text-[var(--muted)]";

// The board's small type around a chart: a figure's key line, the unit above a chart, and the note under it.
export const FIG_KEY = "font-[family-name:var(--font-numeric)] text-[11.5px] leading-[1.45] text-[var(--muted)]";
export const UNIT_LINE = "font-[family-name:var(--font-numeric)] text-[11px] leading-none text-[var(--faint)] min-[768px]:text-[10.5px]";
export const FOOT_NOTE = "font-[family-name:var(--font-numeric)] text-[11px] leading-normal text-[var(--faint)]";

/** A hover from a mouse or pen; a touch goes straight to the click that pins, so it never leaves a hover behind. */
export const pointerHover = (set: () => void) => (event: PointerEvent) => {
  if (event.pointerType !== "touch") set();
};

/** The colour key under a chart, for the eye (the chart names its parts to a screen reader); `projection` adds the hatch. */
export function ChartKey({ items, projection }: { items: { label: string; color: string }[]; projection?: string }) {
  return (
    <ul aria-hidden="true" className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-[var(--body)]">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-[7px]">
          <i className="block h-2.5 w-3 rounded-[2px]" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
      {projection ? (
        <li className="inline-flex items-center gap-[7px]">
          <i className={`block h-2.5 w-3 rounded-[2px] ${HATCH_SWATCH}`} />
          {projection}
        </li>
      ) : null}
    </ul>
  );
}

/** The row under a chart (spec §9.2): its key or note on the left, the share button on the right, or alone on the right. */
export function ChartFoot({ children, share }: { children?: ReactNode; share: ReactNode }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2.5">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="ml-auto flex-none">{share}</div>
    </div>
  );
}

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
    // A jump to a section clears what sticks above it: the shell's top bar below 900px (56px and the safe area), the
    // page's ruler row from 768px (year-review-page.tsx), both from 768px to 899px.
    <section
      id={id}
      aria-labelledby={headingId}
      className="mt-16 scroll-mt-[calc(70px+env(safe-area-inset-top))] min-[768px]:mt-[84px] min-[768px]:scroll-mt-[calc(140px+env(safe-area-inset-top))] min-[900px]:scroll-mt-[84px]"
    >
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
