"use client";

import { useEffect, useRef } from "react";
import type { AgeingChapter } from "../../../lib/landing/chapters/types";
import { signedCount } from "./chart-format";
import { yearRange } from "./chart-layout";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { migrationTip } from "./chart-tips";
import { ChartUnavailable, useEngine } from "./reveal";

// The small net migration chart inside chapter 06's migration card: one bar per year of the comparable series,
// teal above zero (more arrived), accent red below (more left) — the same arms as the births map. The accessible
// name is server HTML; the drawing engine (migration-engine.ts) loads near view.

export type MigrationLabels = {
  net: string; // tooltip row and aria-label lead: "მიგრაციის სალდო"
  moreArrived: string; // tooltip foot above zero: "ჩამოვიდა მეტი, ვიდრე წავიდა"
  moreLeft: string; // tooltip foot below zero: "წავიდა მეტი, ვიდრე ჩამოვიდა"
  highest: string; // aria-label: "ყველაზე მაღალი"
  lowest: string; // aria-label: "ყველაზე დაბალი"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./migration-engine");

export function MigrationChart({ data, labels }: { data: AgeingChapter["migration"]; labels: MigrationLabels }) {
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
    const engine = lib.createMigration({
      wrap,
      canvas,
      data,
      onHover(index, x, y) {
        const { data: d, labels: lab } = live.current;
        showTip(tip, migrationTip(d, lab, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, data]);

  const { years, net } = data;
  const high = net.indexOf(Math.max(...net));
  const low = net.indexOf(Math.min(...net));
  const ariaLabel =
    `${labels.net} ${yearRange(years[0], years[years.length - 1])}; ` +
    `${labels.highest}: ${signedCount(net[high])}, ${years[high]}; ${labels.lowest}: ${signedCount(net[low])}, ${years[low]}`;

  return (
    <div ref={wrapRef} className="relative mt-[14px] h-[104px] w-full">
      {failed ? <ChartUnavailable text={labels.unavailable} summary={ariaLabel} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
      <ChartTip tipRef={tipRef} rows={1} />
    </div>
  );
}
