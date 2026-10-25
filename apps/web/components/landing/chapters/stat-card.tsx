import type { ReactNode } from "react";
import { Reveal } from "./reveal";

/** The words of a StatCard that the page builds from messages: its small label and its note line. */
export type StatText = { label: string; note: string };

// A number card of the society chapters: 1.5px ink rule, a small label, the big number (an optional unit in
// small type after it), an optional small chart, and one note line. Server HTML, so the number reads and
// indexes without JavaScript. Ported from the design board's .fx-stat.
export function StatCard({ label, value, unit, note, children }: { label: string; value: string; unit?: string; note: string; children?: ReactNode }) {
  return (
    <Reveal>
      <div data-stat="" className="border-t-[1.5px] border-[var(--ink)] pt-[14px]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</div>
        <div className="mt-2 font-[family-name:var(--font-display)] text-[clamp(28px,2.8vw,36px)] font-semibold leading-none tracking-[-0.015em]">
          {value}
          {unit && <small className="ml-[0.25em] text-[0.45em]">{unit}</small>}
        </div>
        {children}
        <p className="mt-3 text-[12.5px] leading-[1.55] text-[var(--body)]">{note}</p>
      </div>
    </Reveal>
  );
}
