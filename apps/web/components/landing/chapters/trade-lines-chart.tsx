"use client";

import { useEffect, useRef } from "react";
import type { TradeChapter } from "../../../lib/landing/chapters/types";
import { TRADE_COLORS } from "./canvas";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { tradeLineTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 09's exports and imports lines, one point per year, with the gap between them shaded as the deficit. The
// title, legend and accessible name are server HTML; the drawing engine (trade-lines-engine.ts) loads near view.

export type TradeLinesLabels = {
  title: string; // above the chart, with the years: "ექსპორტი და იმპორტი, 1995–2025, მლრდ $"
  exports: string; // legend, end label and tooltip: "ექსპორტი"
  imports: string; // legend, end label and tooltip: "იმპორტი"
  balance: string; // tooltip foot: "ბალანსი"
  deficit: string; // legend and the label on the shaded gap: "დეფიციტი"
  unit: string; // follows every tooltip amount: "მლრდ $"
  chartSummary: string; // canvas aria-label, with the range and the latest year's values: "ექსპორტი და იმპორტი 1995–2025: 2025 წელს ექსპორტი 7.3, იმპორტი 18.6 მილიარდი დოლარი"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./trade-lines-engine");

export function TradeLinesChart({ data, labels }: { data: Pick<TradeChapter, "years" | "exports" | "imports">; labels: TradeLinesLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ data, labels });
  useEffect(() => {
    live.current = { data, labels };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !tip) return;
    const engine = lib.createTradeLines({
      wrap,
      canvas,
      data,
      labels: () => live.current.labels,
      onHover(index, x, y) {
        const { data: d, labels: lab } = live.current;
        showTip(tip, tradeLineTip(d, lab, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, data]);

  return (
    <Reveal>
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            {[
              { name: labels.exports, className: "h-0.5 w-3.5 rounded-[1px]", style: { background: TRADE_COLORS.exports } },
              { name: labels.imports, className: "h-0.5 w-3.5 rounded-[1px]", style: { background: TRADE_COLORS.imports } },
              { name: labels.deficit, className: "h-2.5 w-2.5 rounded-[2px] bg-[var(--accent)] opacity-[.22]", style: undefined },
            ].map((entry) => (
              <li key={entry.name} className="inline-flex items-center gap-[7px]">
                <i aria-hidden="true" className={`inline-block flex-none ${entry.className}`} style={entry.style} />
                {entry.name}
              </li>
            ))}
          </ul>
        </figcaption>
        <div ref={wrapRef} className="relative h-[340px] w-full">
          {failed ? <ChartUnavailable text={labels.unavailable} summary={labels.chartSummary} /> : <canvas ref={canvasRef} role="img" aria-label={labels.chartSummary} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={2} />
        </div>
      </figure>
    </Reveal>
  );
}
