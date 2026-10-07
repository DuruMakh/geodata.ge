"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { useRef } from "react";
import type { ResolvedRange } from "./use-explorer-state";

// Range strip per DESIGN.md §7.4–7.5: mono quick chips (5წ/10წ/ყველა) and a
// 24px rail with year ticks and two accessible slider handles. A monthly strip
// (periodsPerYear 12) counts the same chips in months and prints formatted periods.

export type RangeMarker = { year: number; label: string };

type RangeStripProps = {
  years: number[];
  range: ResolvedRange;
  onChange: (patch: { start?: number; end?: number }) => void;
  marker?: RangeMarker;
  /** Periods per calendar year on the rail. Omit for years. */
  periodsPerYear?: number;
  /** Readout, end and slider text for a period value. Omit to print the value. */
  formatPeriod?: (period: number) => string;
  /** Monthly strips: short month name (1–12). With it, the readout's month and year
   *  open native selects, so an exact month is one tap away on a phone. */
  formatMonth?: (month: number) => string;
};

type Handle = "start" | "end";

export type RangeChip = { key: "fiveYears" | "tenYears" | "allYears"; start: number };

// No one-year chip: every figure in ძირითადი ინდიკატორები is a start-to-end
// delta, so a range of one year zeroes the whole section. The rail handles can
// still reach that range, which is what the Indicators guard covers. A monthly
// strip counts 5წ/10წ in months.
export function rangeChips(years: number[], min: number, periodsPerYear = 1): RangeChip[] {
  const back = (count: number) => years[Math.max(years.length - count, 0)] ?? min;
  const spans: Array<[RangeChip["key"], number]> = [["fiveYears", 5 * periodsPerYear], ["tenYears", 10 * periodsPerYear]];
  return [
    ...spans.filter(([, count]) => years.length > count).map(([key, count]) => ({ key, start: back(count) })),
    { key: "allYears", start: min },
  ];
}

// Arrows step one period; on a monthly strip Page Up/Down step a year.
export function stepRangeHandle(key: string, handle: Handle, range: ResolvedRange, periodsPerYear = 1): number | null {
  let delta: number | "home" | "end";
  if (key === "ArrowLeft" || key === "ArrowDown") delta = -1;
  else if (key === "ArrowRight" || key === "ArrowUp") delta = 1;
  else if (key === "PageDown" && periodsPerYear > 1) delta = -periodsPerYear;
  else if (key === "PageUp" && periodsPerYear > 1) delta = periodsPerYear;
  else if (key === "Home") delta = "home";
  else if (key === "End") delta = "end";
  else return null;

  const { start, end, min, max } = range;
  const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);
  if (handle === "start") return delta === "home" ? min : delta === "end" ? end : clamp(start + delta, min, end);
  return delta === "home" ? start : delta === "end" ? max : clamp(end + delta, start, max);
}

/** The available period nearest to (year, sub-period), kept inside [lo, hi] (both available periods). */
export function nearestPeriod(periods: readonly number[], year: number, sub: number, periodsPerYear: number, lo: number, hi: number): number {
  const target = Math.min(Math.max(year * periodsPerYear + sub, lo), hi);
  let best = lo;
  for (const period of periods) {
    if (period >= lo && period <= hi && Math.abs(period - target) < Math.abs(best - target)) best = period;
  }
  return best;
}

export function RangeStrip({ years, range, onChange, marker, periodsPerYear = 1, formatPeriod, formatMonth }: RangeStripProps) {
  const { messages } = useI18n();
  const format = formatPeriod ?? String;
  const monthly = periodsPerYear > 1;
  const railRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<Handle | null>(null);
  const { start, end, min, max } = range;
  const span = Math.max(max - min, 1);
  const pct = (year: number) => `${(((year - min) / span) * 100).toFixed(2)}%`;
  const visibleMarker = marker && marker.year >= min && marker.year <= max ? marker : undefined;

  const chips = rangeChips(years, min, periodsPerYear).map((chip) => ({ label: message(messages, `controls.${chip.key}`), start: chip.start }));

  function yearFromClientX(clientX: number): number {
    const rail = railRef.current;
    if (!rail || years.length === 0) return min;
    const rect = rail.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return years[Math.round(ratio * (years.length - 1))] ?? min;
  }

  function moveHandle(handle: Handle, clientX: number) {
    const year = yearFromClientX(clientX);
    // Bail when the resolved year is unchanged: pointer moves land far more often
    // than year boundaries, and each onChange re-renders the whole explorer tree.
    if (handle === "start") {
      const next = Math.min(year, end);
      if (next !== start) onChange({ start: next });
    } else {
      const next = Math.max(year, start);
      if (next !== end) onChange({ end: next });
    }
  }

  function capturePointer(event: React.PointerEvent<HTMLElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Untracked pointers (synthetic events) cannot be captured; the drag still
      // works through the rail's bubbling move/up handlers.
    }
  }

  // Pointer-capture drag: the pressed element captures the pointer, so move/up
  // events keep flowing through the rail's handlers for the whole gesture.
  function handleHandleDown(handle: Handle, event: React.PointerEvent<HTMLElement>) {
    event.stopPropagation();
    event.preventDefault();
    capturePointer(event);
    draggingRef.current = handle;
    moveHandle(handle, event.clientX);
  }

  function handleRailDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const startX = rect.left + ((start - min) / span) * rect.width;
    const endX = rect.left + ((end - min) / span) * rect.width;
    // Clicks outside the current range pick the handle on that side — a nearest-
    // handle tie on a collapsed range would otherwise make rightward clicks no-ops.
    const year = yearFromClientX(event.clientX);
    const handle: Handle =
      year > end ? "end" : year < start ? "start" : Math.abs(event.clientX - startX) <= Math.abs(event.clientX - endX) ? "start" : "end";
    capturePointer(event);
    draggingRef.current = handle;
    moveHandle(handle, event.clientX);
  }

  function handleRailMove(event: React.PointerEvent<HTMLDivElement>) {
    const handle = draggingRef.current;
    if (handle === null) return;
    // If the press ended outside the rail while capture wasn't held (untracked
    // pointers), no pointerup ever reaches us — don't ghost-drag on plain hover.
    if (event.buttons === 0) {
      endDrag();
      return;
    }
    moveHandle(handle, event.clientX);
  }

  function endDrag() {
    draggingRef.current = null;
  }

  function handleKey(handle: Handle, event: React.KeyboardEvent<HTMLButtonElement>) {
    const next = stepRangeHandle(event.key, handle, range, periodsPerYear);
    if (next === null) return;
    event.preventDefault();
    onChange(handle === "start" ? { start: next } : { end: next });
  }

  const handleClass =
    "absolute -top-1 size-[30px] -translate-x-1/2 max-[768px]:-top-[11px] max-[768px]:size-11 cursor-pointer rounded-full border-0 bg-transparent p-0 before:absolute before:top-1/2 before:left-1/2 before:size-[15px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-[var(--accent)] before:bg-[var(--paper)] before:shadow-[0_1px_3px_rgba(30,27,22,0.15)] before:content-['']";

  return (
    <div data-testid="year-range-strip" className="mt-[22px] border-t border-[var(--hairline)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">
          {message(messages, "controls.range")}{" "}
          <span className="font-[family-name:var(--font-numeric)] text-xs font-medium text-[var(--ink)]">
            {monthly && formatMonth ? (
              <>
                <PeriodPicker handle="start" value={start} lo={min} hi={end} periods={years} periodsPerYear={periodsPerYear} formatMonth={formatMonth} onChange={onChange} />
                –
                <PeriodPicker handle="end" value={end} lo={start} hi={max} periods={years} periodsPerYear={periodsPerYear} formatMonth={formatMonth} onChange={onChange} />
              </>
            ) : (
              <>
                {format(start)}–{format(end)}
              </>
            )}
          </span>
        </span>
        <div className="flex gap-3.5">
          {chips.map((chip) => {
            const active = end === max && start === chip.start;

            return (
              <button
                key={chip.label}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ start: chip.start, end: max })}
                className={`-mx-1.5 -my-[7px] min-w-8 cursor-pointer px-1.5 py-[7px] text-center font-[family-name:var(--font-numeric)] text-[11px] ${
                  active
                    ? "font-semibold text-[var(--ink)] underline decoration-[var(--accent)] underline-offset-4"
                    : "font-normal text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={railRef}
        onPointerDown={handleRailDown}
        onPointerMove={handleRailMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="group"
        aria-label={message(messages, monthly ? "controls.monthRange" : "controls.yearRange")}
        // A marker label sits above the rail; the extra top margin keeps it clear of
        // the range chips, which it overlapped on phones. Below 768px the rail is
        // inset 8px so a handle at rest stays out of the edge-swipe (back) zone, and the
        // handles' invisible hit area grows to 44px around the same 15px dot.
        className={`relative ${visibleMarker ? "mt-7" : "mt-3"} h-6 cursor-pointer touch-none max-[768px]:mx-2`}
      >
        <div className="absolute inset-x-0 top-2.5 h-[3px] bg-[var(--hairline-soft)]" />
        <div
          className="absolute top-2.5 h-[3px] bg-[var(--accent)] opacity-40"
          style={{ left: pct(start), right: `${(100 - ((end - min) / span) * 100).toFixed(2)}%` }}
        />
        {visibleMarker ? (
          <div
            data-testid="range-marker"
            className="pointer-events-none absolute top-0 bottom-0 z-[1] w-px bg-[var(--accent)]"
            style={{ left: pct(visibleMarker.year) }}
          >
            {/* Shifted by its own width in proportion to the marker position, so a marker
                near either end keeps its label inside the strip. */}
            <span
              className="absolute -top-4 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] font-medium text-[var(--accent)] min-[768px]:text-[9px]"
              style={{ transform: `translateX(-${pct(visibleMarker.year)})` }}
            >
              {visibleMarker.label}
            </span>
          </div>
        ) : null}
        <button
          type="button"
          data-testid="range-start-handle"
          onPointerDown={(event) => handleHandleDown("start", event)}
          onKeyDown={(event) => handleKey("start", event)}
          role="slider"
          aria-label={message(messages, monthly ? "controls.startMonth" : "controls.startYear")}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={start}
          aria-valuetext={format(start)}
          className={handleClass}
          style={{ left: pct(start) }}
        />
        <button
          type="button"
          data-testid="range-end-handle"
          onPointerDown={(event) => handleHandleDown("end", event)}
          onKeyDown={(event) => handleKey("end", event)}
          role="slider"
          aria-label={message(messages, monthly ? "controls.endMonth" : "controls.endYear")}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={end}
          aria-valuetext={format(end)}
          className={handleClass}
          style={{ left: pct(end) }}
        />
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)] min-[768px]:text-[10.5px]">{format(min)}</span>
        <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)] min-[768px]:text-[10.5px]">{format(max)}</span>
      </div>
    </div>
  );
}

type PeriodPickerProps = {
  handle: Handle;
  value: number;
  lo: number;
  hi: number;
  periods: readonly number[];
  periodsPerYear: number;
  formatMonth: (month: number) => string;
  onChange: (patch: { start?: number; end?: number }) => void;
};

// The readout's month and year, each covered by a transparent native select: the
// visible text is unchanged, a tap opens the platform picker. A choice outside the
// other handle's bound snaps to the nearest available period inside it.
function PeriodPicker({ handle, value, lo, hi, periods, periodsPerYear, formatMonth, onChange }: PeriodPickerProps) {
  const { messages } = useI18n();
  const year = Math.floor(value / periodsPerYear);
  const sub = value % periodsPerYear;
  const firstYear = Math.floor(lo / periodsPerYear);
  const lastYear = Math.floor(hi / periodsPerYear);
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const pick = (nextYear: number, nextSub: number) => {
    const next = nearestPeriod(periods, nextYear, nextSub, periodsPerYear, lo, hi);
    if (next !== value) onChange(handle === "start" ? { start: next } : { end: next });
  };
  // The select reaches 14px above and below the token, so a finger gets a ~44px-tall target.
  const selectClass = "absolute -inset-x-1 -inset-y-3.5 cursor-pointer appearance-none opacity-0";
  const tokenClass =
    "relative inline-block underline decoration-[var(--faint)] decoration-dotted underline-offset-[3px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]";

  return (
    <span data-testid={`range-${handle}-picker`}>
      <span className={tokenClass}>
        <span aria-hidden="true">{formatMonth(sub + 1)}</span>
        <select
          aria-label={message(messages, handle === "start" ? "controls.startMonth" : "controls.endMonth")}
          value={sub}
          onChange={(event) => pick(year, Number(event.target.value))}
          className={selectClass}
        >
          {Array.from({ length: periodsPerYear }, (_, index) => (
            <option key={index} value={index} disabled={year * periodsPerYear + index < lo || year * periodsPerYear + index > hi}>
              {formatMonth(index + 1)}
            </option>
          ))}
        </select>
      </span>{" "}
      <span className={tokenClass}>
        <span aria-hidden="true">{year}</span>
        <select
          aria-label={message(messages, handle === "start" ? "controls.startYear" : "controls.endYear")}
          value={year}
          onChange={(event) => pick(Number(event.target.value), sub)}
          className={selectClass}
        >
          {yearOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </span>
  );
}
