"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { useRef } from "react";
import type { ResolvedRange } from "./use-explorer-state";

// Range strip per DESIGN.md §7.4–7.5: mono quick chips (5წ/10წ/ყველა) and a
// 24px rail with year ticks and two accessible slider handles. A monthly strip
// (periodsPerYear 12) counts the same chips in months and prints formatted periods.

export type RangeMarker = {
  year: number;
  label: string;
  /** Omit to centre the label on the marker. "auto" puts it on the side with room, as the chart's break label does. */
  labelSide?: "auto";
};

type RangeStripProps = {
  years: number[];
  range: ResolvedRange;
  onChange: (patch: { start?: number; end?: number }) => void;
  marker?: RangeMarker;
  /** Periods per calendar year on the rail. Omit for years. */
  periodsPerYear?: number;
  /** Readout, end and slider text for a period value. Omit to print the value. */
  formatPeriod?: (period: number) => string;
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

export function RangeStrip({ years, range, onChange, marker, periodsPerYear = 1, formatPeriod }: RangeStripProps) {
  const { messages } = useI18n();
  const format = formatPeriod ?? String;
  const monthly = periodsPerYear > 1;
  const railRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<Handle | null>(null);
  const { start, end, min, max } = range;
  const span = Math.max(max - min, 1);
  const pct = (year: number) => `${(((year - min) / span) * 100).toFixed(2)}%`;
  const visibleMarker = marker && marker.year >= min && marker.year <= max ? marker : undefined;
  // Centred on the marker, unless `labelSide: "auto"` applies the chart's break-label rule (`bx > W / 2`):
  // past the middle of the rail the label ends at the marker, otherwise it starts there.
  const markerLabelAnchor =
    visibleMarker?.labelSide === "auto" ? ((visibleMarker.year - min) / span > 0.5 ? "right-0" : "left-0") : "-translate-x-1/2";

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
    "absolute -top-1 size-[30px] -translate-x-1/2 cursor-pointer rounded-full border-0 bg-transparent p-0 before:absolute before:top-1/2 before:left-1/2 before:size-[15px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-[var(--accent)] before:bg-[var(--paper)] before:shadow-[0_1px_3px_rgba(30,27,22,0.15)] before:content-['']";

  return (
    <div data-testid="year-range-strip" className="mt-[22px] border-t border-[var(--hairline)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">
          {message(messages, "controls.range")}{" "}
          <span className="font-[family-name:var(--font-numeric)] text-xs font-medium text-[var(--ink)]">
            {format(start)}–{format(end)}
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
                className={`-mx-1.5 -my-[7px] cursor-pointer px-1.5 py-[7px] font-[family-name:var(--font-numeric)] text-[11px] ${
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
        className="relative mt-3 h-6 cursor-pointer touch-none"
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
            <span className={`absolute -top-4 ${markerLabelAnchor} whitespace-nowrap font-[family-name:var(--font-numeric)] text-[9px] font-medium text-[var(--accent)]`}>
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
        <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">{format(min)}</span>
        <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">{format(max)}</span>
      </div>
    </div>
  );
}
