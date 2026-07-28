import type { ReactNode } from "react";

// Explorer shell (DESIGN.md §6.7). A flex row rather than a fixed grid: the
// sidebar owns its own width, so collapsing it reflows the content with no
// shared state between the two.
export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)] min-[900px]:flex-row">
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
