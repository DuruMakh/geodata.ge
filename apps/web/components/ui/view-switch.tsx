type ViewSwitchProps<T extends string> = {
  label: string;
  checked: boolean;
  checkedValue: T;
  uncheckedValue: T;
  onChange: (value: T) => void;
  testId?: string;
  ariaLabel: string;
};

export function ViewSwitch<T extends string>({
  label,
  checked,
  checkedValue,
  uncheckedValue,
  onChange,
  testId,
  ariaLabel,
}: ViewSwitchProps<T>) {
  return (
    <div className="inline-flex items-center gap-3 text-[13px] font-semibold text-[var(--body)]">
      <span>{label}</span>
      <button
        type="button"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-pressed={checked}
        onClick={() => onChange(checked ? uncheckedValue : checkedValue)}
        className={[
          "relative h-[31px] w-[51px] rounded-full transition",
          checked ? "bg-[#34c759]" : "bg-[var(--strong)]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute left-0.5 top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
