"use client";

import { useEffect, useRef } from "react";
import type { YouthJobsChapter } from "../../../lib/landing/chapters/types";
import { points } from "./chart-format";
import { heightVars, regionsHeight } from "./chart-layout";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { regionTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 07's regions chart: one lollipop row per region, longest first, against a dashed accent line at the rate of
// Georgia. The title and the accessible name are server HTML; the drawing engine (regions-engine.ts) loads near view.

export type RegionsLabels = {
  title: string; // above the chart, with the year: "უმუშევრობის დონე რეგიონების მიხედვით, 2025, %"
  national: string; // label of the dashed line, the rate follows: "საქართველო"
  rate: string; // tooltip row name, with the year: "უმუშევრობის დონე, 2025"
  equal: string; // tooltip foot for a region equal to Georgia: "საქართველოს საშუალოს ტოლი"
  higher: string; // tooltip foot template, {diff} in points: "საქართველოს საშუალოზე {diff} პ.პ.-ით მაღალი"
  lower: string; // tooltip foot template: "საქართველოს საშუალოზე {diff} პ.პ.-ით დაბალი"
  chartSummary: string; // canvas aria-label lead, with the year; every region and its rate follow: "უმუშევრობის დონე რეგიონების მიხედვით, 2025"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./regions-engine");

export function RegionsChart({ regions, national, labels }: { regions: YouthJobsChapter["regions"]; national: number; labels: RegionsLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ regions, national, labels });
  useEffect(() => {
    live.current = { regions, national, labels };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !tip) return;
    const engine = lib.createRegions({
      wrap,
      canvas,
      regions,
      national,
      nationalLabel: () => `${live.current.labels.national} · ${points(live.current.national)}`,
      onHover(index, x, y) {
        const { regions: r, national: nat, labels: lab } = live.current;
        showTip(tip, regionTip(r, nat, lab, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, regions, national]);

  const ariaLabel = `${labels.chartSummary}: ${regions.map((region) => `${region.label} ${points(region.rate)}`).join(", ")}`;

  return (
    <Reveal className="mt-11 min-[768px]:mt-14">
      <figure>
        <figcaption className="mb-3">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
        </figcaption>
        {/* The engine sets the height from the row count (narrow screens use taller rows); until then both are reserved. */}
        <div ref={wrapRef} className="relative h-[var(--h-narrow)] w-full min-[560px]:h-[var(--h-wide)]" style={heightVars(regionsHeight(regions.length, true), regionsHeight(regions.length, false))}>
          {failed ? <ChartUnavailable text={labels.unavailable} summary={ariaLabel} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={1} />
        </div>
      </figure>
    </Reveal>
  );
}
