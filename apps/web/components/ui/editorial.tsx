import type { ReactNode } from "react";
import { ControlTooltip } from "./control-tooltip";

// Small shared pieces of the editorial system (DESIGN.md §7): text tabs with an
// accent underline, the tint callout, and the 14×3px swatch bar. Below 768px a
// text tab is a 44px-tall, at least 24px-wide target; the width needs `!` because
// globals.css gives every button `min-width: 0` outside a layer.

type TextTabProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  id?: string;
  testId?: string;
};

export function TextTab({ label, active, onClick, id, testId }: TextTabProps) {
  return (
    <button
      type="button"
      id={id}
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`-mx-0.5 -my-1.5 cursor-pointer px-0.5 py-1.5 text-[0.78125rem] transition-colors duration-150 max-[768px]:my-0 max-[768px]:min-h-11 max-[768px]:min-w-6! ${
        active
          ? "font-semibold text-[var(--ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-4"
          : "font-medium text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}

type TextTabGroupProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  testId?: string;
};

/** A row of TextTabs announced as one named choice, the way SegmentedTabs announces its options. */
export function TextTabGroup({ ariaLabel, children, className, testId }: TextTabGroupProps) {
  return (
    <span role="group" aria-label={ariaLabel} data-testid={testId} className={className}>
      {children}
    </span>
  );
}

/**
 * The underlined native select look of Unemployment's indicator menu; the year picker's button trigger matches it with its own classes.
 * Below 768px it is 16px and 44px tall, so iOS Safari does not zoom the page on focus. The size needs `!`: globals.css gives
 * every select `font: inherit` outside a layer, which beats a plain utility.
 */
export const SELECT_CLASS = "min-w-0 w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent py-2 text-[12px] text-[var(--ink)] max-[768px]:min-h-11 max-[768px]:text-base!";

export function TabDivider() {
  return <span aria-hidden className="h-[13px] w-px bg-[var(--control)]" />;
}

type CalloutProps = {
  children: ReactNode;
  testId?: string;
};

export function Callout({ children, testId }: CalloutProps) {
  return (
    <p
      data-testid={testId}
      className="max-w-[560px] border-l-2 border-[var(--accent)] bg-[var(--tint)] px-3.5 py-3 text-[0.78125rem] leading-relaxed text-[var(--body)]"
    >
      {children}
    </p>
  );
}

type SwatchBarProps = {
  color: string;
  className?: string;
};

export function SwatchBar({ color, className }: SwatchBarProps) {
  return <span aria-hidden className={`h-[3px] w-3.5 flex-none ${className ?? ""}`} style={{ backgroundColor: color }} />;
}

type OverlineProps = {
  children: ReactNode;
};

export function Overline({ children }: OverlineProps) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{children}</p>
  );
}

type SectionTitleProps = {
  children: ReactNode;
  /** For a section's `aria-labelledby`. */
  id?: string;
};

export function SectionTitle({ children, id }: SectionTitleProps) {
  return (
    <h2 id={id} className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
      {children}
    </h2>
  );
}

type SourceNoteProps = {
  children: ReactNode;
  testId?: string;
};

// Below 768px each link in the note answers taps 4px above and below its text
// (24px, WCAG 2.5.8) without moving a line.
export function SourceNote({ children, testId }: SourceNoteProps) {
  return (
    <p data-testid={testId} className="text-xs leading-relaxed text-[var(--muted)] max-[768px]:[&_a]:py-1">
      {children}
    </p>
  );
}

type SegmentedTabsProps<T extends string> = {
  /** `disabled` keeps the option visible but inert (`aria-disabled`, no change on click); `title` says why. */
  options: Array<{ value: T; label: string; icon?: ReactNode; testId?: string; ariaLabel?: string; disabled?: boolean; title?: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
};

// Segmented control for either/or view switches (DESIGN.md §7.2a). Filters keep
// TextTab — boxing every tab group turns the page into a control panel.
export function SegmentedTabs<T extends string>({ options, value, onChange, ariaLabel }: SegmentedTabsProps<T>) {
  return (
    <span role="group" aria-label={ariaLabel} className={`inline-flex items-stretch ${options.some(option => option.icon) ? "overflow-visible" : "overflow-hidden"} rounded-[2px] border border-[var(--control)]`}>
      {options.map((option, index) => {
        const active = option.value === value;

        const button = (
          <button
            key={option.value}
            type="button"
            data-testid={option.testId}
            aria-label={option.ariaLabel ?? (option.icon ? option.label : undefined)}
            data-focus-inset=""
            aria-pressed={active}
            aria-disabled={option.disabled || undefined}
            title={option.title}
            onClick={() => {
              if (!option.disabled) onChange(option.value);
            }}
            // `data-focus-inset` above draws the focus ring inside the button:
            // the group clips to its rounded box, so an outward ring is cut away
            // on three sides and the survivor lands over the neighbouring tab.
            // Transition only the two properties that change — `transition-colors`
            // also animates outline-color, hiding the ring for its first 150ms.
            className={`${option.disabled ? "cursor-default" : "cursor-pointer"} ${option.icon ? "flex size-9 items-center justify-center" : "px-[13px] py-1.5"} font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] tracking-[0.04em] transition-[background-color,color] duration-150 ${
              index > 0 ? "border-l border-[var(--control)]" : ""
            } ${active ? "bg-[var(--ink)] text-[var(--paper)]" : option.disabled ? "bg-transparent text-[var(--faint)]" : "bg-transparent text-[var(--muted)] hover:bg-[var(--tint)] hover:text-[var(--ink)]"}`}
          >
            {option.icon ?? option.label}
          </button>
        );
        return option.icon ? <ControlTooltip key={option.value} label={option.ariaLabel ?? option.label}>{button}</ControlTooltip> : button;
      })}
    </span>
  );
}

type ShareBarProps = {
  /** The filled fraction, 0–1; clamped. */
  share: number;
  color?: string;
  /** Fills the remainder in a second colour (a two-part split). */
  restColor?: string;
  className?: string;
  testId?: string;
  fillTestId?: string;
};

/**
 * The thin 3px share bar under a figure (DESIGN.md §8.5). Decorative: the figure is
 * always printed beside it. Spans only, so it sits inside links and phrasing content.
 */
export function ShareBar({ share, color = "var(--ink)", restColor, className = "", testId, fillTestId }: ShareBarProps) {
  const filled = Math.max(0, Math.min(1, share));
  return (
    <span aria-hidden="true" data-testid={testId} className={`flex h-[3px] bg-[var(--hairline-soft)] ${className}`}>
      <span data-testid={fillTestId} className="h-[3px]" style={{ width: `${(filled * 100).toFixed(1)}%`, background: color }} />
      {restColor ? <span className="h-[3px]" style={{ width: `${((1 - filled) * 100).toFixed(1)}%`, background: restColor }} /> : null}
    </span>
  );
}
