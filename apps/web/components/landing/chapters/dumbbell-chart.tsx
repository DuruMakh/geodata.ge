"use client";

import { useEffect, useRef } from "react";
import { formatInUnit, UNIT_PERSONS } from "../../../lib/explorer/format";
import type { WageGapChapter } from "../../../lib/landing/chapters/types";
import { SEX_COLORS } from "./canvas";
import { dumbbellHeight, heightVars, largestWageGap } from "./chart-layout";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { wageTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 08's wages chart: one row per sector, highest average first, with the women's and the men's average wage
// as two dots on one line, a tick at the sector's average and women's wage as a share of men's at the right. The
// title, legend and accessible name are server HTML; the drawing engine (dumbbell-engine.ts) loads near view.

export type DumbbellLabels = {
  title: string; // above the chart, with the year: "საშუალო თვიური ხელფასი დარგების მიხედვით, 2025, ₾"
  women: string; // legend and tooltip: "ქალები"
  men: string; // legend and tooltip: "კაცები"
  average: string; // legend and tooltip: "საშუალო"
  ratioHint: string; // above the chart, says what the figures at the right are: "მარჯვნივ — ქალების ხელფასი კაცებისის %-ად"
  tipFoot: string; // tooltip foot template, {pct} is women's wage as a % of men's: "ქალების ხელფასი კაცებისის {pct}%-ია"
  chartSummary: string; // canvas aria-label lead, with count and year: "ქალებისა და კაცების საშუალო ხელფასი 19 დარგში, 2025"
  largestGap: string; // aria-label: "ყველაზე დიდი სხვაობა"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./dumbbell-engine");

export function DumbbellChart({ year, sectors, labels }: { year: number; sectors: WageGapChapter["sectors"]; labels: DumbbellLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ year, sectors, labels });
  useEffect(() => {
    live.current = { year, sectors, labels };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !tip) return;
    const engine = lib.createDumbbell({
      wrap,
      canvas,
      sectors,
      onHover(index, x, y) {
        const { year: yr, sectors: s, labels: lab } = live.current;
        showTip(tip, wageTip(s, yr, { men: lab.men, women: lab.women, average: lab.average, foot: lab.tipFoot }, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, sectors]);

  const widest = largestWageGap(sectors);
  const gap = formatInUnit(Math.abs(widest.women - widest.men), UNIT_PERSONS);
  const ariaLabel = `${labels.chartSummary}; ${labels.largestGap}: ${widest.label}, ${gap} ₾`;
  const legend = [
    { name: labels.women, className: "h-2.5 w-2.5 rounded-full", style: { background: SEX_COLORS.women } },
    { name: labels.men, className: "h-2.5 w-2.5 rounded-full", style: { background: SEX_COLORS.men } },
    { name: labels.average, className: "h-3 w-0.5", style: { background: "var(--ink)" } },
  ];

  return (
    <Reveal>
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            {legend.map((entry) => (
              <li key={entry.name} className="inline-flex items-center gap-[7px]">
                <i aria-hidden="true" className={`inline-block flex-none ${entry.className}`} style={entry.style} />
                {entry.name}
              </li>
            ))}
          </ul>
        </figcaption>
        <p className="mb-4 text-[11.5px] text-[var(--muted)]">{labels.ratioHint}</p>
        {/* The engine sets the height from the row count (narrow screens use taller rows); until then both are reserved. */}
        <div ref={wrapRef} className="relative h-[var(--h-narrow)] w-full min-[640px]:h-[var(--h-wide)]" style={heightVars(dumbbellHeight(sectors.length, true), dumbbellHeight(sectors.length, false))}>
          {failed ? <ChartUnavailable text={labels.unavailable} summary={ariaLabel} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={3} />
        </div>
      </figure>
    </Reveal>
  );
}
