"use client";

import { useEffect, useRef } from "react";
import { formatInUnit, UNIT_PERSONS } from "../../../lib/explorer/format";
import type { AgeingChapter, MunicipalChapter } from "../../../lib/landing/chapters/types";
import { BIRTH_CLASSES } from "./canvas";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { birthsTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 06's map: births per 100 deaths in every municipality, as flat squares on chapter 04's dot grid in five
// classes diverging around 100; a municipality without figures is hollow, occupied areas are outlined. The legend
// and accessible name are server HTML; the drawing engine (births-map-engine.ts) loads near view.

export type BirthsMapLabels = {
  title: string; // above the map, with the year: "დაბადება 100 გარდაცვალებაზე, 2025"
  perHundred: string; // tooltip row: "დაბადება 100 გარდაცვალებაზე"
  births: string; // tooltip row: "დაბადება"
  deaths: string; // tooltip row: "გარდაცვალება"
  increase: string; // tooltip foot, ": +851" follows: "ბუნებრივი მატება"
  decrease: string; // tooltip foot, ": 78" follows: "ბუნებრივი კლება"
  balanced: string; // tooltip foot when births equal deaths
  noData: string; // legend key of a hollow municipality, and its tooltip: "მონაცემები არ არის"
  occupied: string; // tooltip title over an occupied area: "ოკუპირებული ტერიტორია"
  below: string; // legend entry of the first class: "50-მდე"
  highest: string; // aria-label: "ყველაზე მაღალი"
  lowest: string; // aria-label: "ყველაზე დაბალი"
  chartSummary: string; // canvas aria-label lead: "მუნიციპალიტეტების რუკა: დაბადება 100 გარდაცვალებაზე, 2025"
  unavailable: string; // in place of the chart when its engine fails to load
};

/** Births per 100 deaths of every municipality with figures, by place index. */
export function placeRatios(births: AgeingChapter["births"]): { index: number; ratio: number }[] {
  const out: { index: number; ratio: number }[] = [];
  births.places.forEach((entry, index) => {
    if (entry) out.push({ index, ratio: (entry.births / entry.deaths) * 100 });
  });
  return out;
}

const loadEngine = () => import("./births-map-engine");
const whole = (v: number) => formatInUnit(v, UNIT_PERSONS);

export function BirthsMap({ births, municipal, labels }: { births: AgeingChapter["births"]; municipal: MunicipalChapter; labels: BirthsMapLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ births, municipal, labels });
  useEffect(() => {
    live.current = { births, municipal, labels };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !tip) return;
    const engine = lib.createBirthsMap({
      wrap,
      canvas,
      births,
      municipal,
      onHover(hit, x, y) {
        const { births: b, municipal: m, labels: lab } = live.current;
        showTip(tip, birthsTip(b, m.places, lab, hit), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, births, municipal]);

  const ratios = placeRatios(births).sort((a, b) => b.ratio - a.ratio);
  const named = (r: { index: number; ratio: number } | undefined) => (r ? `${municipal.places[r.index].name} ${whole(r.ratio)}` : "");
  const ariaLabel = `${labels.chartSummary}; ${labels.highest}: ${named(ratios[0])}; ${labels.lowest}: ${named(ratios[ratios.length - 1])}`;
  const classLabel = (i: number) =>
    i === 0 ? labels.below : i === BIRTH_CLASSES.length - 1 ? `${BIRTH_CLASSES[i - 1].below}+` : `${BIRTH_CLASSES[i - 1].below}–${BIRTH_CLASSES[i].below}`;

  return (
    <Reveal className="mt-11 min-[768px]:mt-14">
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            {BIRTH_CLASSES.map((c, i) => (
              <li key={c.color} className="inline-flex items-center gap-[7px]">
                <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: c.color }} />
                {classLabel(i)}
              </li>
            ))}
            <li className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px] border-[1.5px] border-[var(--control)]" />
              {labels.noData}
            </li>
          </ul>
        </figcaption>
        <div ref={wrapRef} className="relative aspect-[138/71] w-full">
          {failed ? <ChartUnavailable text={labels.unavailable} summary={ariaLabel} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={3} />
        </div>
      </figure>
    </Reveal>
  );
}
