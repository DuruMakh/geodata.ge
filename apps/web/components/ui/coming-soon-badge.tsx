"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";

// Marks a dataset or section that has no data yet (DESIGN.md §6.7). Rendering a
// coming-soon surface as if it were live is the failure this guards against.
export function ComingSoonBadge({ surface = "ink" }: { surface?: "ink" | "paper" }) {
  const { messages } = useI18n();
  return (
    <span
      className={`flex-none rounded-[2px] border border-[#6C6860] px-1.5 py-px font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9px] ${surface === "paper" ? "text-[var(--muted)]" : "text-[var(--ink-fg-faint)]"}`}
    >
      {message(messages, "common.comingSoon")}
    </span>
  );
}
