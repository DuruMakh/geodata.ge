"use client";

import { useEffect, useRef } from "react";
import { formatShare } from "../../../lib/explorer/format";
import type { RevenueSeries } from "../../../lib/landing/chapters/types";
import { revenueBandColor } from "./canvas";
import { money } from "./chart-format";
import { yearRange } from "./chart-layout";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { plannedYearText, revenueTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 03: consolidated-budget receipts as a stacked area, one band per revenue group. The title,
// legend and accessible name are server HTML; the drawing engine (revenue-engine.ts) loads near view.

const loadEngine = () => import("./revenue-engine");

export type RevenueLabels = {
  title: string; // above the chart: "ნაერთი ბიუჯეტის შემოსულობები, მლრდ ₾"
  bnGel: string; // "მლრდ ₾"
  mlnGel: string; // "მლნ ₾"
  planned: string; // suffix after a planned year, and the legend entry for the hatching: "გეგმა"
  total: string; // tooltip foot lead: "სულ"
  taxes: string; // tooltip foot and aria-label: "გადასახადები"
  peakFrom: string; // callout second line under "2020 · 29%": "ვალდებულებების ზრდიდან"
  chartSummary: string; // canvas aria-label lead: "ნაერთი ბიუჯეტის შემოსულობები"
  unavailable: string; // in place of the chart when its engine fails to load
};

export function RevenueChart({ data, labels }: { data: RevenueSeries; labels: RevenueLabels }) {
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
    const engine = lib.createRevenue({
      wrap,
      canvas,
      data,
      labels: () => live.current.labels,
      onHover(index, x, y) {
        const { data: d, labels: lab } = live.current;
        showTip(tip, revenueTip(d, lab, engine.colors, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, data]);

  const last = data.years.length - 1;
  const hasPlanned = data.planned.some(Boolean);
  const ariaLabel =
    `${labels.chartSummary} ${yearRange(data.years[0], data.years[last])}: ${data.bands.map((band) => band.label).join(", ")}; ` +
    `${plannedYearText(data, last, labels.planned)}: ${money(data.totals[last], labels)}, ${labels.taxes} ${formatShare(data.taxShare[last], false, 0)}`;

  return (
    <Reveal className="mt-8">
      <figure>
        <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--body)]">
            {data.bands.map((band) => (
              <li key={band.id} data-band={band.id} className="inline-flex items-center gap-[7px]">
                <i
                  aria-hidden="true"
                  style={{ background: revenueBandColor(band.id, "var(--accent)") }}
                  className="inline-block h-2.5 w-2.5 flex-none rounded-[2px]"
                />
                {band.label}
              </li>
            ))}
            {hasPlanned && (
              <li data-band="planned" className="inline-flex items-center gap-[7px]">
                <i
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 flex-none rounded-[2px] [background:repeating-linear-gradient(135deg,var(--paper)_0_1.5px,transparent_1.5px_4px),var(--control)]"
                />
                {labels.planned}
              </li>
            )}
          </ul>
        </figcaption>
        <div ref={wrapRef} className="relative h-[360px] w-full min-[768px]:h-[420px]">
          {failed ? <ChartUnavailable text={labels.unavailable} /> : <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />}
          <ChartTip tipRef={tipRef} rows={data.bands.length} />
        </div>
      </figure>
    </Reveal>
  );
}
