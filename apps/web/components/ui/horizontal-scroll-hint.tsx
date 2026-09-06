"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";

type HorizontalScrollHintProps = {
  testId: string;
};

export function HorizontalScrollHint({ testId }: HorizontalScrollHintProps) {
  const { messages } = useI18n();
  return (
    <p
      data-testid={testId}
      className="mb-2 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)] min-[768px]:hidden"
    >
      {message(messages, "controls.horizontalScroll")}
    </p>
  );
}
