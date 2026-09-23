import type { ReactNode } from "react";

const PAGE_CLASS = "min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]";

/**
 * The explorer page wrapper and its centred column (DESIGN.md §12).
 *
 * `repeatDesktopBottomPadding` restates `pb-16` at the 768px breakpoint. It
 * changes nothing on screen; the budget, debt and deficit pages carry it and
 * the rest do not, so the flag keeps both class lists as they were.
 * `containerQueries` makes the column the container the workspace's
 * `@min-[1100px]` queries measure.
 */
export function ExplorerPage({
  testId,
  repeatDesktopBottomPadding = false,
  containerQueries = true,
  children,
}: {
  testId?: string;
  repeatDesktopBottomPadding?: boolean;
  containerQueries?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      data-testid={testId}
      className={repeatDesktopBottomPadding ? `${PAGE_CLASS} min-[768px]:pb-16` : PAGE_CLASS}
    >
      <div className={containerQueries ? "@container mx-auto max-w-[1180px]" : "mx-auto max-w-[1180px]"}>
        {children}
      </div>
    </main>
  );
}
