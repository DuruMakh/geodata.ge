import type { ReactNode } from "react";

/** The explorer H1 (DESIGN.md §6.2). */
export function ExplorerHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
      {children}
    </h1>
  );
}
