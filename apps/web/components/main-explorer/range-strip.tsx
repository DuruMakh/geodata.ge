"use client";

import { useRef } from "react";
import type { ResolvedRange } from "./use-explorer-state";

// Range strip per DESIGN.md §7.4–7.5: mono quick chips (1წ/5წ/10წ/ყველა) and a
// 24px rail with year ticks and two accessible slider handles.

type RangeStripProps = {
  years: number[];
  range: ResolvedRange;
  onChange: (patch: { start?: number; end?: number }) => void;
};

type Handle = "start" | "end";

export function RangeStrip({ years, range, onChange }: RangeStripProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<Handle | null>(null);
  const { start, end, min, max } = range;
  const span = Math.max(max - min, 1);
  const pct = (year: number) => `${(((year - min) / span) * 100).toFixed(2)}%`;

  const chips = [
    { label: "1წ", start: max, show: true },
    { label: "5წ", start: years[Math.max(years.length - 5, 0)] ?? min, show: years.length > 5 },
    { label: "10წ", start: years[Math.max(years.length - 10, 0)] ?? min, show: years.length > 10 },
    { label: "ყველა", start: min, show: true },
  ].filter((chip) => chip.show);

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
    let delta: number | "home" | "end" | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") delta = -1;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") delta = 1;
    else if (event.key === "Home") delta = "home";
    else if (event.key === "End") delta = "end";
    else return;
    event.preventDefault();

    const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);
    if (handle === "start") {
      const next = delta === "home" ? min : delta === "end" ? end : clamp(start + delta, min, end);
      onChange({ start: next });
    } else {
      const next = delta === "home" ? start : delta === "end" ? max : clamp(end + delta, start, max);
      onChange({ end: next });
    }
  }

  const handleClass =
    "absolute top-1 size-[15px] cursor-pointer rounded-full border-2 border-[var(--accent)] bg-[var(--paper)] p-0 shadow-[0_1px_3px_rgba(30,27,22,0.15)] -translate-x-1/2";

  return (
    <div data-testid="year-range-strip" className="mt-[22px] border-t border-[var(--hairline)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">
          დიაპაზონი{" "}
          <span className="font-[family-name:var(--font-numeric)] text-xs font-medium text-[var(--ink)]">
            {start}–{end}
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
        aria-label="წლების დიაპაზონი"
        className="relative mt-3 h-6 cursor-pointer touch-none"
      >
        <div className="absolute inset-x-0 top-2.5 h-[3px] bg-[var(--hairline-soft)]" />
        <div
          className="absolute top-2.5 h-[3px] bg-[var(--accent)] opacity-40"
          style={{ left: pct(start), right: `${(100 - ((end - min) / span) * 100).toFixed(2)}%` }}
        />
        <button
          type="button"
          data-testid="range-start-handle"
          onPointerDown={(event) => handleHandleDown("start", event)}
          onKeyDown={(event) => handleKey("start", event)}
          role="slider"
          aria-label="საწყისი წელი"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={start}
          aria-valuetext={String(start)}
          className={handleClass}
          style={{ left: pct(start) }}
        />
        <button
          type="button"
          data-testid="range-end-handle"
          onPointerDown={(event) => handleHandleDown("end", event)}
          onKeyDown={(event) => handleKey("end", event)}
          role="slider"
          aria-label="საბოლოო წელი"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={end}
          aria-valuetext={String(end)}
          className={handleClass}
          style={{ left: pct(end) }}
        />
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">{min}</span>
        <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">{max}</span>
      </div>
    </div>
  );
}
