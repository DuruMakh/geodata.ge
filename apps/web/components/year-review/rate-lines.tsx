"use client";

import { niceScale } from "../../lib/explorer/chartScale";
import { formatInUnit, formatShare, UNIT_PERSONS } from "../../lib/explorer/format";
import type { Values } from "../../lib/yearReview/types";

// The small line chart of average interest rates under the debt panel (the AN-App board): one line per rate, its
// latest value labelled at the right end (labels kept apart), a dot on each line at the chosen year, years every five
// under it. HTML labels over one SVG of the lines, which stretches to the box and keeps its strokes 2px.

export type RateLine = { id: string; label: string; color: string; values: Values };

const VIEW_W = 300;
const VIEW_H = 120;
const LABEL_GAP = 15; // in view units, between two end labels
const LABEL_EDGE = 6;

/** Label positions at least `LABEL_GAP` apart and inside the box, kept in the order of `wanted` (sorted ascending). */
function spread(wanted: number[]): number[] {
  const placed = [...wanted];
  for (let index = 1; index < placed.length; index += 1) placed[index] = Math.max(placed[index]!, placed[index - 1]! + LABEL_GAP);
  const last = placed.length - 1;
  if (last >= 0 && placed[last]! > VIEW_H - LABEL_EDGE) {
    placed[last] = VIEW_H - LABEL_EDGE;
    for (let index = last - 1; index >= 0; index -= 1) placed[index] = Math.min(placed[index]!, placed[index + 1]! - LABEL_GAP);
  }
  if (placed.length && placed[0]! < LABEL_EDGE) {
    placed[0] = LABEL_EDGE;
    for (let index = 1; index < placed.length; index += 1) placed[index] = Math.max(placed[index]!, placed[index - 1]! + LABEL_GAP);
  }
  return placed;
}

/** The rates in percent over `years`; `year` (clamped to them) gets a dot on every line with a value there. */
export function RateLines({ years, lines, year, ariaLabel }: { years: number[]; lines: RateLine[]; year: number; ariaLabel: string }) {
  const present = lines.flatMap((line) => line.values.filter((value): value is number => value !== null));
  const { top, step } = niceScale(0, Math.max(...present));
  const grid = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const first = years[0]!;
  const span = years.at(-1)! - first || 1;
  const x = (at: number) => ((at - first) / span) * VIEW_W;
  const y = (value: number) => VIEW_H - (value / top) * VIEW_H;
  const chosen = Math.min(Math.max(year, first), years.at(-1)!);
  const chosenIndex = years.indexOf(chosen);

  const drawn = lines.map((line) => {
    const lastIndex = line.values.findLastIndex((value) => value !== null);
    // A gap in a line lifts the pen.
    const path = line.values
      .map((value, index) => (value === null ? "" : `${index > 0 && line.values[index - 1] !== null ? "L" : "M"}${x(years[index]!).toFixed(1)} ${y(value).toFixed(1)}`))
      .join("");
    return { ...line, path, last: lastIndex < 0 ? null : line.values[lastIndex]!, dot: chosenIndex < 0 ? null : line.values[chosenIndex] ?? null };
  }).filter((line) => line.last !== null);
  const order = drawn.map((line, index) => ({ index, at: y(line.last!) })).sort((left, right) => left.at - right.at);
  const placed = spread(order.map((entry) => entry.at));
  const labelAt = new Map(order.map((entry, rank) => [entry.index, placed[rank]!]));
  const percent = (value: number) => formatShare(value / 100);

  return (
    <div role="img" aria-label={ariaLabel} className="relative mt-3 mr-[118px] mb-[26px] ml-[30px] h-[120px] font-[family-name:var(--font-numeric)]">
      {grid.map((value) => (
        <span key={value} aria-hidden="true" className="absolute right-0 left-0 h-0 border-t border-[var(--hairline-soft)]" style={{ bottom: `${(value / top) * 100}%` }}>
          <em className="absolute right-full mr-1.5 -translate-y-1/2 text-[10px] leading-none text-[var(--faint)] not-italic">{`${formatInUnit(value, UNIT_PERSONS)}%`}</em>
        </span>
      ))}
      <svg aria-hidden="true" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {drawn.map((line) => (
          <path key={line.id} d={line.path} fill="none" stroke={line.color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      {drawn.map((line, index) => (
        <span key={line.id} aria-hidden="true">
          {line.dot !== null ? (
            <i
              className="absolute -mt-1 -ml-1 block h-2 w-2 rounded-full shadow-[0_0_0_2px_var(--paper)]"
              style={{ left: `${(x(chosen) / VIEW_W) * 100}%`, top: `${(y(line.dot) / VIEW_H) * 100}%`, backgroundColor: line.color }}
            />
          ) : null}
          <span
            className="absolute left-full ml-2.5 flex -translate-y-1/2 items-center gap-[5px] whitespace-nowrap font-[family-name:var(--font-ui)] text-[11.5px] text-[var(--body)]"
            style={{ top: `${(labelAt.get(index)! / VIEW_H) * 100}%` }}
          >
            <i className="block h-[3px] w-2.5 rounded-sm" style={{ backgroundColor: line.color }} />
            <b className="font-[family-name:var(--font-numeric)] font-semibold text-[var(--ink)]">{percent(line.last!)}</b> {line.label}
          </span>
        </span>
      ))}
      {years.filter((at) => at % 5 === 0).map((at) => (
        <span key={at} aria-hidden="true" className="absolute top-full mt-2 -translate-x-1/2 text-[10px] text-[var(--faint)]" style={{ left: `${(x(at) / VIEW_W) * 100}%` }}>
          {at}
        </span>
      ))}
    </div>
  );
}
