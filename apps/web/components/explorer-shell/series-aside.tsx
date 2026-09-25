import type { ReactNode } from "react";

/** The series panel: stacked under the chart, then a sticky right column from 1100px. */
export function SeriesAside({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside
      aria-label={label}
      className="min-w-0 max-w-full border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:sticky @min-[1100px]:top-5 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]"
    >
      {children}
    </aside>
  );
}
