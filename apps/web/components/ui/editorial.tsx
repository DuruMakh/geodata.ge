import type { ReactNode } from "react";

// Small shared pieces of the editorial system (DESIGN.md §7): text tabs with an
// accent underline, the tint callout, and the 14×3px swatch bar.

type TextTabProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
};

export function TextTab({ label, active, onClick, testId }: TextTabProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`-mx-0.5 -my-1.5 cursor-pointer px-0.5 py-1.5 text-[12.5px] transition-colors duration-150 ${
        active
          ? "font-semibold text-[var(--ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-4"
          : "font-medium text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}

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
      className="max-w-[560px] border-l-2 border-[var(--accent)] bg-[var(--tint)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--body)]"
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
    <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{children}</p>
  );
}

type SectionTitleProps = {
  children: ReactNode;
};

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
      {children}
    </h2>
  );
}

type SourceNoteProps = {
  children: ReactNode;
  testId?: string;
};

export function SourceNote({ children, testId }: SourceNoteProps) {
  return (
    <p data-testid={testId} className="text-xs leading-relaxed text-[var(--muted)]">
      {children}
    </p>
  );
}
