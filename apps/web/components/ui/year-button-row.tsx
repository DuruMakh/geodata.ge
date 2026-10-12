"use client";

import { useLayoutEffect, useRef } from "react";

/** One button per year; the pressed one is `value`. Below 768px the buttons sit on one
 *  scrolling row (DESIGN.md §12). `tagFor` adds a small superscript tag after a year. */
export function YearButtonRow({ years, value, onChange, tagFor, testId }: {
  years: readonly number[];
  value: number | null;
  onChange: (year: number) => void;
  tagFor?: (year: number) => string | null;
  testId: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Keep the active year in view, both when the page opens and when the year changes elsewhere.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const active = row?.querySelector<HTMLElement>("button[aria-pressed='true']");
    if (row && active) row.scrollLeft = yearRowScrollLeft(row, active);
  }, [value, years]);

  return (
    <div
      ref={rowRef}
      data-testid={testId}
      className="relative mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-0.5 max-[768px]:flex-nowrap max-[768px]:overflow-x-auto"
    >
      {years.map((candidate) => {
        const active = candidate === value;
        const tag = tagFor?.(candidate) ?? null;

        return (
          <button
            key={candidate}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(candidate)}
            className={`min-h-9 shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-[3px] pt-1.5 pb-[7px] font-[family-name:var(--font-numeric)] text-xs ${
              active ? "border-[var(--accent)] font-semibold text-[var(--ink)]" : "border-transparent font-normal text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {candidate}
            {tag ? (
              <span className="ml-1 align-super text-[11px] min-[768px]:text-[9px] text-[var(--faint)]">{tag}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Scroll offset that brings `active` fully into the row, centring it only when it
 *  is (partly) out of view, so a tap on a visible year never moves the row. */
export function yearRowScrollLeft(row: Pick<HTMLElement, "scrollLeft" | "clientWidth" | "scrollWidth">, active: Pick<HTMLElement, "offsetLeft" | "offsetWidth">) {
  const start = active.offsetLeft;
  const end = start + active.offsetWidth;
  if (start >= row.scrollLeft && end <= row.scrollLeft + row.clientWidth) return row.scrollLeft;
  const centred = start - (row.clientWidth - active.offsetWidth) / 2;
  return Math.max(0, Math.min(row.scrollWidth - row.clientWidth, centred));
}
