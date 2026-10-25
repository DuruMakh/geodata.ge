import type { ReactNode } from "react";
import { ChartGeometryContext } from "../main-explorer/chart-frame";
import { SwatchBar } from "../ui/editorial";

export type ShareLegendItem = { label: string; color: string };

export type ShareCardProps = {
  title: string;
  /** One line: unit and years, e.g. `₾ თვეში · 1995–2025`. */
  caption: string;
  /** The selected series; left out for charts that carry their own key (maps, the pyramid). */
  legend?: ShareLegendItem[];
  source: string;
  chart: ReactNode;
};

// The share picture (DESIGN.md §7.17): a fixed 1200px card on paper, drawn to a PNG off-screen.
// Its chart always takes the desktop drawing, whatever the screen the reader is on.
export function ShareCard({ title, caption, legend, source, chart }: ShareCardProps) {
  return (
    <div data-testid="share-card" className="box-border w-[1200px] bg-[var(--paper)] px-14 pt-12 pb-9 text-[var(--ink)]">
      <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15]">{title}</p>
      <p className="mt-2 font-[family-name:var(--font-numeric)] text-sm text-[var(--muted)]">{caption}</p>
      {legend?.length ? (
        <ul data-testid="share-card-legend" className="mt-[22px] flex flex-wrap gap-x-[26px] gap-y-2.5">
          {legend.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-2 text-[15px]">
              <SwatchBar color={item.color} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-[18px]">
        <ChartGeometryContext.Provider value="desktop">{chart}</ChartGeometryContext.Provider>
      </div>
      <div className="mt-[22px] flex items-center justify-between gap-6 border-t border-[var(--ink)] pt-3.5">
        <p className="text-[13px] leading-[1.4] text-[var(--muted)]">{source}</p>
        <p className="inline-flex flex-none items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn into the picture as is, never shown on the page */}
          <img src="/fiscal-ge-logo.svg" alt="" className="h-[30px] w-auto" />
          <span className="font-[family-name:var(--font-display)] text-xl">fiscal.ge</span>
        </p>
      </div>
    </div>
  );
}
