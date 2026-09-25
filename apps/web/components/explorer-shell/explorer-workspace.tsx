import type { ReactNode } from "react";

/** The chart column and the 292px series aside, side by side from 1100px of column width. */
export function ExplorerWorkspace({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="explorer-workspace"
      className="grid items-start gap-8 @min-[1100px]:grid-cols-[minmax(0,1fr)_292px] @min-[1100px]:gap-10"
    >
      {children}
    </div>
  );
}
