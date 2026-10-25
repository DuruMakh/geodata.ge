"use client";

import { useEffect, useRef } from "react";
import type { TradeChapter } from "../../../lib/landing/chapters/types";
import { TRADE_COLORS } from "./canvas";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { tradePartnerTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 09's partners chart: the ten largest trading partners by turnover, exports to the left and imports to the
// right of the country name. The title, legend and accessible name are server HTML; the drawing engine
// (butterfly-engine.ts) loads near view.

export type ButterflyLabels = {
  title: string; // above the chart, with the year: "10 უმსხვილესი სავაჭრო პარტნიორი, 2025, მლრდ $"
  exports: string; // legend and tooltip: "ექსპორტი"
  imports: string; // legend and tooltip: "იმპორტი"
  balance: string; // tooltip row: "ბალანსი"
  turnover: string; // tooltip foot: "ბრუნვა"
  unit: string; // follows every tooltip amount: "მლრდ $"
  exportsHead: string; // above the left half: "← ექსპორტი"
  importsHead: string; // above the right half: "იმპორტი →"
  chartSummary: string; // canvas aria-label lead, with count and year: "ექსპორტი და იმპორტი 10 უმსხვილეს პარტნიორთან 2025 წელს"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./butterfly-engine");

export function ButterflyChart({ year, partners, labels }: { year: number; partners: TradeChapter["partners"]; labels: ButterflyLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ year, partners, labels });
  useEffect(() => {
    live.current = { year, partners, labels };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !tip) return;
    const engine = lib.createButterfly({
      wrap,
      canvas,
      partners,
      labels: () => live.current.labels,
      onHover(index, x, y) {
        const { year: yr, partners: p, labels: lab } = live.current;
        showTip(tip, tradePartnerTip(p, yr, lab, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, partners]);

  const ariaLabel = `${labels.chartSummary}: ${partners.map((partner) => partner.label).join(", ")}`;
  const legend = [
    { name: labels.exports, color: TRADE_COLORS.exports },
    { name: labels.imports, color: TRADE_COLORS.imports },
  ];

  return (
    <Reveal>
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            {legend.map((entry) => (
              <li key={entry.name} className="inline-flex items-center gap-[7px]">
                <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: entry.color }} />
                {entry.name}
              </li>
            ))}
          </ul>
        </figcaption>
        <div ref={wrapRef} className="relative h-[340px] w-full min-[768px]:h-[400px]">
          {failed ? <ChartUnavailable text={labels.unavailable} summary={ariaLabel} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={3} />
        </div>
      </figure>
    </Reveal>
  );
}
