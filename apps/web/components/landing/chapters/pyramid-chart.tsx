"use client";

import { useEffect, useRef } from "react";
import { formatShare } from "../../../lib/explorer/format";
import type { AgeingChapter } from "../../../lib/landing/chapters/types";
import { SEX_COLORS } from "./canvas";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { pyramidTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 06's population pyramid: men left, women right, each five-year age group as a share of the whole
// population on 1 January of the latest year, 85+ at the top. The first year's shape is a thin ink outline
// over the bars. The legend and accessible name are server HTML; the drawing engine (pyramid-engine.ts) loads near view.

export type PyramidLabels = {
  title: string; // above the chart, with the year: "მოსახლეობა ასაკისა და სქესის მიხედვით, % · 2026 წლის 1 იანვარი"
  men: string; // legend, axis and tooltip: "კაცები"
  women: string; // legend, axis and tooltip: "ქალები"
  base: string; // legend entry for the outline: "2004 წლის სტრუქტურა"
  years: string; // tooltip title, follows the age group: "წელი"
  bothSexes: string; // tooltip row and foot: "ორივე სქესი"
  then: string; // on the chart before the first year's 65+ share: "2004-ში"
  oldShare: string; // aria-label: "65 წლისა და უფროსი ასაკის წილი"
  chartSummary: string; // canvas aria-label lead: "მოსახლეობის პირამიდა 2026 წლის 1 იანვრისთვის 2004 წლის სტრუქტურასთან შედარებით"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./pyramid-engine");

/** The first age group of the 65+ share the chart annotates. */
const OLD_FROM = "65–69";

/** Rows of 65+ from the top (85+ first); a model without the 65–69 group fails the build here rather than drawing a wrong bracket. */
export function oldRows(ages: readonly string[]): number {
  const from = ages.indexOf(OLD_FROM);
  if (from < 0) throw new Error(`Ageing pyramid: no "${OLD_FROM}" age group to start the 65+ bracket`);
  return ages.length - from;
}

export function PyramidChart({ data, labels }: { data: AgeingChapter; labels: PyramidLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ data, labels });
  useEffect(() => {
    live.current = { data, labels };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);
  const rows65 = oldRows(data.pyramid.ages);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !tip) return;
    const engine = lib.createPyramid({
      wrap,
      canvas,
      data,
      oldRows: rows65,
      labels: () => live.current.labels,
      onHover(index, x, y) {
        const { data: d, labels: lab } = live.current;
        showTip(tip, pyramidTip(d.pyramid, lab, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, data, rows65]);

  const { oldShare, oldShareBase } = data;
  const ariaLabel =
    `${labels.chartSummary}; ${labels.oldShare}: ` +
    `${oldShareBase.year} — ${formatShare(oldShareBase.share)}, ${oldShare.year} — ${formatShare(oldShare.share)}`;

  return (
    <Reveal>
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            <li className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: SEX_COLORS.men }} />
              {labels.men}
            </li>
            <li className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: SEX_COLORS.women }} />
              {labels.women}
            </li>
            <li className="inline-flex items-center gap-[7px]">
              <i aria-hidden="true" className="inline-block h-0.5 w-3.5 flex-none rounded-[1px] bg-[var(--ink)]" />
              {labels.base}
            </li>
          </ul>
        </figcaption>
        <div ref={wrapRef} className="relative h-[470px] w-full min-[768px]:h-[500px]">
          {failed ? <ChartUnavailable text={labels.unavailable} summary={ariaLabel} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={3} />
        </div>
      </figure>
    </Reveal>
  );
}
