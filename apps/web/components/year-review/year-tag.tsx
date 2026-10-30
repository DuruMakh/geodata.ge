"use client";

import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";

// The small boxed tags beside a figure (spec §7): the year a figure comes from when its dataset has no value for the
// chosen year, and the plan or projection mark. A tag is never the only carrier of a number's meaning: the figure
// stays, the tag only says which year or basis it is.

const BOX = "inline-block whitespace-nowrap border px-[5px] font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] font-normal not-italic leading-[17px]";
const ACCENT = `${BOX} border-[var(--accent)] text-[var(--accent)]`;
const MUTED = `${BOX} border-[var(--hairline)] text-[var(--muted)]`;

/**
 * The year a figure is from. `full` spells it out (`2024 წლის მონაცემი`), as a finding card does; otherwise the box
 * shows the year alone, as a headline number does, and says the rest to a screen reader.
 */
export function YearTag({ year, full = false }: { year: number; full?: boolean }) {
  const { messages } = useI18n();
  const said = message(messages, "yearReview.fb", { y: year });
  if (full) return <em data-year-tag={year} className={MUTED}>{said}</em>;
  return (
    <em data-year-tag={year} className={ACCENT}>
      <span aria-hidden="true">{year}</span>
      <span className="sr-only">{said}</span>
    </em>
  );
}

/** `გეგმა` / `plan` on a planned budget figure, `პროგნოზი` / `projection` on a projected one. */
export function PlanTag({ label }: { label: string }) {
  return <em data-plan-tag="" className={ACCENT}>{label}</em>;
}
