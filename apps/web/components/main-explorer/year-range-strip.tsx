"use client";

import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

type YearRangeStripProps = {
  years: number[];
  startYear: number;
  endYear: number;
  onStartYearChange: (year: number) => void;
  onEndYearChange: (year: number) => void;
};

export function YearRangeStrip({
  years,
  startYear,
  endYear,
  onStartYearChange,
  onEndYearChange,
}: YearRangeStripProps) {
  const minYear = years[0] ?? startYear;
  const maxYear = years.at(-1) ?? endYear;
  const yearSpan = Math.max(maxYear - minYear, 1);
  const startPercent = ((startYear - minYear) / yearSpan) * 100;
  const endPercent = ((endYear - minYear) / yearSpan) * 100;

  function setAll() {
    onStartYearChange(minYear);
    onEndYearChange(maxYear);
  }

  function setLatestFive() {
    const start = years[Math.max(years.length - 5, 0)] ?? minYear;

    onStartYearChange(start);
    onEndYearChange(maxYear);
  }

  function setLatestOnly() {
    onStartYearChange(maxYear);
    onEndYearChange(maxYear);
  }

  function yearFromPointer(clientX: number, rail: HTMLElement | null) {
    if (!rail || years.length === 0) return minYear;

    const rect = rail.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (years.length - 1));

    return years[index] ?? minYear;
  }

  function moveHandleToYear(handle: "start" | "end", year: number) {
    if (handle === "start") {
      onStartYearChange(Math.min(year, endYear));
      return;
    }

    onEndYearChange(Math.max(year, startYear));
  }

  function nearestHandle(clientX: number, rail: HTMLElement) {
    const rect = rail.getBoundingClientRect();
    const startX = rect.left + (startPercent / 100) * rect.width;
    const endX = rect.left + (endPercent / 100) * rect.width;

    return Math.abs(clientX - startX) <= Math.abs(clientX - endX) ? "start" : "end";
  }

  function beginPointerDrag(handle: "start" | "end", rail: HTMLElement | null, clientX: number) {
    const moveFromClientX = (nextClientX: number) => moveHandleToYear(handle, yearFromPointer(nextClientX, rail));
    const onPointerMove = (moveEvent: PointerEvent) => moveFromClientX(moveEvent.clientX);
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    moveFromClientX(clientX);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function beginMouseDrag(handle: "start" | "end", rail: HTMLElement | null, clientX: number) {
    const moveFromClientX = (nextClientX: number) => moveHandleToYear(handle, yearFromPointer(nextClientX, rail));
    const onMouseMove = (moveEvent: MouseEvent) => moveFromClientX(moveEvent.clientX);
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    moveFromClientX(clientX);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function startDrag(handle: "start" | "end", event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    beginPointerDrag(handle, event.currentTarget.parentElement, event.clientX);
  }

  function startMouseDrag(handle: "start" | "end", event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    beginMouseDrag(handle, event.currentTarget.parentElement, event.clientX);
  }

  function startRailMouseDrag(event: ReactMouseEvent<HTMLDivElement>) {
    const handle = nearestHandle(event.clientX, event.currentTarget);

    event.preventDefault();
    beginMouseDrag(handle, event.currentTarget, event.clientX);
  }

  return (
    <div data-testid="year-range-strip" className="rounded-[16px] border border-[var(--hairline)] bg-[var(--canvas)] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[14px] font-semibold text-[var(--ink)]">
          Range: <strong className="text-[var(--primary)]">{startYear} - {endYear}</strong>
        </div>
        <div className="inline-flex rounded-full bg-[var(--strong)] p-[2px]" aria-label="Quick range">
          <button type="button" onClick={setLatestOnly} className="h-7 min-w-12 rounded-full px-3 text-xs font-semibold text-[var(--body)]">
            1Y
          </button>
          <button type="button" onClick={setLatestFive} className="h-7 min-w-12 rounded-full px-3 text-xs font-semibold text-[var(--body)]">
            5Y
          </button>
          <button type="button" onClick={setAll} className="h-7 min-w-12 rounded-full bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] shadow-sm">
            ALL
          </button>
        </div>
      </div>
      <div
        className="relative mt-5 h-2 rounded-full bg-[var(--strong)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]"
        aria-label="Year range"
        onMouseDown={startRailMouseDrag}
      >
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-[var(--strong)]" />
        <div
          className="absolute inset-y-0 rounded-full bg-[var(--primary)]/20"
          style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
        />
        {years.map((year) => {
          const percent = ((year - minYear) / yearSpan) * 100;
          const active = year >= startYear && year <= endYear;

          return (
            <button
              key={year}
              type="button"
              aria-pressed={active}
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--surface)] shadow-sm"
              style={{ left: `${percent}%` }}
              onClick={() => {
                if (year <= endYear) onStartYearChange(year);
                if (year > endYear) onEndYearChange(year);
              }}
            >
              <span className="sr-only">{year}</span>
            </button>
          );
        })}
        <button
          type="button"
          data-testid="range-start-handle"
          aria-label="Start year"
          className="absolute top-1/2 z-10 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--surface)] shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
          style={{ left: `${startPercent}%` }}
          onPointerDown={(event) => startDrag("start", event)}
          onMouseDown={(event) => startMouseDrag("start", event)}
        />
        <button
          type="button"
          data-testid="range-end-handle"
          aria-label="End year"
          className="absolute top-1/2 z-10 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--surface)] shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
          style={{ left: `${endPercent}%` }}
          onPointerDown={(event) => startDrag("end", event)}
          onMouseDown={(event) => startMouseDrag("end", event)}
        />
      </div>
    </div>
  );
}
