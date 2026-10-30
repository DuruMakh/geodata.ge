"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

// The year ruler (spec §3, the board's `an-tl`): one stop per budget year on a track that is ink up to the chosen
// year. A radio group with a roving tab stop: ←/↓ and →/↑ step a year, Home and End jump to the ends. A press, or a
// press-and-drag along the ruler, picks the year under the pointer. Planned years carry a small plan tag. A narrow
// ruler labels every fourth year, the plan year and the chosen one (none within two years of it, so they never
// collide); from 840px of its own width every year is labelled.

type YearRulerProps = {
  years: readonly number[];
  /** Per year of `years`: its spending is planned. */
  planned: readonly boolean[];
  value: number;
  onChange: (year: number) => void;
  /** The group's accessible name (`tlAria`). */
  label: string;
  /** Each year's accessible name: the year, its figure and its plan mark. */
  yearLabel: (year: number) => string;
  planLabel: string;
};

const STEP: Record<string, (index: number, last: number) => number> = {
  ArrowLeft: (index) => Math.max(0, index - 1),
  ArrowDown: (index) => Math.max(0, index - 1),
  ArrowRight: (index, last) => Math.min(last, index + 1),
  ArrowUp: (index, last) => Math.min(last, index + 1),
  Home: () => 0,
  End: (_, last) => last,
};

function tickClass(selected: boolean, plan: boolean, labelled: boolean): string {
  const base = "pointer-events-none absolute left-1/2";
  if (selected) return `${base} top-[15px] -ml-2 size-4 rounded-full bg-[var(--ink)] shadow-[0_0_0_3px_var(--paper)]`;
  const height = labelled ? "top-[15px] h-4" : "top-[18px] h-2.5";
  const colour = plan ? "-ml-px w-0.5 bg-[var(--accent)]" : "-ml-[0.5px] w-px bg-[var(--control)] group-hover:bg-[var(--ink)]";
  return `${base} ${height} ${colour}`;
}

function yearClass(selected: boolean, plan: boolean, labelled: boolean): string {
  const base = "pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--paper)] px-0.5 font-[family-name:var(--font-numeric)] leading-none";
  if (selected) return `${base} top-[34px] text-[13px] font-semibold text-[var(--ink)]`;
  const shown = labelled ? "visible" : "invisible group-hover:visible @min-[840px]/ruler:visible";
  const colour = plan ? "text-[var(--accent)]" : "text-[var(--faint)] group-hover:text-[var(--ink)]";
  return `${base} top-[35px] text-[11px] min-[768px]:text-[10.5px] ${shown} ${colour}`;
}

export function YearRuler({ years, planned, value, onChange, label, yearLabel, planLabel }: YearRulerProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const dragging = useRef(false);
  const count = years.length;
  const chosen = Math.max(0, years.indexOf(value));

  const pickAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    const index = Math.min(count - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * count)));
    if (years[index] !== value) onChange(years[index]!);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = step(chosen, count - 1);
    onChange(years[next]!);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid="year-ruler"
      className="@container/ruler relative flex h-[52px] min-w-0 flex-1 cursor-pointer touch-pan-y select-none"
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragging.current = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // A synthetic or already-released pointer cannot be captured; the press still picks its year.
        }
        pickAt(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current) pickAt(event);
      }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[22px] h-0.5 bg-[var(--hairline)]"
        style={{ left: `${50 / count}%`, right: `${50 / count}%` }}
      >
        <span className="absolute inset-y-0 left-0 bg-[var(--ink)]" style={{ width: `${count > 1 ? (chosen / (count - 1)) * 100 : 0}%` }} />
      </span>
      {years.map((year, index) => {
        const selected = index === chosen;
        const plan = planned[index] ?? false;
        const labelled = (index % 4 === 0 || plan) && Math.abs(year - value) > 2;
        return (
          <button
            key={year}
            ref={(element) => { buttons.current[index] = element; }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={yearLabel(year)}
            tabIndex={selected ? 0 : -1}
            data-year={year}
            onClick={() => onChange(year)}
            className="group relative h-full min-w-0 flex-1 focus-visible:outline-offset-[-2px]"
          >
            {plan ? (
              <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] leading-3 text-[var(--accent)] min-[768px]:right-auto min-[768px]:left-1/2 min-[768px]:-translate-x-1/2 min-[768px]:text-[10px]">
                {planLabel}
              </span>
            ) : null}
            <span aria-hidden="true" className={tickClass(selected, plan, labelled)} />
            <span aria-hidden="true" className={yearClass(selected, plan, labelled)}>{year}</span>
          </button>
        );
      })}
    </div>
  );
}
