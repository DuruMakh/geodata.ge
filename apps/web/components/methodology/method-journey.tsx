import { message } from "../../lib/i18n/messages";
import type { Messages } from "../../lib/i18n/types";
const STEP_KEYS = ["preserve", "read", "apply", "validate"] as const;

const STEP_LABELS = ["PRESERVE", "READ", "APPLY", "VALIDATE"] as const;

export function MethodJourney({ descriptions, messages }: { descriptions: readonly string[]; messages: Messages }) {
  if (descriptions.length !== STEP_KEYS.length) {
    throw new Error(`MethodJourney requires exactly ${STEP_KEYS.length} descriptions`);
  }

  return (
    <div className="relative mt-8">
      <span
        aria-hidden="true"
        data-testid="method-journey-spine"
        className="absolute bottom-[42px] left-[17.5px] top-[42px] hidden w-px bg-[var(--hairline)] min-[700px]:block"
      />
      <ol className="border-t border-[var(--hairline)]">
        {STEP_KEYS.map((key, index) => (
          <li
            key={key}
            data-testid="method-journey-step"
            className="relative grid gap-3 border-b border-[var(--hairline)] py-6 min-[700px]:grid-cols-[72px_minmax(190px,0.75fr)_minmax(260px,1.25fr)] min-[700px]:gap-7"
          >
            <div className="flex items-center gap-3 min-[700px]:items-start">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--ink)] bg-[var(--paper)] font-[family-name:var(--font-numeric)] text-[11px]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9.5px] tracking-[0.08em] text-[var(--faint)] min-[700px]:hidden">
                {STEP_LABELS[index]}
              </span>
            </div>
            <div>
              <span className="hidden font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9.5px] tracking-[0.08em] text-[var(--faint)] min-[700px]:block">
                {STEP_LABELS[index]}
              </span>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-[18px] font-semibold leading-snug">
                {message(messages, `methodology.${key}`)}
              </h3>
            </div>
            <p className="text-[13px] leading-[1.75] text-[var(--body)]">{descriptions[index]}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
