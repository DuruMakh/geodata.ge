"use client";

import type { Values } from "../../lib/yearReview/types";
import { Sparkline } from "../ui/sparkline";
import { pointerHover } from "./section";

// Section 03's "every 100 GEL" (spec §4): the 10×10 grid of whole lari and the ranking beside it. Layout from the
// board (`an-waf`, `an-row`); colours are the categories' own. The grid answers a pointer only: keyboard and screen
// reader users pick a category on the ranking rows, which are buttons. Without `onPin` both draw still, for the share
// picture.

type Picking = {
  /** The focused category of this grouping, or null: every other cell or row is drawn dimmed. */
  focus: string | null;
  onFocus?: (id: string | null) => void;
  onPin?: (id: string) => void;
};

/** The grid: one cell per lari, in rank order. `then` is the small grid of the comparison year, hidden from assistive tech. */
export function WaffleGrid({ cells, colorOf, focus, then = false, ariaLabel, onFocus, onPin }: Picking & {
  cells: string[];
  colorOf: (id: string) => string;
  then?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      onPointerLeave={onFocus ? () => onFocus(null) : undefined}
      className={`grid aspect-square grid-cols-10 ${then ? "gap-0.5" : "gap-[3px] @min-[640px]:gap-1"}`}
    >
      {cells.map((id, index) => {
        const dim = focus !== null && id !== focus;
        return (
          <i
            key={index}
            {...{ [then ? "data-then-cell" : "data-cell"]: id }}
            data-dim={dim ? "" : undefined}
            onPointerEnter={onFocus ? pointerHover(() => onFocus(id)) : undefined}
            onClick={onPin ? () => onPin(id) : undefined}
            className={`block ${then ? "rounded-[1.5px]" : "rounded-[3px]"} transition-[background-color,opacity] duration-200 ${onPin ? "cursor-pointer" : ""} ${dim ? "opacity-25" : ""}`}
            style={{ backgroundColor: colorOf(id) }}
          />
        );
      })}
    </div>
  );
}

export type RankRow = {
  id: string;
  label: string;
  color: string;
  /** Lari of every 100: `26`, `<1`, or `—` for a negative amount. */
  cells: string;
  /** `amount · share · change`, and the negative tag. */
  sub: string;
  /** What a screen reader hears for the row. */
  said: string;
  spark: Values;
  sparkIndex: number;
  planned: boolean;
  /** The spark's first plan point, drawn dashed (Sparkline `planFrom`). */
  sparkPlanFrom?: number;
};

/**
 * The full ranking: rank, swatch, lari of every 100, name with `amount · share · change`, and the trend with a dot on
 * the chosen year. A pinned row is pressed; the focused one carries a 2px rule in its colour on the left.
 */
export function RankingList({ rows, focus, pin = null, unit, ariaLabel, hintId, onFocus, onPin }: Picking & {
  rows: RankRow[];
  pin?: string | null;
  unit: string;
  ariaLabel: string;
  hintId?: string;
}) {
  return (
    <ol aria-label={ariaLabel} className="m-0 list-none border-t border-[var(--hairline)] p-0">
      {rows.map((row, rank) => {
        const focused = focus === row.id;
        const dim = focus !== null && !focused;
        // The swatch and the trend fade; the text, the lari figure included, turns muted (contrast, the Task 8 ruling).
        const faded = dim ? "opacity-25" : "";
        const body = (
          <>
            <span aria-hidden="true" className="hidden font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)] @min-[640px]:block">
              {String(rank + 1).padStart(2, "0")}
            </span>
            <i aria-hidden="true" className={`block size-2.5 rounded-[2px] ${faded}`} style={{ backgroundColor: row.color }} />
            <span aria-hidden="true" className="flex items-baseline gap-[3px] whitespace-nowrap font-[family-name:var(--font-display)] font-semibold">
              <b className="text-[28px] leading-none tracking-[-0.02em] tabular-nums">{row.cells}</b>
              <small className="text-[13px] font-medium text-[var(--muted)] [&:lang(en)]:text-[11px]">{unit}</small>
            </span>
            <span aria-hidden={onPin ? true : undefined} className="min-w-0">
              <b className="block text-[14.5px] font-semibold leading-[1.35]">{row.label}</b>
              <span className="mt-[3px] block font-[family-name:var(--font-numeric)] text-[11.5px] leading-[1.45] text-[var(--muted)]">{row.sub}</span>
            </span>
            <span aria-hidden="true" className={`col-start-3 block min-w-0 @min-[640px]:col-start-auto ${faded}`}>
              <Sparkline values={row.spark} color={row.color} width={120} height={30} fluidOnMobile area endDot dotIndex={row.sparkIndex} dotColor={row.color} hollowEnd={row.planned} planFrom={row.sparkPlanFrom} />
            </span>
          </>
        );
        const className = `relative grid w-full grid-cols-[10px_52px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-[var(--row-border)] py-[11px] pr-2.5 pl-2 text-left transition-[background-color,color] duration-150 @min-[640px]:grid-cols-[22px_10px_66px_minmax(0,1fr)_120px] @min-[640px]:gap-x-3.5 ${
          dim ? "text-[var(--muted)]" : "text-[var(--ink)]"
        } ${onPin ? "cursor-pointer hover:bg-[var(--tint)] aria-pressed:bg-[var(--tint)]" : ""}`;
        const marks = {
          "data-rank-row": row.id,
          "data-focus": focused ? "" : undefined,
          "data-dim": dim ? "" : undefined,
          style: focused ? { boxShadow: `inset 2px 0 0 ${row.color}` } : undefined,
        };
        return (
          <li key={row.id}>
            {onPin ? (
              <button
                type="button"
                {...marks}
                aria-pressed={pin === row.id}
                aria-label={row.said}
                aria-describedby={hintId}
                onClick={() => onPin(row.id)}
                onPointerEnter={onFocus ? pointerHover(() => onFocus(row.id)) : undefined}
                onPointerLeave={onFocus ? () => onFocus(null) : undefined}
                // A keyboard focus only: a tap focuses the button after its pointerleave, which would leave a hover behind.
                onFocus={onFocus ? (event) => { if (event.currentTarget.matches(":focus-visible")) onFocus(row.id); } : undefined}
                onBlur={onFocus ? () => onFocus(null) : undefined}
                className={className}
              >
                {body}
              </button>
            ) : (
              <div {...marks} className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
