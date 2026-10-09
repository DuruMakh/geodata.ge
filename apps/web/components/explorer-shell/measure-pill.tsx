/** The pill that switches the chart between GEL and a share of GDP. Pressed, it
 *  leads with a ✓ (decorative: `aria-pressed` carries the state), and the unit
 *  caption beside it is not shown, so the two never read the same text. */
export function MeasurePill({ label, pressed, onChange }: { label: string; pressed: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      data-testid="measure-share-toggle"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      // 36px tall on phones (D8 touch target), the compact 27px pill from 768px.
      className={`h-9 min-[768px]:h-[27px] flex-none cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors duration-150 ${
        pressed
          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] before:mr-1 before:content-['✓'_/_'']"
          : "border-[var(--control)] bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}
