// Marks a dataset or section that has no data yet (DESIGN.md §6.7). Rendering a
// coming-soon surface as if it were live is the failure this guards against.
// `label` is the caller's `common.comingSoon`, so a server page renders it on the server.
export function ComingSoonBadge({ label, surface = "ink" }: { label: string; surface?: "ink" | "paper" }) {
  return (
    <span
      className={`flex-none rounded-[2px] border border-[#6C6860] px-1.5 py-px font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9px] ${surface === "paper" ? "text-[var(--muted)]" : "text-[var(--ink-fg-faint)]"}`}
    >
      {label}
    </span>
  );
}
