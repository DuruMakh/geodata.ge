/** The pill that switches the chart between GEL and a share of GDP (or, with another label, any either/or). */
export function MeasurePill({ label, pressed, onChange, testId = "measure-share-toggle" }: { label: string; pressed: boolean; onChange: (next: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={`h-[27px] flex-none cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors duration-150 ${
        pressed
          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
          : "border-[var(--control)] bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}
