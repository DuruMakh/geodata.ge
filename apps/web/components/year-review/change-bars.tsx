"use client";

import { withLari } from "../ui/lari";
import { pointerHover } from "./section";

// Section 03's "what changed" bars (spec §4): one row per category with a change, increases right of the zero line
// and decreases left, with the amount and percentage. Layout from the board (`an-cr`): name, bar and figures in one
// row from 640px of section width; below it the bar goes under the name, as on the phone board. Rows answer a pointer
// (the ranking rows above are the keyboard's way to pick); without `onPin` they draw still, for the share picture.

export type ChangeBar = {
  id: string;
  label: string;
  color: string;
  amount: string;
  pct: string;
  /** Left edge and width of the bar, % of the track. */
  left: number;
  width: number;
};

export function ChangeBars({ rows, zero, focus, ariaLabel, onFocus, onPin }: {
  rows: ChangeBar[];
  /** The zero line, % of the track. */
  zero: number;
  focus: string | null;
  ariaLabel: string;
  onFocus?: (id: string | null) => void;
  onPin?: (id: string) => void;
}) {
  return (
    <ul aria-label={ariaLabel} className="m-0 mt-[26px] list-none border-t border-[var(--hairline)] p-0">
      {rows.map((row) => {
        const focused = focus === row.id;
        const dim = focus !== null && !focused;
        return (
          <li
            key={row.id}
            data-change-row={row.id}
            data-focus={focused ? "" : undefined}
            data-dim={dim ? "" : undefined}
            onPointerEnter={onFocus ? pointerHover(() => onFocus(row.id)) : undefined}
            onPointerLeave={onFocus ? () => onFocus(null) : undefined}
            onClick={onPin ? () => onPin(row.id) : undefined}
            className={`grid min-h-[38px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-[var(--row-border)] py-[7px] pr-2.5 transition-[background-color,color] duration-150 @min-[640px]:grid-cols-[minmax(0,220px)_minmax(0,1fr)_112px_60px] @min-[640px]:gap-x-5 @min-[640px]:py-[5px] @min-[960px]:grid-cols-[minmax(0,300px)_minmax(0,1fr)_120px_70px] ${
              dim ? "text-[var(--muted)]" : "text-[var(--ink)]"
            } ${onPin ? "cursor-pointer hover:bg-[var(--tint)]" : ""}`}
          >
            <span className="col-start-1 row-start-1 text-[13.5px] leading-[1.3] @min-[640px]:text-right">{row.label}</span>
            <span aria-hidden="true" className="relative col-start-1 row-start-2 block h-[18px] @min-[640px]:col-start-2 @min-[640px]:row-start-1">
              <i className="absolute -top-2.5 -bottom-2.5 block w-0 border-l border-[var(--ink)]" style={{ left: `${zero}%` }} />
              <i
                className={`absolute inset-y-0 block rounded-[2px] transition-[left,width,opacity] duration-300 ${dim ? "opacity-25" : ""}`}
                style={{ left: `${row.left}%`, width: `${row.width}%`, backgroundColor: row.color }}
              />
            </span>
            <b className="col-start-2 row-start-1 whitespace-nowrap text-right font-[family-name:var(--font-numeric)] text-xs font-semibold @min-[640px]:col-start-3 @min-[640px]:text-left">
              {withLari(row.amount)}
            </b>
            <span className="col-start-2 row-start-2 whitespace-nowrap text-right font-[family-name:var(--font-numeric)] text-xs text-[var(--muted)] @min-[640px]:col-start-4 @min-[640px]:row-start-1">
              {row.pct}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
