"use client";

import { useEffect, useRef } from "react";
import type { DeficitChapter } from "../../../lib/landing/chapters/types";
import { points } from "./chart-format";
import { DEFICIT_RULE_PCT, yearRange } from "./chart-layout";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { deficitTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 05: the general-government balance as % of GDP, one bar per year. Deficits are ink, surpluses
// green; projection years sit in a lightly shaded band at 40% opacity. A dashed accent line marks
// the -3% rule, and the deepest deficit, an earlier one and the longest surplus run are annotated.
// The legend and accessible name are server HTML; the drawing engine (deficit-engine.ts) loads near view.

export type DeficitLabels = {
  title: string; // above the chart: "ზოგადი მთავრობის ბალანსი, % მშპ-სთან"
  bnGel: string; // "მლრდ ₾"
  mlnGel: string; // "მლნ ₾"
  deficit: string; // legend and tooltip foot: "დეფიციტი"
  surplus: string; // legend, tooltip foot and surplus-run bracket (the "2004–2007" range is appended): "პროფიციტი"
  forecast: string; // legend entry for the projection band: "პროგნოზი"
  imf: string; // band label and tooltip title suffix: "IMF-ის პროგნოზი"
  vsGdp: string; // tooltip row and aria-label, follows a percentage: "მშპ-სთან"
  inGel: string; // tooltip row for the amount: "ლარში"
  deepest: string; // aria-label: "ყველაზე ღრმა"
  chartSummary: string; // canvas aria-label lead: "ზოგადი მთავრობის ბალანსი მშპ-სთან"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./deficit-engine");
const RULE_TEXT = points(DEFICIT_RULE_PCT, 0);

export function DeficitChart({ data, labels }: { data: DeficitChapter; labels: DeficitLabels }) {
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
    const engine = lib.createDeficit({
      wrap,
      canvas,
      data,
      labels: () => live.current.labels,
      onHover(index, x, y) {
        const { data: d, labels: lab } = live.current;
        showTip(tip, deficitTip(d, lab, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, data]);

  const n = data.years.length;
  const projection = data.projectionFrom === null ? -1 : data.years.indexOf(data.projectionFrom);
  const ariaLabel =
    `${labels.chartSummary} ${yearRange(data.years[0], data.years[n - 1])}; ` +
    `${data.latestActual.year}: ${points(data.latestActual.pct)} ${labels.vsGdp}; ` +
    `${labels.deepest}: ${points(data.deepest.pct)}, ${data.deepest.year}`;

  return (
    <Reveal className="mt-8">
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            <li data-key="deficit" className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px] bg-[var(--ink)]" />
              {labels.deficit}
            </li>
            <li data-key="surplus" className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px] bg-[var(--positive)]" />
              {labels.surplus}
            </li>
            {projection >= 0 && (
              <li data-key="forecast" className="inline-flex items-center gap-[7px]">
                <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px] bg-[var(--ink)] opacity-40" />
                {labels.forecast}
              </li>
            )}
            <li data-key="rule" className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-0.5 w-3.5 flex-none rounded-[1px] bg-[var(--accent)]" />
              {RULE_TEXT}
            </li>
          </ul>
        </figcaption>
        <div ref={wrapRef} className="relative h-[340px] w-full min-[768px]:h-[420px]">
          {failed ? <ChartUnavailable text={labels.unavailable} summary={ariaLabel} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={2} />
        </div>
      </figure>
    </Reveal>
  );
}
