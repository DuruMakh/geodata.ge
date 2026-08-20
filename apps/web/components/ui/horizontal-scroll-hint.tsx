type HorizontalScrollHintProps = {
  testId: string;
};

export function HorizontalScrollHint({ testId }: HorizontalScrollHintProps) {
  return (
    <p
      data-testid={testId}
      className="mb-2 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)] min-[768px]:hidden"
    >
      მეტი მონაცემისთვის გადაასრიალე ჰორიზონტალურად
    </p>
  );
}
