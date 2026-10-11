"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

const COLUMNS = 4;
const NUMERIC = "font-[family-name:var(--font-numeric)]";

/**
 * An underlined trigger that opens a four-column grid of years, in `RegionPicker`'s panel
 * style. It picks a value in place (the region and city pickers navigate instead).
 * `noneLabel` adds a full-width "no year" row above the grid; `markYear` stars one year
 * and explains the star in a footer line.
 */
export function YearPicker({
  label,
  years,
  value,
  onChange,
  noneLabel,
  markYear,
  markLabel,
  testId,
}: {
  label: string;
  years: readonly number[];
  value: number | null;
  onChange: (year: number | null) => void;
  noneLabel?: string;
  markYear?: number;
  markLabel?: string;
  testId: string;
}) {
  const baseId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hasNone = noneLabel !== undefined;
  const offset = hasNone ? 1 : 0;
  const options: (number | null)[] = hasNone ? [null, ...years] : [...years];
  const last = options.length - 1;
  const selectedIndex = Math.max(0, options.indexOf(value));
  const optionId = (index: number) => `${baseId}-${options[index] ?? "none"}`;

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const choose = (index: number) => {
    const next = options[index];
    if (next === undefined) return;
    close();
    if (next !== value) onChange(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const grid = active - offset;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = Math.min(active + 1, last);
    else if (event.key === "ArrowLeft") next = Math.max(active - 1, 0);
    else if (event.key === "ArrowDown") next = grid < 0 ? offset : grid + COLUMNS < years.length ? active + COLUMNS : active;
    else if (event.key === "ArrowUp") next = grid < 0 ? active : grid - COLUMNS >= 0 ? active - COLUMNS : hasNone ? 0 : active;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    } else if (event.key === "Tab") {
      // Hand focus back to the trigger first, so Tab carries on from there.
      close();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  const labelId = `${baseId}-label`;
  const valueText = value === null ? noneLabel ?? "" : String(value);
  const optionClass = (index: number) => {
    const selected = options[index] === value;
    return [
      "cursor-pointer text-[var(--ink)] hover:bg-[var(--tint)]",
      // The active option carries the focus ring while the list has keyboard focus.
      index === active ? "group-focus-visible:outline-2 group-focus-visible:-outline-offset-2 group-focus-visible:outline-[color:var(--accent)]" : "",
      selected ? "border-b-2 border-b-[var(--accent)] bg-[var(--tint)] font-semibold" : "border-b-2 border-b-transparent",
    ].join(" ");
  };

  return (
    <div className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-[var(--muted)] max-[767px]:w-full">
      <span id={labelId}>{label}</span>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={`${baseId}-trigger`}
          data-testid={testId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${baseId}-trigger`}
          onClick={() => (open ? close() : show())}
          className="flex items-center justify-between gap-3 border-b border-[var(--control)] bg-transparent py-2 text-left text-[12px] font-normal text-[var(--ink)] max-[767px]:min-h-[44px] max-[767px]:w-full"
        >
          <span className={value === null ? "" : NUMERIC}>{valueText}</span>
          {open ? <ChevronUp aria-hidden size={16} strokeWidth={1.5} /> : <ChevronDown aria-hidden size={16} strokeWidth={1.5} />}
        </button>
        {open ? (
          <>
            <div aria-hidden className="fixed inset-0 z-30" onClick={close} />
            <div data-testid={`${testId}-panel`} className="absolute top-full left-0 z-40 mt-1 w-[248px] max-w-[92vw] border border-[var(--control)] bg-[var(--tile)]">
              <div
                ref={listRef}
                role="listbox"
                aria-label={label}
                tabIndex={-1}
                aria-activedescendant={optionId(active)}
                onKeyDown={onKeyDown}
                className="group grid grid-cols-4 outline-none"
              >
                {options.map((option, index) =>
                  option === null ? (
                    <div
                      key="none"
                      id={optionId(index)}
                      role="option"
                      aria-selected={value === null}
                      onClick={() => choose(index)}
                      className={`col-span-4 flex min-h-[36px] items-center px-3 text-[12.5px] max-[767px]:min-h-[44px] ${optionClass(index)} shadow-[inset_0_-1px_0_var(--hairline-soft)]`}
                    >
                      {noneLabel}
                    </div>
                  ) : (
                    <div
                      key={option}
                      id={optionId(index)}
                      role="option"
                      aria-selected={option === value}
                      aria-label={option === markYear && markLabel ? `${option} (${markLabel})` : undefined}
                      onClick={() => choose(index)}
                      className={`flex min-h-[36px] items-center justify-center text-[12.5px] max-[767px]:min-h-[44px] ${NUMERIC} ${optionClass(index)}`}
                    >
                      {option}
                      {option === markYear ? <span aria-hidden className="ml-px self-start pt-1.5 text-[11px] text-[var(--accent)]">*</span> : null}
                    </div>
                  ),
                )}
              </div>
              {markYear !== undefined && markLabel ? (
                <div className="border-t border-[var(--hairline-soft)] px-3 py-2 text-[11px] font-normal text-[var(--muted)]">
                  * {markYear} — {markLabel}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
