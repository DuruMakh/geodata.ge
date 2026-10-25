"use client";

import { useEffect, useRef } from "react";
import type { DeathsChapter } from "../../../lib/landing/chapters/types";
import { decimals } from "./chart-format";
import { estimatedNameWidth, unitLayout } from "./chart-layout";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { deathGroupTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 10's chart: one square per 100 deaths, grouped by cause (the five largest, then the rest), hollow where
// the cause is not established. The title, legend and accessible name are server HTML; the drawing engine
// (unit-engine.ts) loads near view.

export type UnitLabels = {
  title: string; // above the chart, with the year: "გარდაცვალების მიზეზები, 2025"
  unit: string; // legend: "= 100 გარდაცვლილი"
  unknown: string; // legend of the hollow square: "მიზეზი დაუდგენელია"
  summary: string; // canvas aria-label lead, with total, year and the square unit: the three largest causes follow
  people: string; // tooltip row name after the count: "გარდაცვლილი"
  ofAll: string; // tooltip row name after the share: "ყველა გარდაცვალებიდან"
  squares: string; // tooltip foot with a {count} placeholder: "≈ {count} კვადრატი"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./unit-engine");

// The chapter body is at most 1240px wide; the server cannot measure the font, so it lays the names out with an
// estimate (estimatedNameWidth) and the engine sets the real height once it runs.
const DESKTOP_WIDTH = 1180;

export function UnitChart({ data, labels }: { data: DeathsChapter; labels: UnitLabels }) {
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
    const engine = lib.createUnits({
      wrap,
      canvas,
      groups: data.groups,
      total: data.total,
      onHover(index, x, y) {
        const { data: d, labels: lab } = live.current;
        showTip(tip, deathGroupTip(d, lab, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, data.groups, data.total]);

  const largest = data.groups.filter((group) => group.kind !== "other").slice(0, 3);
  const ariaLabel = `${labels.summary}: ${largest.map((group) => `${group.label} ${decimals(group.count, 0)}`).join(", ")}`;
  const initialHeight = unitLayout(
    DESKTOP_WIDTH,
    data.groups.map((group) => group.count),
    estimatedNameWidth,
    data.groups.map((group) => group.label),
  ).height;

  return (
    <Reveal>
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            <li className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px] bg-[var(--ink)]" />
              {labels.unit}
            </li>
            <li className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px] border-[1.5px] border-[var(--control)]" />
              {labels.unknown}
            </li>
          </ul>
        </figcaption>
        {/* The engine sets the height from the rows (narrow screens stack the names above the squares); this is the wide-screen one (it matches the measured height at 1440; a phone grows it by about 60px). */}
        <div ref={wrapRef} className="relative w-full" style={{ height: initialHeight }}>
          {failed ? <ChartUnavailable text={labels.unavailable} summary={ariaLabel} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={2} />
        </div>
      </figure>
    </Reveal>
  );
}
