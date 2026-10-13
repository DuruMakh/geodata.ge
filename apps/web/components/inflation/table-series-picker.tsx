"use client";

import { TextTab } from "../ui/editorial";

// The month grid shows one series at a time. From 768px of column width the
// choice is a row of TextTabs; below it a native select carries the same choice
// in one row (same state, same URL key) — twelve wrapped category tabs filled
// ~550px of a phone before the table, thirteen city lines ~850px. The select
// is 16px on phones (owner decision Q5, 2026-10-12) and 44px tall.
export function TableSeriesPicker({
  testId,
  label,
  options,
  active,
  onChange,
}: {
  /** Prefix: the tabs are `{testId}-series` / `{testId}-series-{id}`, the select `{testId}-select`. */
  testId: string;
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <>
      <div role="group" aria-label={label} data-testid={`${testId}-series`} className="flex flex-wrap gap-5 @max-[768px]:hidden">
        {options.map((option) => (
          <TextTab
            key={option.id}
            testId={`${testId}-series-${option.id}`}
            label={option.label}
            active={option.id === active}
            onClick={() => onChange(option.id)}
          />
        ))}
      </div>
      <label className="block @min-[768px]:hidden">
        <span className="sr-only">{label}</span>
        <select
          data-testid={`${testId}-select`}
          value={active}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full min-w-0 cursor-pointer rounded-none border-0 border-b border-[var(--control)] bg-transparent py-2 text-[16px] font-semibold text-[var(--ink)] min-[768px]:text-[13px]"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
    </>
  );
}
