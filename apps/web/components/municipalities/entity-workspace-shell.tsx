import type { ReactNode } from "react";

/** The Budget place page's two columns: the chart column and a sticky 340px aside from 1100px of column width. */
export function EntityWorkspaceShell({ testId, main, aside }: { testId: string; main: ReactNode; aside: ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="mt-7 grid items-start gap-10 border-t border-[var(--ink)] pt-5 @min-[1100px]:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="min-w-0">{main}</div>
      <aside className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]">
        <div className="sticky top-5">{aside}</div>
      </aside>
    </div>
  );
}
