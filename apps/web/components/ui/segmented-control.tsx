export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  testId?: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-full bg-[var(--canvas)] p-[3px]" aria-label={label}>
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            data-testid={option.testId}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={[
              "h-8 min-w-20 rounded-full px-4 text-[13px] font-semibold transition",
              active ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--mute)] hover:text-[var(--body)]",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
