"use client";

import { useEffect, useRef } from "react";
import type { LabourSplit } from "../../../lib/landing/chapters/types";
import { labourCount } from "./chart-format";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { waffleTip } from "./chart-tips";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// One 10 x 10 grid of squares: every square is one person in 100, filled for the employed (ink), the unemployed
// (accent) and hollow for those outside the labour force. Chapter 07 shows it twice, for everyone aged 15+ and for
// 15–29. The key beside it, the title and the accessible name are server HTML; the drawing engine
// (waffle-engine.ts) loads near view.

export type WaffleLabels = {
  title: string; // above the grid, with the year: "15+ ასაკის ყოველი 100 ადამიანიდან, 2025"
  who: string; // tooltip row name after the share: "15+ ასაკის მოსახლეობის"
  summary: string; // canvas aria-label with the three counts per 100
  employed: string; // "დასაქმებული"
  unemployed: string; // "უმუშევარი"
  outside: string; // "შრომის ძალის გარეთ"
  people: string; // tooltip row name after the count: "ადამიანი"
  thousand: string; // count unit below a million: "ათასი"
  million: string; // count unit from a million: "მლნ"
  unemploymentRate: string; // tooltip foot of the unemployed: "უმუშევრობის დონე"
  ofLabourForce: string; // follows the rate in that foot: "შრომის ძალიდან"
  labourForce: string; // tooltip foot of the employed: "შრომის ძალა"
  neither: string; // tooltip foot of those outside: "არც მუშაობს და არც სამსახურს ეძებს"
  unavailable: string; // in place of the grid when its engine fails to load
};

const loadEngine = () => import("./waffle-engine");

export function WaffleChart({ split, labels }: { split: LabourSplit; labels: WaffleLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ split, labels });
  useEffect(() => {
    live.current = { split, labels };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !tip) return;
    const engine = lib.createWaffle({
      wrap,
      canvas,
      split,
      onHover(index, x, y) {
        const { split: s, labels: lab } = live.current;
        showTip(tip, waffleTip(s, lab, index), x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave: () => hideTip(tip),
    });
    return () => engine.destroy();
  }, [lib, split]);

  const keys = [
    { id: "employed", per100: split.per100[0], name: labels.employed, count: split.employed, swatch: "bg-[var(--ink)]" },
    { id: "unemployed", per100: split.per100[1], name: labels.unemployed, count: split.unemployed, swatch: "bg-[var(--accent)]" },
    { id: "outside", per100: split.per100[2], name: labels.outside, count: split.outside, swatch: "border-[1.5px] border-[var(--control)]" },
  ];

  return (
    <Reveal>
      <figure>
        <figcaption className="mb-3">
          <b className="text-[13.5px] font-semibold">{labels.title}</b>
        </figcaption>
        <div className="grid grid-cols-1 items-center gap-[18px] min-[520px]:grid-cols-[minmax(0,290px)_minmax(0,1fr)] min-[520px]:gap-6">
          <div ref={wrapRef} className="relative aspect-square w-full max-w-[290px]">
            {failed ? <ChartUnavailable text={labels.unavailable} summary={labels.summary} /> : <canvas ref={canvasRef} role="img" aria-label={labels.summary} className="absolute left-0 top-0" />}
            <ChartTip tipRef={tipRef} rows={2} />
          </div>
          <ul className="border-t border-[var(--hairline-soft)]">
            {keys.map((key) => (
              <li key={key.id} data-key={key.id} className="grid grid-cols-[12px_40px_minmax(0,1fr)] items-baseline gap-2.5 border-b border-[var(--row-border)] py-2.5">
                <i aria-hidden="true" className={`h-[11px] w-[11px] self-center rounded-[2px] ${key.swatch}`} />
                <b className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none">{key.per100}</b>
                <span className="text-[12.5px] leading-[1.35] text-[var(--body)]">
                  {key.name}
                  <em className="mt-0.5 block font-[family-name:var(--font-numeric)] text-[11px] not-italic text-[var(--muted)]">{labourCount(key.count, labels)}</em>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </figure>
    </Reveal>
  );
}
