const STEP_TITLES = [
  "ხელუხლებელი პირველწყაროს შენარჩუნება",
  "წლისა და სტრუქტურული ეპოქის წაკითხვა",
  "განხილული კლასიფიკაციისა და გარდაქმნის გამოყენება",
  "შემოწმება, შეჯერება და გამოქვეყნება",
] as const;

const STEP_LABELS = ["PRESERVE", "READ", "APPLY", "VALIDATE"] as const;

export function MethodJourney({ descriptionsKa }: { descriptionsKa: readonly string[] }) {
  if (descriptionsKa.length !== STEP_TITLES.length) {
    throw new Error(`MethodJourney requires exactly ${STEP_TITLES.length} descriptions`);
  }

  return (
    <ol className="mt-8 border-t border-[var(--hairline)]">
      {STEP_TITLES.map((title, index) => (
        <li
          key={title}
          data-testid="method-journey-step"
          className="relative grid gap-3 border-b border-[var(--hairline)] py-6 min-[700px]:grid-cols-[72px_minmax(190px,0.75fr)_minmax(260px,1.25fr)] min-[700px]:gap-7"
        >
          <div className="flex items-center gap-3 min-[700px]:items-start">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--ink)] font-[family-name:var(--font-numeric)] text-[11px]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-[family-name:var(--font-numeric)] text-[9.5px] tracking-[0.08em] text-[var(--faint)] min-[700px]:hidden">
              {STEP_LABELS[index]}
            </span>
          </div>
          <div>
            <span className="hidden font-[family-name:var(--font-numeric)] text-[9.5px] tracking-[0.08em] text-[var(--faint)] min-[700px]:block">
              {STEP_LABELS[index]}
            </span>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-[18px] font-semibold leading-snug">
              {title}
            </h3>
          </div>
          <p className="text-[13px] leading-[1.75] text-[var(--body)]">{descriptionsKa[index]}</p>
        </li>
      ))}
    </ol>
  );
}
