type YearPillsProps = {
  years: number[];
  value: number;
  onChange: (year: number) => void;
};

export function YearPills({ years, value, onChange }: YearPillsProps) {
  return (
    <div data-testid="year-pills" className="overflow-x-auto">
      <div className="inline-flex rounded-full border border-[var(--hairline)] bg-[var(--canvas)] p-[3px]">
        {years.map((year) => {
          const active = value === year;

          return (
            <button
              key={year}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(year)}
              className={[
                "h-8 min-w-[62px] rounded-full px-4 text-[13px] font-semibold transition",
                active ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm" : "text-[var(--body)]",
              ].join(" ")}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}
